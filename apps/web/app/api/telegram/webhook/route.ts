import { NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES, type TelegramIngestJobData } from '@kindred/shared';

// This connection intentionally does NOT set maxRetriesPerRequest: null —
// that's correct for a Worker (a background process that can wait), but
// wrong for a producer sitting behind an HTTP request: if Redis is down,
// an HTTP caller (Telegram, in this case) shouldn't hang forever waiting
// on retries. Left at BullMQ/ioredis's own default.
const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379');

const telegramIngestQueue = new Queue<TelegramIngestJobData>(QUEUE_NAMES.TELEGRAM_INGEST, {
  connection,
});

// Receives every Telegram update for the bot (Blueprint Section 5.3 step
// 1-2). Does no processing itself — validates the secret Telegram sends,
// enqueues the raw update, and returns immediately. The agent's
// telegram-ingest worker (Checkpoint 31) does the actual work.
export async function POST(request: Request) {
  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');

  if (
    !process.env.TELEGRAM_WEBHOOK_SECRET ||
    secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let update: unknown;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  await telegramIngestQueue.add('process-update', {
    update,
    receivedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
