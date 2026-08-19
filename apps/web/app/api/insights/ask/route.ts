import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@kindred/db';
import { sendMessage } from '@kindred/minds-client';

// Bounded wait, expressed as a wall-clock deadline. Hard-coded
// rather than reading from an env var so the bound is auditable in
// the source — Ask Kindred must not turn into an unbounded listener.
//
// Measured Mind reply latency on this Mind (production test, 2026-08-19):
//   60-240+ seconds, with the long tail creeping up over the
//   course of testing as the Mind did more interpretation work.
//   The Mind does real synthesis (relationship analysis over the
//   event stream), so its response is slower than a typical LLM
//   echo. 280s catches the observed upper range (4-minute replies)
//   with ~40s of safety margin and stays well under the team's
//   Vercel functionDefaultTimeout=300s ceiling (maxDuration=290
//   below). Anything past 280s still gets the fallback path — the
//   agent's SSE listener records the same reply as a
//   source='autonomous' Insight — but the Ask modal itself will
//   already have closed.
const MAX_WAIT_MS = 280_000;

// How often to re-check the conversation history while waiting for
// the Mind's reply. 2s is a small-enough interval to feel responsive
// on success and large-enough to keep the Minds API request count
// well under any rate limit. (280s / 2s = ~140 polls worst case —
// still well under the official Builder API's quotas.)
const POLL_INTERVAL_MS = 2000;

// How many of the most recent unsent relationship events to surface as
// context alongside the question. Capped to keep the message well under
// any reasonable LLM input budget; the rest are still delivered via the
// 15-minute digest worker (apps/agent/src/workers/mind-digest-sender).
// 20 is a deliberately small number — the digest exists precisely so
// Ask doesn't have to carry the whole history itself.
const RECENT_CONTEXT_EVENT_LIMIT = 20;

// Vercel function timeout. The team's defaultResourceConfig.
// functionDefaultTimeout is 300s (Enterprise tier), so 290s is well
// within the platform's allowed ceiling. The route's wall-clock
// budget above (280s) leaves 10s of headroom for auth + DB +
// sendMessage + the final response payload over the wire.
export const maxDuration = 290;
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

// Build Plan Checkpoint 49 — the reactive round trip (Blueprint Section
// 6.7): send the creator's question to the Mind, then poll the DB
// (via the agent's SSE listener path) for the resulting Insight
// row, with a bounded wall-clock deadline.
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
// Audit fix (this iteration): the previous implementation polled
// the REST GetMessageHistory endpoint for a new message. Live
// production test (2026-08-19) showed that even after the Mind
// had replied and the agent's SSE listener had written a
// source='autonomous' Insight row, the REST history endpoint
// could lag indefinitely — the polling loop ran 280 seconds and
// never saw the new message. The official Minds Builder API has
// eventual consistency between the SSE event stream and the REST
// GetMessageHistory index: SSE events fire immediately, the REST
// index catches up seconds-to-minutes later (and sometimes not
// at all in the polling window). The SSE listener's DB write is
// the canonical "Mind has replied" signal — this route now polls
// the DB instead of the REST history, which catches the SSE
// listener's write as soon as it commits (sub-second from the
// Mind's reply, vs. multi-minute REST lag). On a hit, the
// existing source='autonomous' row is promoted to
// source='reactive' (the Ask path claiming it) instead of
// creating a duplicate — so the symmetric dedupe check in
// apps/agent/src/minds/sse-listener.ts still has nothing to do.
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

  // Capture the most recent insight's createdAt BEFORE we send the
  // question. The polling loop below will look for any insight with
  // createdAt > this cutoff, so anything the agent's SSE listener
  // (apps/agent/src/minds/sse-listener.ts) writes in response to
  // the question is what the Ask modal will surface.
  //
  // Why poll the DB instead of getMessageHistory (the REST history
  // endpoint)? Measured production bug (live test, 2026-08-19):
  // the Mind replied and the SSE listener caught the reply and
  // wrote a source='autonomous' Insight within 17 seconds of the
  // Mind's last message, but the Ask route's getMessageHistory
  // polling never saw the new message in 280 seconds of polling
  // and timed out. The official Minds Builder API has eventual
  // consistency between the SSE event stream and the REST
  // GetMessageHistory endpoint — the SSE event fires
  // immediately, the REST indexing catches up seconds-to-minutes
  // later. The SSE listener's DB write is the canonical "Mind has
  // replied" signal; polling the REST history from this route is
  // racy. Polling the DB picks up the SSE listener's write as
  // soon as it commits, which is sub-second from the Mind's reply.
  const latestBeforeAsk = await prisma.insight.findFirst({
    where: { communityId: community.id },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  const insightCutoff = latestBeforeAsk?.createdAt ?? new Date(0);

  await sendMessage(alias, composedQuestion);

  // Bounded polling: check the DB for a new insight every
  // POLL_INTERVAL_MS until the wall-clock deadline passes. Exits
  // as soon as we see a new insight whose createdAt is past the
  // cutoff — that "exit on first match" is what makes the route
  // feel snappy on the fast path. The SSE listener's check-in
  // filter (apps/agent/src/minds/sse-listener.ts) means check-in
  // boilerplate never reaches the DB, so anything that does
  // appear is the Mind's real reply to the question (or another
  // genuine autonomous insight; either way, it's the most recent
  // thing the Mind said and is what the user is asking for).
  const deadline = Date.now() + MAX_WAIT_MS;
  let answerInsight: { id: string; content: string } | null = null;
  while (Date.now() < deadline) {
    const newInsight = await prisma.insight.findFirst({
      where: {
        communityId: community.id,
        createdAt: { gt: insightCutoff },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, content: true },
    });
    if (newInsight) {
      answerInsight = newInsight;
      break;
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(POLL_INTERVAL_MS, remaining)));
  }

  if (!answerInsight) {
    // Don't mark the events sentToMind on a timeout — the Mind may
    // still be processing, and if it eventually answers it deserves to
    // have seen the context. The next Ask or the next digest will
    // re-deliver. If the Mind's late reply does arrive, the SSE
    // listener's dedupe check (apps/agent/src/minds/sse-listener.ts)
    // means it won't double-write a row even if a later Ask succeeds.
    return NextResponse.json({ error: 'The Mind did not respond in time.' }, { status: 504 });
  }

  // Promote the source to 'reactive' so the UI can distinguish
  // "this insight was the answer to an explicit Ask" from a
  // normal autonomous interpretation. The SSE listener's write
  // was source='autonomous' (it doesn't know which questions the
  // creator is actively waiting on); this is the Ask path
  // claiming it. Idempotent — if the SSE listener also wrote a
  // row with the same content, the dedupe check on its side
  // already prevented the duplicate, so this update just labels
  // the existing row.
  await prisma.insight.update({
    where: { id: answerInsight.id },
    data: { source: 'reactive' },
  });

  // Only mark the events sentToMind AFTER a successful reply, so the
  // digest worker doesn't double-deliver them and we don't poison the
  // sentToMind flag on a message the Mind never actually saw.
  if (recentEvents.length > 0) {
    await prisma.relationshipEvent.updateMany({
      where: { id: { in: recentEvents.map((event) => event.id) } },
      data: { sentToMind: true, sentToMindAt: new Date() },
    });
  }

  return NextResponse.json({ answer: answerInsight.content, insightId: answerInsight.id });
}
