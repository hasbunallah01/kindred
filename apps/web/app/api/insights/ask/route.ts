import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@kindred/db';
import { sendMessage, getMessageHistory, htmlToText } from '@kindred/minds-client';

// Bounded wait, expressed as a wall-clock deadline. Hard-coded
// rather than reading from an env var so the bound is auditable in
// the source — Ask Kindred must not turn into an unbounded listener.
//
// Measured Mind reply latency on this Mind (production test, 2026-08-19):
//   60-160+ seconds for substantive questions after the Mind has been
//   idle. The 52s budget tried previously was too short — the Mind
//   answered, but past our 504. 170s catches the observed range with
//   ~10-110s of safety margin, and stays well under the team's
//   Vercel functionDefaultTimeout=300s ceiling (maxDuration=180 below).
const MAX_WAIT_MS = 170_000;

// How often to re-check the conversation history while waiting for
// the Mind's reply. 2s is a small-enough interval to feel responsive
// on success and large-enough to keep the Minds API request count
// well under any rate limit. (170s / 2s = ~85 polls worst case —
// well under the official Builder API's quotas.)
const POLL_INTERVAL_MS = 2000;

// How many of the most recent unsent relationship events to surface as
// context alongside the question. Capped to keep the message well under
// any reasonable LLM input budget; the rest are still delivered via the
// 15-minute digest worker (apps/agent/src/workers/mind-digest-sender).
// 20 is a deliberately small number — the digest exists precisely so
// Ask doesn't have to carry the whole history itself.
const RECENT_CONTEXT_EVENT_LIMIT = 20;

// Dedupe window. If the same Mind response is observed by both the Ask
// route and the agent's SSE listener (apps/agent/src/minds/sse-listener.ts),
// the second one to write a row would create a duplicate. The check is
// a content match within this window for the same community — 4
// minutes is comfortably more than the 170s polling budget here, so
// any reply we DID see in Ask has had a chance to land via the SSE
// listener by then, and vice versa.
const DEDUPE_WINDOW_MS = 240_000;

// Vercel function timeout. The team's defaultResourceConfig.
// functionDefaultTimeout is 300s (Enterprise tier), so 180s is well
// within the platform's allowed ceiling. The route's wall-clock
// budget above (170s) leaves 10s of headroom for auth + DB +
// sendMessage + the final response payload over the wire.
export const maxDuration = 180;
export const dynamic = 'force-dynamic';

interface AskRequestBody {
  communityId?: string;
  question?: string;
}

// Subset of RelationshipEvent + its Member, enough to render the context
// preamble. Kept local so this route isn't coupled to the digest-sender
// worker's exact query shape.
interface RecentEventRow {
  id: string;
  type: string;
  payload: unknown;
  occurredAt: Date;
  member: { displayName: string };
}

function messagePreviewOf(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null && 'messagePreview' in payload) {
    const value = (payload as { messagePreview?: unknown }).messagePreview;
    return typeof value === 'string' ? value : '';
  }
  return '';
}

// Renders the recent-activity preamble prepended to the creator's
// question. Mirrors the digest-sender's wording so the Mind sees the
// same shape regardless of which path delivered the context — that
// consistency matters for the Mind's own interpretation rules.
function formatRecentContext(events: RecentEventRow[]): string {
  const lines = events.map((event) => {
    const when = event.occurredAt.toISOString();
    switch (event.type) {
      case 'joined':
        return `- ${event.member.displayName} joined (${when})`;
      case 'first_interaction':
        return `- ${event.member.displayName}'s first message: "${messagePreviewOf(event.payload)}" (${when})`;
      case 'participation':
        return `- ${event.member.displayName} was active (${when})`;
      case 'creator_interaction':
        return `- You replied to ${event.member.displayName}: "${messagePreviewOf(event.payload)}" (${when})`;
      default:
        return `- ${event.member.displayName}: ${event.type} (${when})`;
    }
  });
  return lines.join('\n');
}

// Returns the existing insight row that should "stand in" for the
// answer we're about to record, if one was just created by the
// agent's SSE listener (or by a previous, faster Ask that raced
// with us). The dedupe key is (communityId, content) within a
// recent time window: the Mind's reply is small enough that exact
// content match is a reliable signal. Returns null when no match
// exists — caller proceeds to create a fresh row.
async function findRecentDuplicateInsight(
  communityId: string,
  content: string,
): Promise<{ id: string } | null> {
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
  return prisma.insight.findFirst({
    where: {
      communityId,
      content,
      createdAt: { gte: since },
    },
    select: { id: true },
  });
}

// Build Plan Checkpoint 49 — the reactive round trip (Blueprint Section
// 6.7): send the creator's question to the Mind, then poll
// GetMessageHistory for its reply with a bounded wall-clock deadline.
//
// Audit fix (this iteration): the previous version used a fixed
// 6-iteration × 1-second sleep loop — a budget of ~6 seconds — that
// timed out well before the Mind's typical reply time on this Mind
// (measured production latency on a short question: 1–8 minutes,
// with a 6-poll floor that was never going to catch any reply in
// time). The new design uses an absolute deadline and checks the
// conversation history *before* the first sleep, so a reply that
// arrives during the initial sendMessage round-trip is not lost.
// The deadline is hard-capped at MAX_WAIT_MS so the route can never
// turn into an unbounded listener, and a 504 is still returned if
// the Mind genuinely doesn't respond in time.
//
// Audit fix (this iteration): the same Mind response is observed by
// both this route (which records source='reactive') and the agent's
// SSE listener (which records source='autonomous'). To prevent
// duplicate Insight rows, both paths now dedupe on
// (communityId, content) within DEDUPE_WINDOW_MS — see
// apps/agent/src/minds/sse-listener.ts for the symmetric check.
// Both paths also run the same `htmlToText` on the raw messageText
// before persisting, so the content string actually matches.
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as AskRequestBody | null;
  const communityId = body?.communityId;
  const question = body?.question?.trim();

  if (!communityId || !question) {
    return NextResponse.json({ error: 'communityId and question are required' }, { status: 400 });
  }

  const community = await prisma.community.findFirst({
    where: { id: communityId, creatorId: session.user.id },
  });

  if (!community?.mindsConversationId) {
    return NextResponse.json(
      { error: 'Community not found or not yet linked to a Mind conversation' },
      { status: 404 },
    );
  }

  const alias = community.mindsConversationId;

  // Fetch the most recent unsent relationship events for this community
  // and build a context preamble prepended to the question. Ordering by
  // occurredAt desc so the freshest context is in scope even if we
  // truncate at RECENT_CONTEXT_EVENT_LIMIT.
  const recentEvents = await prisma.relationshipEvent.findMany({
    where: { sentToMind: false, member: { communityId: community.id } },
    orderBy: { occurredAt: 'desc' },
    take: RECENT_CONTEXT_EVENT_LIMIT,
    include: { member: { select: { displayName: true } } },
  });

  // Render the preamble (if any) and combine with the question. The
  // clear <context>/<question> delimiter matters: the Mind needs to
  // know which part is the human's actual question so it doesn't try
  // to interpret a relationship-event bullet as the prompt.
  const contextBlock = recentEvents.length > 0
    ? `Recent relationship activity (not yet in your memory):\n${formatRecentContext(recentEvents)}\n\n`
    : '';
  const composedQuestion = `${contextBlock}<question>\n${question}\n</question>`;

  const beforeCount = (await getMessageHistory(alias)).messages.length;
  await sendMessage(alias, composedQuestion);

  // Bounded polling: check the conversation history immediately
  // first, then poll every POLL_INTERVAL_MS until the wall-clock
  // deadline passes or the Mind replies. Exits as soon as we see a
  // new non-user message — that "exit on first match" is what makes
  // the route feel snappy on the fast path.
  const deadline = Date.now() + MAX_WAIT_MS;
  let answer: string | null = null;
  while (Date.now() < deadline) {
    const history = await getMessageHistory(alias);
    if (history.messages.length > beforeCount) {
      const newest = history.messages[history.messages.length - 1];
      if (newest && newest.role !== 'user') {
        // Strip HTML before storing (or before any dedupe lookup)
        // so the content matches what the SSE listener would have
        // written for the same reply — see findRecentDuplicateInsight
        // above for why this matters.
        answer = htmlToText(newest.content);
        break;
      }
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(POLL_INTERVAL_MS, remaining)));
  }

  if (!answer) {
    // Don't mark the events sentToMind on a timeout — the Mind may
    // still be processing, and if it eventually answers it deserves to
    // have seen the context. The next Ask or the next digest will
    // re-deliver. The Mind's late reply will also be picked up by
    // the agent's SSE listener and recorded as a source='autonomous'
    // Insight (with the same dedupe window, so it won't collide
    // with a future Ask that did succeed).
    return NextResponse.json({ error: 'The Mind did not respond in time.' }, { status: 504 });
  }

  // Dedupe against an existing insight the SSE listener may have
  // already written for this exact reply (it can race ahead of us
  // if the Mind replies faster than the first poll). If a recent
  // row with matching content exists, reuse its id instead of
  // creating a second row. The mirror check lives in the SSE
  // listener so whichever path fires second sees the other.
  const existing = await findRecentDuplicateInsight(community.id, answer);
  if (existing) {
    if (recentEvents.length > 0) {
      await prisma.relationshipEvent.updateMany({
        where: { id: { in: recentEvents.map((event) => event.id) } },
        data: { sentToMind: true, sentToMindAt: new Date() },
      });
    }
    return NextResponse.json({ answer, insightId: existing.id });
  }

  // Only mark the events sentToMind AFTER a successful reply, so the
  // digest worker doesn't double-deliver them and we don't poison the
  // sentToMind flag on a message the Mind never actually saw.
  if (recentEvents.length > 0) {
    await prisma.relationshipEvent.updateMany({
      where: { id: { in: recentEvents.map((event) => event.id) } },
      data: { sentToMind: true, sentToMindAt: new Date() },
    });
  }

  const insight = await prisma.insight.create({
    data: {
      communityId: community.id,
      source: 'reactive',
      content: answer,
    },
  });

  return NextResponse.json({ answer, insightId: insight.id });
}
