// Kindred agent runtime entrypoint.
//
// This process is deployed on the VPS under PM2 (see Blueprint Section 12).
// It boots every BullMQ worker, the Minds SSE listener, and all scheduled
// jobs described in Blueprint Section 10 and 6. So far, only the
// telegram-ingest worker exists (Checkpoint 31) — the rest are added in
// later checkpoints.

import { telegramIngestWorker } from './workers/telegram-ingest.worker';

function main(): void {
  console.log('agent started');
  console.log(`telegram-ingest worker listening (queue: ${telegramIngestWorker.name})`);
}

main();
