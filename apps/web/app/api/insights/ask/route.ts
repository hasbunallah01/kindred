import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@kindred/db';
import { sendMessage, getMessageHistory } from '@kindred/minds-client';

// Kept conservatively short — Vercel's default serverless function
// duration on the Hobby plan is 10s, and this route needs headroom for
// auth/DB overhead on top of the polling loop itself. 6 attempts * 1s =
// 6s of polling.
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 6;

// How many of the most recent unsent relationship events to surface as
// context alongside the question. Capped to keep the message well under
// any reasonable LLM input budget; the rest are still delivered via the
// 15-minute digest worker (apps/agent/src/workers/mind-digest-sender).
// 20 is a deliberately small number — the digest exists precisely so
// Ask doesn't have to carry the whole history itself.
const RECENT_CONTEXT_EVENT_LIMIT = 20;

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
// 6.7): send the creator's question to the Mind, then poll
// GetMessageHistory for its reply (a short bounded poll, since this
// route — unlike apps/agent — is a single request/response cycle with
// no persistent SSE connection of its own; the agent's SSE listener,
// Checkpoint 47/48, is for autonomous output, not this synchronous path).
//
// Audit fix: the original implementation sent the bare question, so
// the Mind only knew about events that had already been batched by the
// 15-minute digest worker. An Ask landing in the middle of a digest
// window would miss anything that happened since the last digest
// (up to 15 minutes of relationship context, including the very
// question's relevance). The fix: surface the most recent unsent
// events as a preamble to the question, then mark them sentToMind so
// the digest worker doesn't double-deliver them.
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

  let answer: string | null = null;
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const history = await getMessageHistory(alias);

    if (history.messages.length > beforeCount) {
      const newest = history.messages[history.messages.length - 1];
      if (newest && newest.role !== 'user') {
        answer = newest.content;
        break;
      }
    }
  }

  if (!answer) {
    // Don't mark the events sentToMind on a timeout — the Mind may
    // still be processing, and if it eventually answers it deserves to
    // have seen the context. The next Ask or the next digest will
    // re-deliver.
    return NextResponse.json({ error: 'The Mind did not respond in time.' }, { status: 504 });
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
