import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@kindred/db';
import { QUEUE_NAMES, type TelegramIngestJobData } from '@kindred/shared';

// maxRetriesPerRequest: null is required by BullMQ for Worker connections
// (it throws otherwise) — a worker is a background process that's
// expected to keep retrying indefinitely, unlike the webhook route's
// producer connection (apps/web/app/api/telegram/webhook/route.ts),
// which intentionally leaves this at the default.
const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Minimal shape of a Telegram Update — only the fields this worker
// actually reads. Full message processing (joins, participation,
// creator-interaction detection, etc.) is Checkpoints 34-37, not here;
// this checkpoint's scope is deliberately just linking-code resolution.
interface TelegramUpdate {
  message?: {
    text?: string;
    chat: {
      id: number;
      type: string;
      title?: string;
    };
  };
}

function isTelegramUpdate(value: unknown): value is TelegramUpdate {
  return typeof value === 'object' && value !== null;
}

const LINK_COMMAND_PATTERN = /^\/link[@\w]*\s+([A-Za-z0-9]+)/;

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

    // Linking codes are only meaningful posted inside a group/supergroup,
    // never a private DM to the bot.
    if (message.chat.type === 'private') {
      return;
    }

    const match = message.text.match(LINK_COMMAND_PATTERN);
    if (!match || !match[1]) {
      return;
    }

    const code = match[1].toUpperCase();

    const linkRequest = await prisma.telegramLinkRequest.findUnique({
      where: { code },
    });

    if (!linkRequest) {
      return; // Unknown code — silently ignore (no error reply in-group yet).
    }

    if (linkRequest.consumedAt) {
      return; // Already used.
    }

    if (linkRequest.expiresAt < new Date()) {
      return; // Expired.
    }

    const telegramChatId = BigInt(message.chat.id);

    await prisma.$transaction([
      prisma.community.upsert({
        where: { telegramChatId },
        create: {
          creatorId: linkRequest.creatorId,
          telegramChatId,
          telegramChatTitle: message.chat.title ?? 'Untitled community',
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
  },
  { connection },
);

telegramIngestWorker.on('failed', (job, error) => {
  console.error(`telegram-ingest job ${job?.id ?? 'unknown'} failed:`, error);
});
