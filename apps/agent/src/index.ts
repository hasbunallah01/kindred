// Kindred agent runtime entrypoint.
//
// This process is deployed to Railway (was previously a VPS under PM2).
// It boots the HTTP server (apps/agent/src/server.ts), the Minds SSE
// listener, and three in-process setInterval schedulers (digest /
// standing check / milestone scan). The linking-code-expiry cadence is
// preserved by `expiresAt < new Date()` checks inside the existing
// handlers — no interval needed.

import { prisma } from '@kindred/db';
import { startServer, type AgentServerHandle } from './server';
import { runStandingCheck, runMilestoneScan, SCHEDULES } from './handlers';
import { startMindsInsightListener, type SseListenerHandle } from './minds/sse-listener';

// Structural type for the setInterval handles we register at boot.
// Defined locally (rather than imported from node:timers) so this
// file stays decoupled from any particular Node API surface. A
// NodeJS.Timeout is returned by setInterval; clearInterval accepts
// any object structurally.
interface IntervalHandle {
  unref(): void;
  ref(): void;
  hasRef(): boolean;
  refresh(): void;
  [Symbol.dispose](): void;
}

// Required at startup: every variable here is read by the agent (or by
// code the agent imports) before any handler can do useful work. A
// missing or empty value here means the agent would boot looking
// healthy, then fail silently on the first real request (Prisma can't
// connect, Telegram returns 401/400, Minds returns 401, the HTTP
// server rejects every webhook with 401, etc.) — exactly the
// "appears healthy, fails silently" failure mode the deployment-
// readiness audit flagged. Catching them up front turns a confusing
// runtime failure into an immediate, actionable error.
//
// Note that REDIS_URL is no longer in the list — the agent no longer
// has a Redis dependency. AGENT_INGEST_SECRET is added: the HTTP
// server's auth check reads it on every webhook POST, and the server
// refuses to authenticate anything if it's missing (we treat a
// missing secret as a deployment misconfiguration, not a runtime
// convenience).
//
// Order matches the audit's required list, so the error message is
// stable and grep-friendly.
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'TELEGRAM_BOT_TOKEN',
  'MINDS_BUILDER_API_KEY',
  'MINDS_ID',
  'AGENT_INGEST_SECRET',
] as const;

function validateRequiredEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((name) => {
    const value = process.env[name];
    return value === undefined || value === '';
  });

  if (missing.length > 0) {
    // One log line per missing var (rather than a single comma-joined
    // list) so a grep for the variable name finds it; the final blank
    // line separates the diagnostic from the exit so it's visually
    // distinct in Railway's log tail.
    console.error('Refusing to start: missing required environment variables.');
    for (const name of missing) {
      console.error(`  - ${name}`);
    }
    console.error(
      'Set them in the Railway service env, then trigger a redeploy.',
    );
    process.exit(1);
  }
}

// Deployment-readiness audit Blocker #7: graceful shutdown.
//
// Railway sends SIGTERM on every redeploy and on every container
// stop; SIGINT is the developer-friendly equivalent (Ctrl+C, the
// Docker CLI sending stop). Without these handlers, both signals
// kill the process in flight — the HTTP server's keep-alive
// connections get RST'd (not closed), the SSE listener is torn
// down without the library's close() being called (which leaves
// the server side waiting for a TCP RST), and the Prisma
// connection pool is yanked out from under the driver.
//
// registerShutdown() wires the signal handlers and guards against
// re-entry; performShutdown() does the actual cleanup in the order
// required by the audit: stop the HTTP server first (so no new
// webhook requests are accepted), clear the three setInterval
// timers (so no scheduled job can fire mid-shutdown), close the
// SSE listener, then disconnect Prisma. Exit is 0 unconditionally
// on the cleanup path — see the comment in handleSignal() for why
// even a failed cleanup shouldn't trigger Railway's restart loop.

// Idempotency guard: Railway sends SIGTERM twice on a redeploy if
// the new container takes the slot before the old one finishes
// draining, and a developer hitting Ctrl+C a second time is the
// same shape. Without this flag, a second signal would re-enter
// the cleanup path — which would either double-disconnect Prisma
// (which throws on the second call) or close already-closed
// resources (which logs warnings). The flag turns the second
// signal into a no-op so the in-flight shutdown runs to
// completion uninterrupted.
let shutdownStarted = false;

async function performShutdown(
  serverHandle: AgentServerHandle,
  intervals: ReadonlyArray<IntervalHandle>,
  mindsListener: SseListenerHandle,
): Promise<void> {
  // 1. Stop the HTTP server. Closing here means the agent refuses
  //    new requests immediately, but lets any in-flight handler
  //    finish (Node's http.Server.close drains keep-alive
  //    connections). The webhook will see a connection error and
  //    retry, which is the correct behavior.
  try {
    await serverHandle.close();
    console.log(`HTTP server closed (port: ${serverHandle.port})`);
  } catch (error) {
    // A failed close() still means the server won't accept new
    // connections, so the cleanup goal is met. Log and continue.
    console.error('HTTP server close failed:', error);
  }

  // 2. Clear the scheduled-job timers. Doing this before SSE
  //    close means an in-flight scheduled job (e.g. a digest pass
  //    that's mid-loop over communities) cannot spawn a fresh
  //    Prisma query after we've started the Prisma disconnect in
  //    step 4. setInterval handles are unref'd so a stray timer
  //    can't keep the process alive after we initiate exit.
  for (const interval of intervals) {
    clearInterval(interval as unknown as NodeJS.Timeout);
  }
  console.log(`Cleared ${intervals.length} scheduled timer(s).`);

  // 3. Close the Minds SSE listener. Done after the timers so an
  //    autonomous insight event that arrives during the timer
  //    drain has a Prisma connection to write through; the
  //    listener's own close() also clears any pending reconnect
  //    timer, so this is a true disconnect, not "let the next
  //    error kill it."
  try {
    mindsListener.close();
    console.log('Minds SSE listener closed.');
  } catch (error) {
    console.error('Minds SSE listener close failed:', error);
  }

  // 4. Disconnect Prisma last. Disconnecting earlier would risk
  //    leaving the worker callbacks still draining in step 1 with
  //    a half-closed connection if any of them tried one more
  //    query. The idempotency guard at the call site
  //    (shutdownStarted) means this runs exactly once.
  try {
    await prisma.$disconnect();
    console.log('Prisma disconnected.');
  } catch (error) {
    console.error('Prisma disconnect failed:', error);
  }
}

function registerShutdown(
  serverHandle: AgentServerHandle,
  intervals: ReadonlyArray<IntervalHandle>,
  mindsListener: SseListenerHandle,
): void {
  const handleSignal = (signal: NodeJS.Signals): void => {
    if (shutdownStarted) {
      // Second signal during shutdown: do nothing. The
      // in-flight cleanup must not be disturbed — a real "force
      // exit if you really mean it" is SIGKILL, which we don't
      // need to handle here.
      console.warn(`Received ${signal} during shutdown — ignoring.`);
      return;
    }
    shutdownStarted = true;

    console.log(`Received ${signal} — starting graceful shutdown.`);

    // We deliberately don't await performShutdown() inside the
    // handler — the signal-handler return value isn't observed,
    // and a synchronous return keeps the handler well-behaved.
    // The actual cleanup runs in the .then/.catch chain below,
    // and process.exit(0) only fires after it finishes, so the
    // exit still waits for cleanup. Using a .then/.catch (rather
    // than `void performShutdown(...)`) also gives us a single
    // place to handle the "the whole thing blew up" case.
    performShutdown(serverHandle, intervals, mindsListener)
      .then(() => {
        console.log('Graceful shutdown complete.');
        process.exit(0);
      })
      .catch((error: unknown) => {
        // performShutdown's per-resource try/catches already
        // log individual failures, so a throw here means
        // something genuinely unexpected (a synchronous throw
        // outside the awaits). Still exit 0 — the goal of
        // graceful shutdown is "let Railway / the OS move on
        // cleanly," and exiting non-zero would only trigger
        // Railway's restart loop on the very next line.
        console.error('Graceful shutdown failed:', error);
        process.exit(0);
      });
  };

  // Both signals are listed explicitly rather than via SIGHUP /
  // SIGBREAK / etc., which Railway doesn't use and which would
  // only add noise.
  process.on('SIGTERM', handleSignal);
  process.on('SIGINT', handleSignal);
}

async function main(): Promise<void> {
  // Must run before any handler import side-effect or setInterval
  // start — those assume a complete environment, and a partial
  // boot is worse than a clean refusal.
  validateRequiredEnv();

  console.log('agent started');

  // 1. HTTP server first — Telegram webhooks are the most time-
  //    sensitive ingress and a /healthz response is what Railway
  //    uses to decide the container is "ready" (the railway.toml
  //    healthcheck path is /healthz). Until this boots, every
  //    inbound webhook is failing.
  const serverHandle = startServer();
  console.log(`telegram-ingest HTTP server listening on :${serverHandle.port}`);

  // 2. Scheduled housekeeping — three setInterval timers at the
  //    original BullMQ cadences. Each timer calls a pure function
  //    in handlers.ts that runs synchronously and logs the result
  //    on completion; an exception is caught by the timer's own
  //    .on('error') wrapper (Node's setInterval catches and
  //    emits 'error' on the underlying Timer object, which Node's
  //    behavior is to log if unhandled).
  const intervals: IntervalHandle[] = [];

  // Digest: DISABLED for the demo. The Mind's autonomous cadence
  // was producing a "Nth check-in" insight every 15 minutes —
  // accurate, but not useful as a dashboard hero. The handler
  // remains in handlers.ts (runDigest) so it can be re-enabled
  // behind a feature flag once the Mind learns to gate insights
  // on actual signal. For now: only inbound webhooks (real
  // messages) drive new insight rows.

  // Standing check: 1h. Re-evaluates Member.status and pings each Mind.
  intervals.push(
    setInterval(() => {
      runStandingCheck().catch((err) =>
        console.error('runStandingCheck failed (will retry on next tick):', err),
      );
    }, SCHEDULES.standingCheck) as unknown as IntervalHandle,
  );
  console.log(`mind-standing-check scheduled (every ${SCHEDULES.standingCheck / 60000}m)`);

  // Milestone scan: 24h. Emits anniversary events for upcoming
  // member milestones.
  intervals.push(
    setInterval(() => {
      runMilestoneScan().catch((err) =>
        console.error('runMilestoneScan failed (will retry on next tick):', err),
      );
    }, SCHEDULES.milestoneScan) as unknown as IntervalHandle,
  );
  console.log(`milestone-scanner scheduled (every ${SCHEDULES.milestoneScan / 3_600_000}h)`);

  // 3. Minds SSE listener — independent of the timers above; reads
  //    autonomous insight events from the Minds server and writes
  //    them to Postgres.
  const mindsListener = startMindsInsightListener();
  console.log('Minds SSE insight listener started.');

  // 4. Register SIGTERM / SIGINT handlers once the process is
  //    fully booted. Registering earlier would risk a signal
  //    arriving during HTTP startup trying to shut down a
  //    half-initialized agent.
  registerShutdown(serverHandle, intervals, mindsListener);
}

main().catch((error: unknown) => {
  console.error('Agent failed to start:', error);
  process.exit(1);
});
