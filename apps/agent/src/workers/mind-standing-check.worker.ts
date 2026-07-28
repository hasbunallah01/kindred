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

// Audit fix: Member.status used to never update — every member stayed
// 'active' forever, so the standing instructions
// (packages/minds-client/index.ts STANDING_INSTRUCTIONS, "who went
// quiet") had no real signal to work with. The transitions below are
// deliberately simple threshold rules derived from Member.lastSeenAt
// and recent RelationshipEvents:
//
//   active   -> quiet      when lastSeenAt is older than QUIET_THRESHOLD_MS
//   quiet    -> inactive   when lastSeenAt is older than INACTIVE_THRESHOLD_MS
//   *        -> returned   when a RelationshipEvent appeared in the last
//                         RETURNED_WINDOW_MS (catches both 'quiet' and
//                         'inactive' members coming back)
//   returned -> active     when a further RelationshipEvent happened in
//                         RETURNED_WINDOW_MS (they've stayed active)
//
// Thresholds are conservative defaults — the Blueprint's inactivity
// scanner (Checkpoints 50-51) is the real, tunable place to set these
// per-community; this worker just needs the field to move.
const QUIET_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
const INACTIVE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;
const RETURNED_WINDOW_MS = 24 * 60 * 60 * 1000;

interface MemberStatusBreakdown {
  active: number;
  quiet: number;
  inactive: number;
  returned: number;
}

async function transitionMemberStatuses(communityId: string): Promise<MemberStatusBreakdown> {
  const now = new Date();
  const quietCutoff = new Date(now.getTime() - QUIET_THRESHOLD_MS);
  const inactiveCutoff = new Date(now.getTime() - INACTIVE_THRESHOLD_MS);
  const returnedCutoff = new Date(now.getTime() - RETURNED_WINDOW_MS);

  // 1) active -> quiet, quiet -> inactive, by lastSeenAt age.
  await prisma.member.updateMany({
    where: { communityId, status: 'active', lastSeenAt: { lt: quietCutoff } },
    data: { status: 'quiet' },
  });
  await prisma.member.updateMany({
    where: { communityId, status: 'quiet', lastSeenAt: { lt: inactiveCutoff } },
    data: { status: 'inactive' },
  });

  // 2) any quiet/inactive -> returned if they had recent activity.
  //    A returned member who keeps being active should drift back to
  //    'active' on the next pass, not stay 'returned' forever — so the
  //    'returned -> active' transition uses the same recent-activity
  //    signal (an event in the last RETURNED_WINDOW_MS).
  const recentlyActiveMemberIds = await prisma.relationshipEvent.findMany({
    where: { occurredAt: { gte: returnedCutoff }, member: { communityId } },
    select: { memberId: true },
    distinct: ['memberId'],
  });
  const memberIds = recentlyActiveMemberIds.map((row) => row.memberId);
  if (memberIds.length > 0) {
    await prisma.member.updateMany({
      where: { id: { in: memberIds }, status: { in: ['quiet', 'inactive'] } },
      data: { status: 'returned' },
    });
    await prisma.member.updateMany({
      where: { id: { in: memberIds }, status: 'returned' },
      data: { status: 'active' },
    });
  }

  // 3) Aggregate the post-transition breakdown for the check-in message.
  const groups = await prisma.member.groupBy({
    by: ['status'],
    where: { communityId },
    _count: { _all: true },
  });
  const breakdown: MemberStatusBreakdown = { active: 0, quiet: 0, inactive: 0, returned: 0 };
  for (const group of groups) {
    breakdown[group.status] = group._count._all;
  }
  return breakdown;
}

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

      const breakdown = await transitionMemberStatuses(community.id);
      const totalMembers = breakdown.active + breakdown.quiet + breakdown.inactive + breakdown.returned;

      // Real deltas now, not just a tracked count — the standing
      // instructions (who went quiet, who returned) have actual signals
      // to act on. 'returned' is surfaced as its own line so the Mind
      // can pick it out specifically; 'active' and 'inactive' are
      // summarized for context.
      const checkInMessage =
        `Check-in for ${community.telegramChatTitle}: ${totalMembers} tracked members ` +
        `(${breakdown.active} active, ${breakdown.quiet} quiet, ${breakdown.inactive} inactive, ` +
        `${breakdown.returned} recently returned). Please review your standing instructions ` +
        'against what you currently know and flag anything noteworthy.';

      await sendMessage(community.mindsConversationId, checkInMessage);
    }
  },
  { connection },
);

mindStandingCheckWorker.on('failed', (job, error) => {
  console.error(`mind-standing-check job ${job?.id ?? 'unknown'} failed:`, error);
});
