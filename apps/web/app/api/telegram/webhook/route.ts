import { NextResponse } from 'next/server';
import JSONBigInt from 'json-bigint';

// Recursively walk a value produced by `json-bigint`'s parser and
// stringify every field — both BigInts (large integers) and unsafe
// floats — so the result is a plain object that survives
// `JSON.stringify` (the body of the POST we send to the agent)
// without losing precision.
//
// Why this matters: standard `JSON.parse` truncates integers larger
// than `Number.MAX_SAFE_INTEGER` (2^53 - 1) at parse time, so any
// subsequent conversion can only preserve the *corrupted* value.
// `json-bigint` instead emits BigInts for those, which is lossless
// until the next `JSON.stringify` (which throws on BigInts). We
// resolve that by converting BigInts to strings here — strings
// round-trip through JSON.stringify unchanged, and the agent's
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

// Receives every Telegram update for the bot (Blueprint Section 5.3
// step 1-2). Does no processing itself — validates the secret
// Telegram sends, then synchronously POSTs the raw update to the
// Railway agent's /ingest/telegram endpoint. The agent processes
// the update synchronously and returns 200 to us; we return 200 to
// Telegram. If the agent is down or slow, the 4s hard timeout below
// fires and we return 503 — Telegram will retry.
//
// Why synchronous (not fire-and-forget like the old BullMQ
// enqueue): the simpler model has one failure mode ("agent crashed
// mid-processing → Telegram retries via the 503") vs. two
// ("dispatched task to a queue that no longer exists → update is
// lost forever"). With the HTTP path, every accepted request is
// either a delivered update or a 503 that Telegram will retry.
export async function POST(request: Request) {
  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');

  if (
    !process.env.TELEGRAM_WEBHOOK_SECRET ||
    secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ingestUrl = process.env.AGENT_INGEST_URL;
  const ingestSecret = process.env.AGENT_INGEST_SECRET;
  if (!ingestUrl || !ingestSecret) {
    // Failing fast with 500 is intentional: a missing agent
    // URL/secret is a deployment misconfiguration, and the right
    // response is for the operator to fix it (and for Telegram to
    // keep retrying in the meantime — Telegram's 5-minute retry
    // window is plenty of time to roll a fix). Returning 200 would
    // be worse: Telegram would consider the update delivered and
    // move on, and the actual update would be silently lost.
    console.error(
      '[telegram-webhook] AGENT_INGEST_URL or AGENT_INGEST_SECRET is not set',
    );
    return NextResponse.json(
      { error: 'Agent ingestion not configured' },
      { status: 500 },
    );
  }

  let update: unknown;
  try {
    // Use json-bigint to parse the raw body — the standard
    // `request.json()` (which calls `JSON.parse`) silently truncates
    // integers larger than `Number.MAX_SAFE_INTEGER` (2^53 - 1), and
    // the corruption happens before any code we write gets a chance
    // to see the original value. json-bigint returns BigInts for
    // those, which preserves the full 64-bit precision of Telegram
    // user/chat IDs.
    const text = await request.text();
    const parsed = JSONBigInt.parse(text);
    // Convert BigInts to strings and force every `id` field to a
    // string before POSTing, so the value is safe for the agent's
    // internal `JSON.stringify` and the agent's TypeScript types
    // stay uniform.
    update = jsonBigIntsToStrings(parsed);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Race the agent POST against a 4s hard timeout. If the agent is
  // slow or unreachable, we lose this race and return 503 —
  // Telegram will retry. The agent itself is designed to return
  // well within this window: its worst-case processing path
  // (first-time admin promotion with a brand-new Mind conversation)
  // takes ~1.1s, and the Vercel-side 4s budget gives the agent
  // ~3s of margin for cold starts or transient network blips.
  try {
    const response = await Promise.race([
      fetch(ingestUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-kindred-secret': ingestSecret,
        },
        body: JSON.stringify(update),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('agent ingest timeout')), 4000),
      ),
    ]);

    if (!response.ok) {
      // The agent rejected the update (401: bad secret, 400: bad
      // body, 500: handler threw). For 5xx we return 503 so
      // Telegram retries; for 4xx we also return 503 (the update
      // shape is what Telegram sent us, so a 400 from the agent is
      // an agent bug, not a client bug — retrying is harmless).
      console.error(
        `[telegram-webhook] agent responded ${response.status}: ${await response.text().catch(() => '<unreadable>')}`,
      );
      return NextResponse.json(
        { error: 'Agent rejected update' },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[telegram-webhook] agent ingest failed:', err);
    return NextResponse.json(
      { error: 'Failed to deliver update to agent', detail: String(err) },
      { status: 503 },
    );
  }
}
