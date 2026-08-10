// Thin re-export layer. The HTTP server (server.ts) imports
// `handleTelegramUpdate` from here; the timer-scheduled functions
// `runDigest` / `runStandingCheck` / `runMilestoneScan` are also
// exported from this module so index.ts has a single import site for
// everything the agent does outside of the SSE listener and Prisma
// shutdown.

import { prisma } from '@kindred/db';
import { sendMessage } from '@kindred/minds-client';

// The single entry point the HTTP server calls for every Telegram
// update. Re-exported from the worker file (kept as the natural home
// for the dispatch + handler bodies) so this module is the only
// thing the HTTP layer needs to know about.
export { handleTelegramUpdate } from './workers/telegram-ingest.worker';

// Cadence matches the original BullMQ `repeat: { every }` settings:
//   - digest:       15m  (was 'every: 900000' in mind-digest-sender.worker.ts)
//   - standingCheck: 1h  (was 'every: 3600000' in mind-standing-check.worker.ts)
//   - milestoneScan: 24h (was 'every: 86400000' in milestone-scanner.worker.ts)
//
// Linked-code-expiry had a 1h cadence too, but its behavior is now
// preserved by the `expiresAt < new Date()` guard inside
// handleStartCommand and handleLinkingCode. The worker is deleted
// (apps/agent/src/workers/linking-code-expiry.worker.ts) and no
// timer is needed — unconsumed expired rows are harmless and can be
// cleaned up manually if desired. Post-hackathon: persist processed
// update_ids in Postgres and consider replacing the
// deleteMany-by-expiry with an on-demand cleanup.
export const SCHEDULES = {
  digest: 15 * 60 * 1000,
  standingCheck: 60 * 60 * 1000,
  milestoneScan: 24 * 60 * 60 * 1000,
} as const;

// ---------------------------------------------------------------------------
// Scheduled housekeeping — three functions, three setInterval timers
// in index.ts. Each mirrors the body of the former BullMQ Worker's
// processor function, minus the `Job` wrapper and the Redis
// `connection`.
// ---------------------------------------------------------------------------

// messagePreviewOf / whenOf / formatDigest used to live at the bottom
// of mind-digest-sender.worker.ts. Co-located with runDigest here
// because they're only used by this function.
interface DigestEvent {
  type: string;
  payload: unknown;
  occurredAt: Date;
  member: { displayName: string };
}

function messagePreviewOf(payload: unknown): string {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'messagePreview' in payload &&
    typeof (payload as { messagePreview?: unknown }).messagePreview === 'string'
  ) {
    const s = (payload as { messagePreview: string }).messagePreview;
    return s.length > 80 ? `${s.slice(0, 80)}…` : s;
  }
  return '';
}

function whenOf(occurredAt: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - occurredAt.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDigest(communityTitle: string, events: DigestEvent[]): string {
  const lines = events.map((event) => {
    switch (event.type) {
      case 'joined':
        return `- ${event.member.displayName} joined (${whenOf(event.occurredAt)})`;
      case 'first_interaction':
        return `- ${event.member.displayName}'s first message: "${messagePreviewOf(event.payload)}" (${whenOf(event.occurredAt)})`;
      case 'participation':
        return `- ${event.member.displayName} was active (${whenOf(event.occurredAt)})`;
      case 'creator_interaction':
        return `- You replied to ${event.member.displayName}: "${messagePreviewOf(event.payload)}" (${whenOf(event.occurredAt)})`;
      default:
        return `- ${event.member.displayName}: ${event.type} (${whenOf(event.occurredAt)})`;
    }
  });
  return `Relationship update for ${communityTitle}:\n${lines.join('\n')}`;
}

export async function runDigest(): Promise<void> {
  const communities = await prisma.community.findMany({
    where: { status: 'active', mindsConversationId: { not: null } },
  });
  for (const community of communities) {
    if (!community.mindsConversationId) continue;
    const pendingEvents = await prisma.relationshipEvent.findMany({
      where: {
        sentToMind: false,
        member: { communityId: community.id },
      },
      include: { member: true },
      orderBy: { occurredAt: 'asc' },
    });
    if (pendingEvents.length === 0) continue;
    const digestText = formatDigest(community.telegramChatTitle, pendingEvents);
    await sendMessage(community.mindsConversationId, digestText);
    const sentAt = new Date();
    await prisma.relationshipEvent.updateMany({
      where: { id: { in: pendingEvents.map((e) => (e as DigestEvent & { id: string }).id) } },
      data: { sentToMind: true, sentToMindAt: sentAt },
    });
  }
}

// Mind standing check: same body as the former BullMQ Worker
// processor. `transitionMemberStatuses` is still defined in the
// former worker file (mind-standing-check.worker.ts) and re-imported
// here to keep the helper local to its owner module.
export async function runStandingCheck(): Promise<void> {
  const { transitionMemberStatuses } = await import('./workers/mind-standing-check.worker');
  const communities = await prisma.community.findMany({
    where: { status: 'active', mindsConversationId: { not: null } },
  });
  for (const community of communities) {
    if (!community.mindsConversationId) continue;
    const breakdown = await transitionMemberStatuses(community.id);
    const totalMembers =
      breakdown.active + breakdown.quiet + breakdown.inactive + breakdown.returned;
    const checkInMessage =
      `Check-in for ${community.telegramChatTitle}: ${totalMembers} tracked members ` +
      `(${breakdown.active} active, ${breakdown.quiet} quiet, ${breakdown.inactive} inactive, ` +
      `${breakdown.returned} recently returned). Please review your standing instructions ` +
      'against what you currently know and flag anything noteworthy.';
    await sendMessage(community.mindsConversationId, checkInMessage);
  }
}

// Milestone scan: same body as the former BullMQ Worker processor.
// `findUpcomingAnniversaries` / `emitMilestoneEvents` /
// `MILESTONE_LOOKAHEAD_DAYS` are still defined in the former worker
// file (milestone-scanner.worker.ts) and re-imported here.
export async function runMilestoneScan(): Promise<void> {
  const { findUpcomingAnniversaries, emitMilestoneEvents, MILESTONE_LOOKAHEAD_DAYS } =
    await import('./workers/milestone-scanner.worker');
  const communities = await prisma.community.findMany({
    where: { status: 'active' },
    select: { id: true },
  });
  let totalEmitted = 0;
  const now = new Date();
  const lookaheadCutoff = new Date(now.getTime() + MILESTONE_LOOKAHEAD_DAYS * 86_400_000);
  for (const community of communities) {
    const candidates = await findUpcomingAnniversaries(community.id, now, lookaheadCutoff);
    const emitted = await emitMilestoneEvents(candidates);
    totalEmitted += emitted;
  }
  if (totalEmitted > 0) {
    console.log(`milestone-scanner emitted ${totalEmitted} milestone event(s).`);
  }
}
