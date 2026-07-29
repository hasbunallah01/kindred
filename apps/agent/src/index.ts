// Kindred agent runtime entrypoint.
//
// This process is deployed on the VPS under PM2 (see Blueprint Section 12).
// It boots every BullMQ worker, the Minds SSE listener, and all scheduled
// jobs described in Blueprint Section 10 and 6.

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
import { startMindsInsightListener } from './minds/sse-listener';

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
    console.error('Set them in the VPS environment (or the systemd EnvironmentFile), then restart PM2.');
    process.exit(1);
  }
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

  startMindsInsightListener();
  console.log('Minds SSE insight listener started.');
}

main().catch((error: unknown) => {
  console.error('Agent failed to start:', error);
  process.exit(1);
});
