import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@kindred/db';
import { QUEUE_NAMES, type TelegramIngestJobData } from '@kindred/shared';
import { extractEvents } from '../telegram/extract-events';

// maxRetriesPerRequest: null is required by BullMQ for Worker connections
// (it throws otherwise) — a worker is a background process that's
// expected to keep retrying indefinitely, unlike the webhook route's
// producer connection (apps/web/app/api/telegram/webhook/route.ts),
// which intentionally leaves this at the default.
const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Minimal shape of a Telegram Update — only the fields this worker
// actually reads. Full message processing (join/first-interaction,
// creator-interaction, participation) is Checkpoints 35-37, not here.
interface TelegramUpdate {
  message?: {
    text?: string;
    chat: {
      id: number;
      type: string;
      title?: string;
    };
    from?: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
  };
}

function isTelegramUpdate(value: unknown): value is TelegramUpdate {
  return typeof value === 'object' && value !== null;
}

const LINK_COMMAND_PATTERN = /^\/link[@\w]*\s+([A-Za-z0-9]+)/;

async function handleLinkingCode(
  code: string,
  chatId: number,
  chatTitle: string | undefined,
): Promise<void> {
  const linkRequest = await prisma.telegramLinkRequest.findUnique({ where: { code } });

  if (!linkRequest) {
    return; // Unknown code — silently ignore (no error reply in-group yet).
  }
  if (linkRequest.consumedAt) {
    return; // Already used.
  }
  if (linkRequest.expiresAt < new Date()) {
    return; // Expired.
  }

  const telegramChatId = BigInt(chatId);

  await prisma.$transaction([
    prisma.community.upsert({
      where: { telegramChatId },
      create: {
        creatorId: linkRequest.creatorId,
        telegramChatId,
        telegramChatTitle: chatTitle ?? 'Untitled community',
        status: 'active',
      },
      update: {
        status: 'active',
      },
    }),
    prisma.telegramLinkRequest.update({
      where: { id: linkRequest.id },
      data: { consumedAt: new Date() },
    }),
  ]);
}

export const telegramIngestWorker = new Worker<TelegramIngestJobData>(
  QUEUE_NAMES.TELEGRAM_INGEST,
  async (job: Job<TelegramIngestJobData>) => {
    if (!isTelegramUpdate(job.data.update)) {
      return;
    }

    const message = job.data.update.message;
    if (!message?.text) {
      // Not a text message (could be a join event, a photo, a sticker,
      // etc.) — nothing for this checkpoint to do with it yet.
      return;
    }

    // Linking codes (and Member tracking) are only meaningful inside a
    // group/supergroup, never a private DM to the bot.
    if (message.chat.type === 'private') {
      return;
    }

    const telegramChatId = BigInt(message.chat.id);
    const community = await prisma.community.findUnique({ where: { telegramChatId } });

    if (!community) {
      // Not linked yet — the only thing that matters here is a valid
      // linking code (Checkpoint 31/26). Anything else in an unlinked
      // group has nowhere to attach a Member to (Community FK is
      // required), so there's nothing more to do with it yet.
      const match = message.text.match(LINK_COMMAND_PATTERN);
      if (match?.[1]) {
        await handleLinkingCode(match[1].toUpperCase(), message.chat.id, message.chat.title);
      }
      return;
    }

    // Community is linked — Checkpoint 34: upsert a Member record for
    // whoever sent this message. firstSeenAt is only set on create; the
    // update branch intentionally leaves it untouched so repeat messages
    // never overwrite it, only lastSeenAt.
    if (!message.from) {
      return; // No sender info (e.g. a channel post) — nothing to attribute.
    }

    const telegramUserId = BigInt(message.from.id);
    const displayName =
      [message.from.first_name, message.from.last_name].filter(Boolean).join(' ') || 'Unknown';
    const now = new Date();

    // Checked BEFORE the upsert — this is the only way to know whether the
    // upsert below is about to create a brand-new Member or update an
    // existing one (Prisma's upsert result doesn't say which happened).
    const existingMember = await prisma.member.findUnique({
      where: {
        communityId_telegramUserId: {
          communityId: community.id,
          telegramUserId,
        },
      },
    });
    const isNewMember = !existingMember;

    const member = await prisma.member.upsert({
      where: {
        communityId_telegramUserId: {
          communityId: community.id,
          telegramUserId,
        },
      },
      create: {
        communityId: community.id,
        telegramUserId,
        telegramUsername: message.from.username,
        displayName,
        firstSeenAt: now,
        lastSeenAt: now,
      },
      update: {
        telegramUsername: message.from.username,
        displayName,
        lastSeenAt: now,
      },
    });

    const events = extractEvents({
      isNewMember,
      messageText: message.text,
      occurredAt: now,
    });

    if (events.length > 0) {
      await prisma.relationshipEvent.createMany({
        data: events.map((event) => ({
          memberId: event.memberIdOverride ?? member.id,
          type: event.type,
          payload: event.payload,
          occurredAt: event.occurredAt,
        })),
      });
    }
  },
  { connection },
);

telegramIngestWorker.on('failed', (job, error) => {
  console.error(`telegram-ingest job ${job?.id ?? 'unknown'} failed:`, error);
});
