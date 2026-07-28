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

interface AskRequestBody {
  communityId?: string;
  question?: string;
}

// Build Plan Checkpoint 49 — the reactive round trip (Blueprint Section
// 6.7): send the creator's question to the Mind, then poll
// GetMessageHistory for its reply (a short bounded poll, since this
// route — unlike apps/agent — is a single request/response cycle with
// no persistent SSE connection of its own; the agent's SSE listener,
// Checkpoint 47/48, is for autonomous output, not this synchronous path).
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

  const beforeCount = (await getMessageHistory(alias)).messages.length;
  await sendMessage(alias, question);

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
    return NextResponse.json({ error: 'The Mind did not respond in time.' }, { status: 504 });
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
