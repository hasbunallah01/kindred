import { NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import JSONBigInt from 'json-bigint';
import { QUEUE_NAMES, type TelegramIngestJobData } from '@kindred/shared';

// Recursively walk a value produced by `json-bigint`'s parser and
// stringify every field — both BigInts (large integers) and unsafe
// floats — so the result is a plain object BullMQ can JSON.stringify
// for Redis storage without losing precision.
//
// Why this matters: standard `JSON.parse` truncates integers larger
// than `Number.MAX_SAFE_INTEGER` (2^53 - 1) at parse time, so any
// subsequent conversion can only preserve the *corrupted* value.
// `json-bigint` instead emits BigInts for those, which is lossless
// until the next `JSON.stringify` (which throws on BigInts). We
// resolve that by converting BigInts to strings here — strings round-
// trip through JSON.stringify unchanged, and the worker's
// `BigInt(update.chat.id)` calls at the database boundary accept
// strings, so this is a lossless representation end to end.
function jsonBigIntsToStrings(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? value : value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(jsonBigIntsToStrings);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      // The Telegram Bot API uses `id` for every integer identifier
      // (user, chat, message, update). Force those to strings even if
      // they fit in a safe integer — keeps the data model uniform and
      // means the agent never has to wonder "is this id a number or
      // a string?" in its TypeScript types.
      if (k === 'id' && typeof v === 'number') {
        out[k] = v.toString();
      } else {
        out[k] = jsonBigIntsToStrings(v);
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
    // Use json-bigint to parse the raw body — the standard `request.json()`
    // (which calls `JSON.parse`) silently truncates integers larger than
    // `Number.MAX_SAFE_INTEGER` (2^53 - 1), and the corruption happens
    // before any code we write gets a chance to see the original value.
    // json-bigint returns BigInts for those, which preserves the full
    // 64-bit precision of Telegram user/chat IDs.
    const text = await request.text();
    const parsed = JSONBigInt.parse(text);
    // Convert BigInts to strings and force every `id` field to a string
    // before enqueuing, so the value is safe for BullMQ's internal
    // JSON.stringify and the agent's TypeScript types stay uniform.
    update = jsonBigIntsToStrings(parsed);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

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
