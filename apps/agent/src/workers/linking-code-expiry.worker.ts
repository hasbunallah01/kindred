import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@kindred/db';
import { QUEUE_NAMES } from '@kindred/shared';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Checkpoint 52: hourly cadence. Linking codes expire 15 minutes after
// issuance (apps/web/app/api/telegram/link/route.ts sets
// `EXPIRY_MINUTES = 15`). An expired code only stays around until the
// next cleanup pass, so a sub-hourly run rate is unnecessary — hourly
// matches the standing-check cadence and gives a worst-case row lifetime
// of ~75 minutes, which is well below any user-perceptible window for
// the data in question (an unconsumed short-lived auth code).
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const REPEAT_JOB_ID = 'linking-code-expiry-recurring';

const linkingCodeExpiryQueue = new Queue(QUEUE_NAMES.LINKING_CODE_EXPIRY, { connection });

export async function scheduleLinkingCodeExpiry(): Promise<void> {
  await linkingCodeExpiryQueue.add(
    'cleanup-expired-codes',
    {},
    {
      repeat: { every: CLEANUP_INTERVAL_MS },
      jobId: REPEAT_JOB_ID,
    },
  );
}

export const linkingCodeExpiryWorker = new Worker(
  QUEUE_NAMES.LINKING_CODE_EXPIRY,
  async () => {
    // Checkpoint 52: delete every TelegramLinkRequest whose expiresAt is
    // in the past AND that has not been consumed. The `consumedAt: null`
    // guard is the explicit "not consumed" filter — consumed rows
    // (consumedAt set) are kept as an audit trail of past successful
    // linkings, even after expiresAt passes, and valid (unexpired) rows
    // are obviously not deleted here.
    const result = await prisma.telegramLinkRequest.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        consumedAt: null,
      },
    });

    if (result.count > 0) {
      console.log(`linking-code-expiry removed ${result.count} expired unconsumed code(s).`);
    }
  },
  { connection },
);

linkingCodeExpiryWorker.on('failed', (job, error) => {
  console.error(`linking-code-expiry job ${job?.id ?? 'unknown'} failed:`, error);
});
