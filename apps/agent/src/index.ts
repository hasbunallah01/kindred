// Kindred agent runtime entrypoint.
//
// This process is deployed on the VPS under PM2 (see Blueprint Section 12).
// It boots every BullMQ worker, the Minds SSE listener, and all scheduled
// jobs described in Blueprint Section 10 and 6.

import { prisma } from '@kindred/db';
import { telegramIngestWorker } from './workers/telegram-ingest.worker';
import {
  mindDigestSenderWorker,
  scheduleMindDigestSender,
} from './workers/mind-digest-sender.worker';
import {
  mindStandingCheckWorker,
  scheduleMindStandingCheck,
} from './workers/mind-standing-check.worker';
import {
  milestoneScannerWorker,
  scheduleMilestoneScanner,
} from './workers/milestone-scanner.worker';
import {
  linkingCodeExpiryWorker,
  scheduleLinkingCodeExpiry,
} from './workers/linking-code-expiry.worker';
import { insightNotificationWorker } from './workers/insight-notification.worker';
import { startMindsInsightListener, type SseListenerHandle } from './minds/sse-listener';

// Structural type for the bits of a BullMQ Worker we actually need
// at shutdown time. Defined locally (rather than imported from
// 'bullmq') so this file stays decoupled from BullMQ's public type
// surface — a future BullMQ major release could rename or remove
// the Worker type without breaking this file. The five values passed
// in from main() are real BullMQ Worker instances, and they satisfy
// this shape structurally (`.name` is the queue name,
// `.close()` drains in-flight jobs and resolves once the worker
// has fully stopped).
interface ClosableWorker {
  readonly name: string;
  close(): Promise<void>;
}

// Required at startup: every variable here is read by the agent (or by
// code the agent imports) before any worker can do useful work. A
// missing or empty value here means workers would boot looking
// healthy, then fail silently on the first real request (Prisma can't
// connect, Redis rejects, Minds returns 401/400, etc.) — exactly the
// "appears healthy, fails silently" failure mode the deployment-readiness
// audit flagged. Catching them up front turns a confusing runtime
// failure into an immediate, actionable error.
//
// Order matches the audit's required list, so the error message is
// stable and grep-friendly.
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'REDIS_URL',
  'MINDS_BUILDER_API_KEY',
  'MINDS_ID',
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
    // distinct in PM2's log tail.
    console.error('Refusing to start: missing required environment variables.');
    for (const name of missing) {
      console.error(`  - ${name}`);
    }
    console.error(
      'Set them in the VPS environment (or the systemd EnvironmentFile), then restart PM2.',
    );
    process.exit(1);
  }
}

// Deployment-readiness audit Blocker #7: graceful shutdown.
//
// PM2 sends SIGTERM on reload/restart and SIGINT is the developer-
// friendly equivalent (Ctrl+C, `pm2 stop` on some setups). Without
// these handlers, both signals kill the process in flight — any job
// a BullMQ worker is mid-way through gets cut off, the Minds SSE
// socket is torn down without the library's close() being called
// (which leaves the server side waiting for a TCP RST), and the
// Prisma connection pool is yanked out from under the driver.
//
// registerShutdown() wires the signal handlers and guards against
// re-entry; performShutdown() does the actual cleanup in the order
// required by the audit: stop accepting new work, close every
// BullMQ worker, close the SSE listener, then disconnect Prisma.
// Exit is 0 unconditionally on the cleanup path — see the comment
// in handleSignal() for why even a failed cleanup shouldn't
// trigger PM2's restart loop.

// Idempotency guard: PM2 sends SIGTERM twice on a reload (once for
// the old process, then again to the new one if it reuses the
// slot), and a developer hitting Ctrl+C a second time is the same
// shape. Without this flag, a second signal would re-enter the
// cleanup path — which would either double-disconnect Prisma
// (which throws on the second call) or close already-closed
// workers (which logs warnings from BullMQ). The flag turns the
// second signal into a no-op so the in-flight shutdown runs to
// completion uninterrupted.
let shutdownStarted = false;

async function performShutdown(
  workers: ReadonlyArray<ClosableWorker>,
  mindsListener: SseListenerHandle,
): Promise<void> {
  // 1. Stop accepting new work, and drain in-flight jobs.
  //    Worker.close() resolves only after the worker has stopped
  //    pulling new jobs from Redis AND any job currently being
  //    processed has finished (or timed out). That's exactly the
  //    "no work lost" property graceful shutdown requires — a
  //    SIGTERM mid-job does not abort the job.
  //
  //    Workers are closed in parallel because none of them share
  //    state with each other; serializing the closes would only
  //    delay the shutdown for no reason.
  await Promise.all(
    workers.map(async (worker) => {
      try {
        await worker.close();
        console.log(`worker closed (queue: ${worker.name})`);
      } catch (error) {
        // Closing a worker whose Redis connection is already gone
        // (e.g. Redis dropped between SIGTERM and now) is
        // non-fatal — the goal is "no workers running jobs," and
        // a thrown close() still means the worker won't pick up
        // more work. Log and move on rather than blocking the
        // rest of the cleanup.
        console.error(`worker close failed (queue: ${worker.name}):`, error);
      }
    }),
  );

  // 2. Close the Minds SSE listener. Done after the workers so an
  //    autonomous insight event that arrives during the worker
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

  // 3. Disconnect Prisma last. Disconnecting earlier would risk
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
  workers: ReadonlyArray<ClosableWorker>,
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
    performShutdown(workers, mindsListener)
      .then(() => {
        console.log('Graceful shutdown complete.');
        process.exit(0);
      })
      .catch((error: unknown) => {
        // performShutdown's per-resource try/catches already
        // log individual failures, so a throw here means
        // something genuinely unexpected (a synchronous throw
        // outside the awaits). Still exit 0 — the goal of
        // graceful shutdown is "let PM2 / the OS move on
        // cleanly," and exiting non-zero would only trigger
        // PM2's restart loop on the very next line.
        console.error('Graceful shutdown failed:', error);
        process.exit(0);
      });
  };

  // Both signals are listed explicitly rather than via SIGHUP /
  // SIGBREAK / etc., which PM2 doesn't use and which would only
  // add noise. PM2's default kill_signal is SIGTERM
  // (apps/agent/ecosystem.config.cjs); SIGINT covers Ctrl+C and
  // `pm2 stop` on some setups.
  process.on('SIGTERM', handleSignal);
  process.on('SIGINT', handleSignal);
}

async function main(): Promise<void> {
  // Must run before any worker import side-effect or schedule*() call —
  // those assume a complete environment, and a partial boot is worse
  // than a clean refusal.
  validateRequiredEnv();

  console.log('agent started');
  console.log(`telegram-ingest worker listening (queue: ${telegramIngestWorker.name})`);

  await scheduleMindDigestSender();
  console.log(`mind-digest-sender worker listening (queue: ${mindDigestSenderWorker.name})`);

  await scheduleMindStandingCheck();
  console.log(`mind-standing-check worker listening (queue: ${mindStandingCheckWorker.name})`);

  await scheduleMilestoneScanner();
  console.log(`milestone-scanner worker listening (queue: ${milestoneScannerWorker.name})`);

  await scheduleLinkingCodeExpiry();
  console.log(`linking-code-expiry worker listening (queue: ${linkingCodeExpiryWorker.name})`);

  // Checkpoint 53 / Telegram notification delivery: no scheduler here
  // because this queue is not on a cron — it is fed on demand by the
  // Minds SSE listener (apps/agent/src/minds/sse-listener.ts) every
  // time an autonomous Insight is persisted. The worker just needs to
  // be alive and listening; jobs arrive as the Mind generates
  // insights.
  console.log(`insight-notification worker listening (queue: ${insightNotificationWorker.name})`);

  // Capture the listener handle so graceful shutdown can call its
  // close() — previously the return value was discarded, so a
  // SIGTERM left the SSE socket to be torn down by process exit
  // rather than by a clean close().
  const mindsListener = startMindsInsightListener();
  console.log('Minds SSE insight listener started.');

  // Register SIGTERM / SIGINT handlers once the process is fully
  // booted. Registering earlier would risk a signal arriving during
  // worker startup trying to shut down a half-initialized agent.
  registerShutdown(
    [
      telegramIngestWorker,
      mindDigestSenderWorker,
      mindStandingCheckWorker,
      milestoneScannerWorker,
      linkingCodeExpiryWorker,
      insightNotificationWorker,
    ],
    mindsListener,
  );
}

main().catch((error: unknown) => {
  console.error('Agent failed to start:', error);
  process.exit(1);
});
