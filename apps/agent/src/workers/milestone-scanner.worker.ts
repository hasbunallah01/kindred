// This file used to define a BullMQ Worker for the milestone-scanner
// scheduled job. After the BullMQ removal (agent refactor), the
// dispatcher function lives in apps/agent/src/handlers.ts
// (runMilestoneScan) and is invoked on a setInterval from
// apps/agent/src/index.ts. The two helpers (findUpcomingAnniversaries,
// emitMilestoneEvents) and the lookahead constant stay here because
// they're the canonical owners of the anniversary-dedupe logic; the
// handlers module imports them by name via dynamic import.
import { prisma } from '@kindred/db';

// Re-export the scheduler entry point for any caller that still
// imports from the old path.
export { runMilestoneScan } from '../handlers';

// Checkpoint 51: daily cadence used to live here but moved to
// handlers.ts SCHEDULES — keep that single source of truth.
//
// How far ahead to look for upcoming anniversaries. Seven days gives
// the Mind and any downstream digest path a reasonable lead time to
// weave the milestone into a check-in or insight, while still being
// short enough that the daily run never accumulates a long backlog.
export const MILESTONE_LOOKAHEAD_DAYS = 7;

// Checkpoint 51: returns the start-of-day for the Nth anniversary of
// `firstSeenAt`, computed in UTC so the result is stable across
// servers in different timezones (a member's "join day" is recorded
// as a UTC instant; the calendar-day anniversaries are derived in
// the same coordinate system).
function anniversaryOn(firstSeenAt: Date, yearsSinceJoin: number): Date {
  const anniversary = new Date(firstSeenAt);
  anniversary.setUTCFullYear(anniversary.getUTCFullYear() + yearsSinceJoin);
  anniversary.setUTCHours(0, 0, 0, 0);
  return anniversary;
}

export interface AnniversaryCandidate {
  memberId: string;
  communityId: string;
  displayName: string;
  anniversary: Date;
  yearsSinceJoin: number;
}

export async function findUpcomingAnniversaries(
  communityId: string,
  now: Date,
  lookaheadCutoff: Date,
): Promise<AnniversaryCandidate[]> {
  // Pull every member of the community, then filter in code. The
  // Member table is expected to be small (hundreds, not millions) and
  // indexing by firstSeenAt's month/day directly in Postgres requires
  // expression indexes we don't have. A single findMany is simpler
  // and keeps the dedupe logic in one place.
  const members = await prisma.member.findMany({
    where: { communityId },
    select: { id: true, displayName: true, firstSeenAt: true },
  });

  const candidates: AnniversaryCandidate[] = [];

  for (const member of members) {
    if (Number.isNaN(member.firstSeenAt.getTime())) {
      continue; // Defensive: skip rows with a corrupt firstSeenAt rather
      // than throw and fail the whole pass.
    }

    const yearsSinceJoin = now.getUTCFullYear() - member.firstSeenAt.getUTCFullYear();

    // 0 means the member joined this calendar year — too fresh for a
    // "anniversary" milestone. Negative means the firstSeenAt is in
    // the future (shouldn't happen, but defensive). Both skip.
    if (yearsSinceJoin < 1) {
      continue;
    }

    const anniversary = anniversaryOn(member.firstSeenAt, yearsSinceJoin);

    // Anniversary is "approaching" when it falls in [now, now + lookahead].
    // Anniversaries strictly in the past are not emitted here — the
    // scanner is forward-looking by design. Anniversaries strictly
    // beyond the lookahead are picked up on a later pass.
    if (anniversary < now || anniversary > lookaheadCutoff) {
      continue;
    }

    candidates.push({
      memberId: member.id,
      communityId,
      displayName: member.displayName,
      anniversary,
      yearsSinceJoin,
    });
  }

  return candidates;
}

async function findAlreadyEmittedMilestones(
  memberIds: string[],
  anniversariesByMember: Map<string, Date>,
): Promise<Set<string>> {
  // Dedupe: a member+year pair should produce at most one milestone
  // event. The cleanest query is "is there any milestone event for
  // this member on this calendar day?" — we set the event's
  // occurredAt to start-of-day for the anniversary, so equality on
  // the day bucket uniquely identifies the (member, year) pair
  // without needing to read the JSON payload.
  const emitted = new Set<string>();

  for (const memberId of memberIds) {
    const anniversary = anniversariesByMember.get(memberId);
    if (!anniversary) {
      continue;
    }
    const dayStart = anniversary;
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    // The batch is small (one query per candidate) and the
    // alternative — a single findMany with an OR of (memberId,
    // day-range) tuples — is significantly more complex without a
    // meaningful win at this scale.
    const existing = await prisma.relationshipEvent.findFirst({
      where: {
        memberId,
        type: 'milestone',
        occurredAt: { gte: dayStart, lt: dayEnd },
      },
      select: { id: true },
    });
    if (existing) {
      emitted.add(memberId);
    }
  }

  return emitted;
}

export async function emitMilestoneEvents(candidates: AnniversaryCandidate[]): Promise<number> {
  if (candidates.length === 0) {
    return 0;
  }

  const anniversariesByMember = new Map<string, Date>();
  for (const candidate of candidates) {
    anniversariesByMember.set(candidate.memberId, candidate.anniversary);
  }
  const alreadyEmitted = await findAlreadyEmittedMilestones(
    candidates.map((c) => c.memberId),
    anniversariesByMember,
  );

  const toCreate = candidates.filter((c) => !alreadyEmitted.has(c.memberId));

  if (toCreate.length === 0) {
    return 0;
  }

  // payload.yearsSinceJoin lets the Mind (and any future reader) tell
  // which anniversary this event was emitted for without having to
  // compute it from occurredAt vs the member's firstSeenAt. The
  // occurredAt is the anniversary's start-of-day, not the moment the
  // scanner ran, so the timestamp itself is also a stable identifier
  // for the (member, year) pair.
  await prisma.relationshipEvent.createMany({
    // payload is typed as `Record<string, unknown>` for ergonomics;
    // Prisma's generated input type wants `Prisma.InputJsonValue`.
    // The values are JSON primitives (string, number), so the runtime
    // is fine — the cast mirrors the pre-existing pattern in
    // apps/agent/src/workers/telegram-ingest.worker.ts and
    // apps/agent/src/workers/mind-standing-check.worker.ts.
    data: toCreate.map((candidate) => ({
      memberId: candidate.memberId,
      type: 'milestone' as const,
      payload: {
        yearsSinceJoin: candidate.yearsSinceJoin,
        communityId: candidate.communityId,
      },
      occurredAt: candidate.anniversary,
    })) as never,
  });

  return toCreate.length;
}
