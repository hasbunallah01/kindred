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

async function main(): Promise<void> {
  console.log('agent started');
  console.log(`telegram-ingest worker listening (queue: ${telegramIngestWorker.name})`);

  await scheduleMindDigestSender();
  console.log(`mind-digest-sender worker listening (queue: ${mindDigestSenderWorker.name})`);

  await scheduleMindStandingCheck();
  console.log(`mind-standing-check worker listening (queue: ${mindStandingCheckWorker.name})`);
}

main().catch((error: unknown) => {
  console.error('Agent failed to start:', error);
  process.exit(1);
});
