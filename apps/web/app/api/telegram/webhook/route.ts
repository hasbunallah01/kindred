import { NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES, type TelegramIngestJobData } from '@kindred/shared';

// Recursively walk a parsed JSON value and stringify every field whose
// key is `id` (or whose value is a number too large to fit in a JS
// double-precision float). This prevents precision loss for Telegram
// user IDs, group chat IDs, and any other integer field that might
// exceed `Number.MAX_SAFE_INTEGER` (2^53 - 1 = 9007199254740991) on
// its way through the JSON → BullMQ → Redis → JSON pipeline.
//
// Why string and not bigint: BullMQ serializes job data with
// `JSON.stringify` for storage in Redis, and `JSON.stringify` throws
// on `bigint` values. The agent's worker calls `BigInt(update.chat.id)`
// at the database boundary — `BigInt()` accepts both numbers and
// strings, so emitting IDs as strings is a lossless representation that
// works with JSON.stringify and converts cleanly to the BigInt the
// Prisma schema expects.
function preserveIntegerPrecision(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? value : value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(preserveIntegerPrecision);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      // The Telegram Bot API uses `id` for every integer identifier
      // (user, chat, message, update). Convert those to strings to
      // survive the JSON pipeline, and also convert any other unsafe
      // integer (defense in depth in case Telegram adds new ID fields
      // we haven't seen yet).
      if (k === 'id' && typeof v === 'number') {
        out[k] = v.toString();
      } else {
        out[k] = preserveIntegerPrecision(v);
      }
    }
    return out;
  }
  return value;
}

// REDIS_URL is required — no localhost fallback. Failing fast with 500
// here is intentional: the previous "create a connection and let ioredis
// retry forever" pattern hung the Vercel function for 100s+ when the env
// was missing or unreachable, which made the whole webhook look broken
// (Telegram would retry, Vercel would accumulate timed-out invocations,
// and the producer-side failure masqueraded as a runtime hang). Checking
// up front turns "the function silently disappears" into "the function
// returns a clear error in milliseconds", which is what an HTTP caller
// like Telegram actually needs to back off cleanly.
function getConnection(): IORedis | NextResponse {
  const url = process.env.REDIS_URL;
  if (!url) {
    return NextResponse.json(
      { error: 'REDIS_URL is not set' },
      { status: 500 }
    );
  }
  // maxRetriesPerRequest: 1 + a tight 2s connect timeout. The previous
  // defaults (20 retries, no connect timeout) would hang the function
  // past Vercel's 10–300s limit when Redis was unreachable. For an HTTP
  // producer (Telegram, in this case) we'd rather fail fast and let
  // Telegram retry than block the whole function on a slow Redis.
  return new IORedis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    enableReadyCheck: true,
  });
}

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

  // Convert any `id` fields to strings (and any other unsafe integers)
  // before handing the payload to BullMQ. This is the lossless
  // representation: the worker's `BigInt(update.chat.id)` calls accept
  // both numbers and strings, so the round trip through Redis JSON
  // storage can't lose precision on large Telegram IDs.
  update = preserveIntegerPrecision(update);

  const connectionOrError = getConnection();
  if (connectionOrError instanceof NextResponse) {
    return connectionOrError;
  }
  const connection = connectionOrError;

  // The queue is created per-request now (not at module load). The old
  // module-level `new IORedis(...)` was the hang source: it ran during
  // Vercel's cold start, and if the connection failed it retried for the
  // whole function timeout before any request handler could run. Per-
  // request creation is slightly more overhead (one TCP+TLS handshake
  // per webhook call) but turns connection failure into a fast, visible
  // 5xx response. Telegram is happy to retry; Vercel functions are not
  // happy to be held open for 100s.
  const queue = new Queue<TelegramIngestJobData>(QUEUE_NAMES.TELEGRAM_INGEST, {
    connection,
  });

  try {
    // Race the enqueue against a 4s hard timeout. If Redis is slow or
    // unreachable, we lose this race and return 503 — Telegram will
    // retry, the agent's workers won't see the job until Redis is back,
    // and the function returns within Vercel's limits.
    await Promise.race([
      queue.add('process-update', {
        update,
        receivedAt: new Date().toISOString(),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('enqueue timeout')), 4000)
      ),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[telegram-webhook] enqueue failed:', err);
    return NextResponse.json(
      { error: 'Failed to enqueue update', detail: String(err) },
      { status: 503 }
    );
  } finally {
    // Close the connection so we don't leak it (Vercel functions are
    // short-lived; leaving an open socket is a small but real cost).
    await connection.quit().catch(() => {});
  }
}
