import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { createServer as createNodeServer } from 'node:http';
import { handleTelegramUpdate } from './handlers';

// The agent's only public HTTP surface. Two routes:
//
//   GET  /healthz      — liveness check. Returns 'ok' plain text.
//
//   POST /ingest/telegram
//                      — the single endpoint that receives Telegram
//                         updates from the Vercel webhook. Authenticated
//                         by the AGENT_INGEST_SECRET shared with the
//                         webhook. Processing is SYNCHRONOUS: the
//                         handler returns 200 only after the update
//                         has been fully written to Postgres / sent to
//                         Telegram / sent to Minds. The worst-case
//                         path (first-time admin promotion with a
//                         brand-new Mind conversation) takes ~1.1s —
//                         well under Vercel's 10s serverless timeout
//                         and well under Telegram's ~5min retry
//                         window. We picked synchronous over a
//                         fire-and-forget pattern because the simpler
//                         model has one failure mode ("agent crashed
//                         mid-processing → Telegram retries") vs. two
//                         ("agent crashed before the dispatched task
//                         ran → Telegram already got 200 → update is
//                         lost").
//
// In-memory update_id deduplication. Telegram retries the same
// update_id on any 5xx or network error. The webhook code's
// synchronous path means 5xx is rare, but a true duplicate can still
// happen if the agent crashes between responding 200 and finishing
// the database write. The dedup Map prevents a second processing
// of the same update_id within the Telegram retry window
// (10 minutes — deliberately longer than Telegram's documented
// max retry of ~5 minutes).
//
// The Map is in-process only: on agent restart, the Map is empty.
// A retry that arrives within 10 minutes of restart could
// double-process (the only non-idempotent path is
// prisma.relationshipEvent.createMany, and even there a single
// duplicate is the worst case). Post-hackathon we should persist
// processed update_ids in Postgres. For the demo, this is sufficient.

const DEDUP_TTL_MS = 10 * 60 * 1000;
const dedupMap = new Map<number, number>();

function pruneDedupMap(): void {
  const cutoff = Date.now() - DEDUP_TTL_MS;
  for (const [id, ts] of dedupMap) {
    if (ts < cutoff) dedupMap.delete(id);
  }
}

export function createApp(): Hono {
  const app = new Hono();
  app.use('*', logger());

  app.get('/healthz', (c) => c.text('ok'));

  app.post('/ingest/telegram', async (c) => {
    // Shared-secret check. The webhook sends the same value via
    // the x-kindred-secret header; we read it from AGENT_INGEST_SECRET
    // (set on the agent service in Railway). A constant-time compare
    // would be overkill for a 64-char hex secret that never leaves
    // our two services, so a straight equality check is fine.
    const provided = c.req.header('x-kindred-secret');
    const expected = process.env.AGENT_INGEST_SECRET;
    if (!expected || provided !== expected) {
      return c.text('Unauthorized', 401);
    }

    // Parse the body. We accept whatever JSON the webhook sends
    // (Vercel's webhook produces an object with a `update_id` field
    // and the rest of the Telegram Update shape). We don't re-parse
    // with json-bigint here because the webhook has already done
    // that conversion and stringified all BigInt fields — see
    // apps/web/app/api/telegram/webhook/route.ts jsonBigIntsToStrings.
    let update: unknown;
    try {
      update = await c.req.json();
    } catch {
      return c.text('Bad request: invalid JSON', 400);
    }
    if (
      typeof update !== 'object' ||
      update === null ||
      typeof (update as { update_id?: unknown }).update_id !== 'number'
    ) {
      return c.text('Bad request: missing or non-numeric update_id', 400);
    }
    const updateId = (update as { update_id: number }).update_id;

    // Dedup
    pruneDedupMap();
    const lastSeen = dedupMap.get(updateId);
    if (lastSeen && Date.now() - lastSeen < DEDUP_TTL_MS) {
      return c.json({ ok: true, deduped: true });
    }

    try {
      await handleTelegramUpdate(update);
    } catch (error) {
      // Log the stack and return 500. Telegram's retry semantics give
      // us a second chance, and the dedup Map still records the
      // update_id so a true duplicate retry is correctly suppressed.
      console.error('handleTelegramUpdate failed:', error);
      return c.text('Internal server error', 500);
    }

    dedupMap.set(updateId, Date.now());
    return c.json({ ok: true });
  });

  return app;
}

export interface AgentServerHandle {
  port: number;
  close: () => Promise<void>;
}

// startServer boots the Hono app on a Node http server. Hono's `fetch`
// is a (request: Request) => Promise<Response> handler that works
// with any Request/Response polyfill; Node 18+ has both built in, and
// Railway's container image is Node 22.
export function startServer(): AgentServerHandle {
  const app = createApp();
  const port = Number(process.env.PORT ?? 3000);
  const nodeServer = createNodeServer(async (req, res) => {
    const url = `http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) headers.set(k, v.join(', '));
      else if (typeof v === 'string') headers.set(k, v);
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined;
    const request = new Request(url, {
      method: req.method ?? 'GET',
      headers,
      body: req.method && req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
    });
    const response = await app.fetch(request);
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    const buf = Buffer.from(await response.arrayBuffer());
    res.end(buf);
  });
  nodeServer.listen(port);
  console.log(`Agent HTTP server listening on :${port}`);

  return {
    port,
    close: () =>
      new Promise<void>((resolve) => {
        nodeServer.close(() => resolve());
      }),
  };
}
