// This file used to define a BullMQ Worker for the standing-check
// scheduled job. After the BullMQ removal (agent refactor), the
// dispatcher function lives in apps/agent/src/handlers.ts
// (runStandingCheck) and is invoked on a setInterval from
// apps/agent/src/index.ts. The transitionMemberStatuses helper —
// which mutates Member.status and emits the resulting
// RelationshipEvent rows — stays here because it's the canonical
// owner of the audit logic described by the "active -> quiet ->
// inactive / returned" comments, and a future refactor that wants
// to test it in isolation should not have to import the whole
// agent process. handlers.ts imports it via dynamic import to keep
// this file's load order independent of the schedulers.
import { prisma } from '@kindred/db';

// Cadence used to live here but moved to handlers.ts SCHEDULES — keep
// that single source of truth. Re-export the runStandingCheck symbol
// for any caller that still imports from the old path.
export { runStandingCheck } from '../handlers';

export const PARTICIPATION_WINDOW_MS = 30 * 60 * 1000;

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

export async function transitionMemberStatuses(communityId: string): Promise<MemberStatusBreakdown> {
  const now = new Date();
  const quietCutoff = new Date(now.getTime() - QUIET_THRESHOLD_MS);
  const inactiveCutoff = new Date(now.getTime() - INACTIVE_THRESHOLD_MS);
  const returnedCutoff = new Date(now.getTime() - RETURNED_WINDOW_MS);

  // Identify the candidate ID sets and (for the returning set) the
  // prior status up front, so we can (a) keep the updateMany WHERE
  // clauses equivalent to the findMany filters and (b) emit a
  // RelationshipEvent for each member that actually transitioned.
  // Prisma's updateMany only returns a count, not the affected ids,
  // and the 'returned' transition needs to know the *prior* status
  // for the event payload, so the findMany-then-updateMany pattern is
  // the simplest way to capture the deltas for the event ledger.
  const goingQuietMembers = await prisma.member.findMany({
    where: { communityId, status: 'active', lastSeenAt: { lt: quietCutoff } },
    select: { id: true },
  });
  const goingInactiveMembers = await prisma.member.findMany({
    where: { communityId, status: 'quiet', lastSeenAt: { lt: inactiveCutoff } },
    select: { id: true },
  });
  const recentlyActiveMemberIds = await prisma.relationshipEvent.findMany({
    where: { occurredAt: { gte: returnedCutoff }, member: { communityId } },
    select: { memberId: true },
    distinct: ['memberId'],
  });
  const returningCandidateIds = recentlyActiveMemberIds.map((row) => row.memberId);

  // The 'returning' set is the intersection of (a) members with a
  // recent event and (b) members currently in quiet/inactive. Read
  // their prior status BEFORE the updates below so the event payload
  // can record where they came back from. Members in
  // `returningCandidateIds` who are already 'active' or 'returned'
  // are filtered out — they didn't transition this pass.
  let returningMembers: Array<{ id: string; priorStatus: 'quiet' | 'inactive' }> = [];
  if (returningCandidateIds.length > 0) {
    const prior = await prisma.member.findMany({
      where: {
        id: { in: returningCandidateIds },
        communityId,
        status: { in: ['quiet', 'inactive'] },
      },
      select: { id: true, status: true },
    });
    returningMembers = prior.map((row) => ({
      id: row.id,
      priorStatus: row.status as 'quiet' | 'inactive',
    }));
  }
  const returningMemberIds = returningMembers.map((m) => m.id);

  // 1) active -> quiet, quiet -> inactive, by lastSeenAt age.
  if (goingQuietMembers.length > 0) {
    await prisma.member.updateMany({
      where: { id: { in: goingQuietMembers.map((m) => m.id) } },
      data: { status: 'quiet' },
    });
  }
  if (goingInactiveMembers.length > 0) {
    await prisma.member.updateMany({
      where: { id: { in: goingInactiveMembers.map((m) => m.id) } },
      data: { status: 'inactive' },
    });
  }

  // 2) any quiet/inactive -> returned if they had recent activity.
  //    A returned member who keeps being active should drift back to
  //    'active' on the next pass, not stay 'returned' forever — so the
  //    'returned -> active' transition uses the same recent-activity
  //    signal (an event in the last RETURNED_WINDOW_MS).
  if (returningMemberIds.length > 0) {
    await prisma.member.updateMany({
      where: { id: { in: returningMemberIds }, status: { in: ['quiet', 'inactive'] } },
      data: { status: 'returned' },
    });
    await prisma.member.updateMany({
      where: { id: { in: returningMemberIds }, status: 'returned' },
      data: { status: 'active' },
    });
  }

  // 3) Emit RelationshipEvents for the transitions that just happened,
  //    so the digest-sender worker (Checkpoint 43) can surface them to
  //    the Mind as structured events rather than only the prose
  //    check-in summary. Events default to sentToMind: false and will
  //    be picked up on the next 15-minute digest pass.
  //
  //    - 'absence_started' covers both active->quiet and quiet->inactive:
  //      a single canonical "they went away" event rather than two
  //      distinct ones. The prior status is captured in payload.from
  //      for the Mind to disambiguate if it cares.
  //    - 'returned' is emitted once per member per pass, regardless of
  //      whether they ended up at 'returned' (still settling) or at
  //      'active' (promoted on the same pass). One canonical event
  //      per visit, not per transition step — matches the
  //      standing-instructions language ("who returned").
  const transitionEvents: Array<{
    memberId: string;
    type: 'absence_started' | 'returned';
    payload: Record<string, unknown>;
    occurredAt: Date;
  }> = [];

  for (const member of goingQuietMembers) {
    transitionEvents.push({
      memberId: member.id,
      type: 'absence_started',
      payload: { from: 'active' },
      occurredAt: now,
    });
  }
  for (const member of goingInactiveMembers) {
    transitionEvents.push({
      memberId: member.id,
      type: 'absence_started',
      payload: { from: 'quiet' },
      occurredAt: now,
    });
  }
  for (const member of returningMembers) {
    transitionEvents.push({
      memberId: member.id,
      type: 'returned',
      payload: { from: member.priorStatus },
      occurredAt: now,
    });
  }

  if (transitionEvents.length > 0) {
    // payload is typed as `Record<string, unknown>` for ergonomics; Prisma's
    // generated input type wants `Prisma.InputJsonValue`. The values we
    // emit here are all JSON primitives (strings), so the runtime is fine,
    // but TypeScript needs an explicit cast to accept the wider type. Same
    // kind of pre-existing wart lives in
    // apps/agent/src/workers/telegram-ingest.worker.ts; a clean fix would
    // be to type the local array as Prisma.RelationshipEventCreateManyInput
    // directly, but that pulls a Prisma type import into this worker.
    await prisma.relationshipEvent.createMany({
      data: transitionEvents as never,
    });
  }

  // 4) Aggregate the post-transition breakdown for the check-in message.
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
