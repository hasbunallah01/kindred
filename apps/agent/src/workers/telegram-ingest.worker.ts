import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@kindred/db';
import { QUEUE_NAMES, type TelegramIngestJobData } from '@kindred/shared';
import { createConversation, setStandingInstructions } from '@kindred/minds-client';
import {
  extractEvents,
  detectCreatorInteractionTarget,
  buildCreatorInteractionEvent,
  classifyAmbiguousMessage,
} from '../telegram/extract-events';
import {
  handleStartCommand,
  handleMyChatMemberUpdate,
  handlePrivateDefaultReply,
  type MyChatMemberUpdate,
} from '../telegram/onboarding';

// maxRetriesPerRequest: null is required by BullMQ for Worker connections
// (it throws otherwise) — a worker is a background process that's
// expected to keep retrying indefinitely, unlike the webhook route's
// producer connection (apps/web/app/api/telegram/webhook/route.ts),
// which intentionally leaves this at the default.
//
// REDIS_URL is guaranteed to be set by the agent's startup gate
// (apps/agent/src/index.ts validateRequiredEnv), so no fallback here:
// falling back to redis://localhost:6379 on a real VPS would silently
// hang the worker trying to reach a Redis that isn't running. The
// non-null assertion documents that contract.
const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

// Minimal shape of a Telegram Update — only the fields this worker
// actually reads. Full message processing (join/first-interaction,
// creator-interaction, participation) is Checkpoints 35-37, not here.
//
// The onboarding flow (Steps 2-5 of the Telegram onboarding spec)
// adds two new update types to the worker's surface area:
//   - my_chat_member: bot's status changed in a group (join/promote/kick)
//   - private-chat message text starting with /start (handled inline
//     below, dispatched to handleStartCommand)
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
    reply_to_message?: {
      from?: {
        id: number;
      };
    };
  };
  // Telegram sends this when the bot's own membership status in a
  // chat changes — the trigger for Steps 3 and 4 of the onboarding
  // flow. The shape is asserted by isMyChatMemberUpdate below before
  // the onboarding handler is called.
  my_chat_member?: {
    chat: { id: number; type: string; title?: string };
    from: { id: number };
    date: number;
    new_chat_member: { status: string };
  };
}

function isTelegramUpdate(value: unknown): value is TelegramUpdate {
  return typeof value === 'object' && value !== null;
}

// Narrow my_chat_member to the exact shape the onboarding module
// consumes. Keeps a malformed update from blowing up later code with
// an undefined deref.
function isMyChatMemberUpdate(value: unknown): value is MyChatMemberUpdate {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.chat !== 'object' || v.chat === null) return false;
  if (typeof v.from !== 'object' || v.from === null) return false;
  if (typeof v.new_chat_member !== 'object' || v.new_chat_member === null) return false;
  const chat = v.chat as Record<string, unknown>;
  const from = v.from as Record<string, unknown>;
  const member = v.new_chat_member as Record<string, unknown>;
  return (
    typeof chat.id === 'number' &&
    typeof chat.type === 'string' &&
    typeof from.id === 'number' &&
    typeof member.status === 'string'
  );
}

const LINK_COMMAND_PATTERN = /^\/link[@\w]*\s+([A-Za-z0-9]+)/;

// Telegram deep-link format for /start with a payload:
//   t.me/<bot>?start=<code>
// lands in the bot as a /start command whose text is `/start <code>`
// (in private chats only — groups ignore the start parameter). The
// optional [@username] suffix is the same as /link's: Telegram adds
// "@<bot_username>" when commands are sent via the UI in a chat that
// has multiple bots, so we tolerate it but don't require it.
const START_COMMAND_PATTERN = /^\/start(?:[@\w]*)?\s+([A-Za-z0-9]+)/;

// Checkpoint 37: how long a member's activity counts as "the same
// session" before another participation event is warranted. 30 minutes
// is a reasonable default for a chat community — long enough that an
// active conversation doesn't flood the ledger with one event per
// message, short enough that separate visits later the same day still
// register as distinct participation.
const PARTICIPATION_WINDOW_MS = 30 * 60 * 1000;

async function handleLinkingCode(
  code: string,
  chatId: number,
  chatTitle: string | undefined,
  fromTelegramUserId: number | undefined,
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
  // Whoever posts a valid /link code is assumed to be the creator setting
  // up the connection — captured now since it's the only point at which
  // we ever learn this identity (Checkpoint 36).
  const creatorTelegramUserId =
    fromTelegramUserId !== undefined ? BigInt(fromTelegramUserId) : undefined;

  const [community] = await prisma.$transaction([
    prisma.community.upsert({
      where: { telegramChatId },
      create: {
        creatorId: linkRequest.creatorId,
        telegramChatId,
        telegramChatTitle: chatTitle ?? 'Untitled community',
        status: 'active',
        creatorTelegramUserId,
      },
      update: {
        status: 'active',
        ...(creatorTelegramUserId !== undefined ? { creatorTelegramUserId } : {}),
      },
    }),
    prisma.telegramLinkRequest.update({
      where: { id: linkRequest.id },
      data: { consumedAt: new Date() },
    }),
  ]);

  // Checkpoint 42: establish the Mind's conversation for this community
  // now that it's active. Deliberately outside the transaction above —
  // an external HTTP call has no place inside a database transaction
  // (it can be slow, and Prisma's transaction isn't what should retry a
  // network failure). Community.mindsConversationId is nullable exactly
  // because of this gap between the row existing and this call
  // succeeding (Blueprint Section 3.2). Stores the ALIAS the Minds
  // client's other functions expect (Checkpoint 41), not the raw
  // conversationId — the field name predates that distinction but its
  // value is what every later sendMessage/getMessageHistory call needs.
  //
  // Known limitation, not silently glossed over: if createConversation()
  // throws here, this job fails and BullMQ may retry it — but on retry,
  // the Community row already exists, so the update above re-enters the
  // "already linked" branch of the outer processor rather than retrying
  // this call. A community could end up permanently missing its Mind
  // conversation if this specific call fails. Acceptable for this
  // checkpoint's scope; a real retry/backfill path isn't built here.
  if (!community.mindsConversationId) {
    const { alias } = await createConversation();
    // Checkpoint 45: established once, right here, at the same moment
    // the conversation itself is created — every real community's Mind
    // conversation gets standing instructions from the start, not just
    // the "test conversation" wording in the checkpoint's own goal.
    await setStandingInstructions(alias);
    await prisma.community.update({
      where: { id: community.id },
      data: { mindsConversationId: alias },
    });
  }
}

export const telegramIngestWorker = new Worker<TelegramIngestJobData>(
  QUEUE_NAMES.TELEGRAM_INGEST,
  async (job: Job<TelegramIngestJobData>) => {
    if (!isTelegramUpdate(job.data.update)) {
      return;
    }

    // Onboarding Step 3 / Step 4: the bot's own membership status
    // changed in a group. Handled BEFORE the message branch because
    // my_chat_member updates don't carry a `message` field at all,
    // and dispatching to the message extractor would just fall
    // through to the early return below. The shape check guards
    // against malformed updates causing a TypeError.
    if (isMyChatMemberUpdate(job.data.update.my_chat_member)) {
      await handleMyChatMemberUpdate(job.data.update.my_chat_member);
      return;
    }

    const message = job.data.update.message;
    if (!message?.text) {
      // No text content — the rule-based extraction above has nothing to
      // work with. Routed through the flagged-off OpenAI fallback rather
      // than a silent return; with ENABLE_OPENAI_FALLBACK at its default
      // (false), this only logs and does nothing further.
      if (message) {
        await classifyAmbiguousMessage({ messageType: 'non-text' });
      }
      return;
    }

    // Onboarding Step 2 / Step 5: private-chat messages are either a
    // /start with a code (Step 2) or arbitrary text (Step 5). The
    // previous worker returned early on private chats — that predates
    // the onboarding flow, which is the first feature that needs
    // private-chat traffic. The original "private means drop" path is
    // replaced by the explicit Step 2 / Step 5 dispatch below; the
    // group-only paths (Member tracking, /link code) below this
    // block are unchanged.
    if (message.chat.type === 'private') {
      if (!message.from) {
        return;
      }
      const startMatch = message.text.match(START_COMMAND_PATTERN);
      if (startMatch?.[1]) {
        await handleStartCommand(startMatch[1], message.from.id);
      } else {
        // Step 5: any other private-chat text gets the
        // dashboard-redirect reply. This is the explicit
        // "Kindred isn't a chatbot" boundary — no AI, no commands
        // beyond /start, just point the user back to the dashboard.
        await handlePrivateDefaultReply(message.from.id);
      }
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
        await handleLinkingCode(
          match[1].toUpperCase(),
          message.chat.id,
          message.chat.title,
          message.from?.id,
        );
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
      hasRecentParticipation: isNewMember
        ? false // irrelevant — extractEvents won't check it for a new member
        : Boolean(
            await prisma.relationshipEvent.findFirst({
              where: {
                memberId: member.id,
                type: 'participation',
                occurredAt: { gte: new Date(now.getTime() - PARTICIPATION_WINDOW_MS) },
              },
            }),
          ),
      messageText: message.text,
      occurredAt: now,
    });

    // Checkpoint 36: was this message the creator replying to a specific
    // member? Requires community.creatorTelegramUserId to have been
    // captured already (only happens once a /link message has been
    // processed — see handleLinkingCode above).
    const replyToTelegramUserId = message.reply_to_message?.from
      ? BigInt(message.reply_to_message.from.id)
      : undefined;

    const creatorInteractionTarget = detectCreatorInteractionTarget({
      isFromCreator:
        community.creatorTelegramUserId !== null &&
        telegramUserId === community.creatorTelegramUserId,
      replyToTelegramUserId,
      creatorTelegramUserId: community.creatorTelegramUserId ?? undefined,
    });

    if (creatorInteractionTarget !== null) {
      const repliedToMember = await prisma.member.findUnique({
        where: {
          communityId_telegramUserId: {
            communityId: community.id,
            telegramUserId: creatorInteractionTarget,
          },
        },
      });

      if (repliedToMember) {
        events.push({
          ...buildCreatorInteractionEvent(message.text, now),
          memberIdOverride: repliedToMember.id,
        });
      }
    }

    if (events.length > 0) {
      await prisma.relationshipEvent.createMany({
        data: events.map((event) => ({
          memberId: event.memberIdOverride ?? member.id,
          type: event.type,
          payload: event.payload,
          occurredAt: event.occurredAt,
        })) as never,
      });
    }
  },
  { connection },
);

telegramIngestWorker.on('failed', (job, error) => {
  console.error(`telegram-ingest job ${job?.id ?? 'unknown'} failed:`, error);
});
