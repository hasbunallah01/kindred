import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@kindred/db';
import { QUEUE_NAMES } from '@kindred/shared';
import { sendMessage } from '@kindred/minds-client';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Checkpoint 46: less frequent than the digest sender (Checkpoint 43,
// 15 minutes) — this is a periodic nudge for the Mind to actively
// evaluate its standing instructions (Checkpoint 45) against what it
// already knows, not a delivery mechanism for new event data. Hourly is
// a reasonable default; Blueprint Section 6.6 doesn't specify an exact
// cadence.
const STANDING_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const REPEAT_JOB_ID = 'mind-standing-check-recurring';

const standingCheckQueue = new Queue(QUEUE_NAMES.MIND_STANDING_CHECK, { connection });

export async function scheduleMindStandingCheck(): Promise<void> {
  await standingCheckQueue.add(
    'check-in',
    {},
    {
      repeat: { every: STANDING_CHECK_INTERVAL_MS },
      jobId: REPEAT_JOB_ID,
    },
  );
}

// Honest scope note: Blueprint Section 6.6 describes this job as
// "supplying the latest structured deltas" (e.g. members who went quiet
// or returned) alongside the check-in prompt. Those signals are produced
// by the inactivity-threshold-scanner and milestone-scanner (Build Plan
// Checkpoints 50-51, Phase 6) — explicitly out of scope for this pass.
// Right now every Member stays 'active' forever (nothing transitions
// that field yet), so there are no real deltas to report. This worker
// sends a lightweight, honest check-in with what's actually knowable
// today (a tracked-member count) rather than fabricating "deltas" from
// data that doesn't exist. Once Phase 6 exists, this is the function to
// extend with real transition data.
export const mindStandingCheckWorker = new Worker(
  QUEUE_NAMES.MIND_STANDING_CHECK,
  async () => {
    const communities = await prisma.community.findMany({
      where: { status: 'active', mindsConversationId: { not: null } },
    });

    for (const community of communities) {
      if (!community.mindsConversationId) {
        continue; // Narrows the type below; the query above already filters this.
      }

      const trackedMemberCount = await prisma.member.count({
        where: { communityId: community.id },
      });

      const checkInMessage =
        `Check-in for ${community.telegramChatTitle}: ${trackedMemberCount} tracked ` +
        'members so far. Please review your standing instructions against what you ' +
        'currently know and flag anything noteworthy.';

      await sendMessage(community.mindsConversationId, checkInMessage);
    }
  },
  { connection },
);

mindStandingCheckWorker.on('failed', (job, error) => {
  console.error(`mind-standing-check job ${job?.id ?? 'unknown'} failed:`, error);
});
