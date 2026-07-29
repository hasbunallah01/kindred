import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@kindred/db';
import { QUEUE_NAMES } from '@kindred/shared';
import { sendMessage } from '@kindred/minds-client';

// REDIS_URL is guaranteed to be set by the agent's startup gate
// (apps/agent/src/index.ts validateRequiredEnv), so no fallback here:
// falling back to redis://localhost:6379 on a real VPS would silently
// hang the worker trying to reach a Redis that isn't running. The
// non-null assertion documents that contract.
const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

// Checkpoint 43: how often to check for unsent events per community. This
// is what keeps cognition usage bounded (Blueprint Sections 6.4/6.6, 14) —
// the Mind receives periodic batched digests, never one message per
// Telegram message.
const DIGEST_INTERVAL_MS = 15 * 60 * 1000;
const REPEAT_JOB_ID = 'mind-digest-sender-recurring';

const digestQueue = new Queue(QUEUE_NAMES.MIND_DIGEST_SENDER, { connection });

// Schedules the recurring check. Called once at agent boot (src/index.ts).
// A fixed jobId means BullMQ dedupes this — restarting the agent process
// doesn't create a second, overlapping repeat schedule.
export async function scheduleMindDigestSender(): Promise<void> {
  await digestQueue.add(
    'check-communities',
    {},
    {
      repeat: { every: DIGEST_INTERVAL_MS },
      jobId: REPEAT_JOB_ID,
    },
  );
}

interface DigestEvent {
  type: string;
  payload: unknown;
  occurredAt: Date;
  member: { displayName: string };
}

function messagePreviewOf(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null && 'messagePreview' in payload) {
    return String((payload as { messagePreview?: unknown }).messagePreview ?? '');
  }
  return '';
}

// Composes the plain-text digest sent to the Mind. Deliberately simple —
// the Mind does the actual interpretation (Blueprint Section 6.2); this
// just needs to convey what happened, not judge its significance.
function formatDigest(communityTitle: string, events: DigestEvent[]): string {
  const lines = events.map((event) => {
    const when = event.occurredAt.toISOString();
    switch (event.type) {
      case 'joined':
        return `- ${event.member.displayName} joined (${when})`;
      case 'first_interaction':
        return `- ${event.member.displayName}'s first message: "${messagePreviewOf(event.payload)}" (${when})`;
      case 'participation':
        return `- ${event.member.displayName} was active (${when})`;
      case 'creator_interaction':
        return `- You replied to ${event.member.displayName}: "${messagePreviewOf(event.payload)}" (${when})`;
      default:
        return `- ${event.member.displayName}: ${event.type} (${when})`;
    }
  });

  return `Relationship update for ${communityTitle}:\n${lines.join('\n')}`;
}

export const mindDigestSenderWorker = new Worker(
  QUEUE_NAMES.MIND_DIGEST_SENDER,
  async () => {
    const communities = await prisma.community.findMany({
      where: { status: 'active', mindsConversationId: { not: null } },
    });

    for (const community of communities) {
      if (!community.mindsConversationId) {
        continue; // Narrows the type below; the query above already filters this.
      }

      const pendingEvents = await prisma.relationshipEvent.findMany({
        where: {
          sentToMind: false,
          member: { communityId: community.id },
        },
        include: { member: true },
        orderBy: { occurredAt: 'asc' },
      });

      if (pendingEvents.length === 0) {
        continue;
      }

      const digestText = formatDigest(community.telegramChatTitle, pendingEvents);
      await sendMessage(community.mindsConversationId, digestText);

      const sentAt = new Date();
      await prisma.relationshipEvent.updateMany({
        where: { id: { in: pendingEvents.map((event: DigestEvent & { id: string }) => event.id) } },
        data: { sentToMind: true, sentToMindAt: sentAt },
      });
    }
  },
  { connection },
);

mindDigestSenderWorker.on('failed', (job, error) => {
  console.error(`mind-digest-sender job ${job?.id ?? 'unknown'} failed:`, error);
});
