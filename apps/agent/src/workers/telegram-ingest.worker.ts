import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@kindred/db';
import { QUEUE_NAMES, type TelegramIngestJobData } from '@kindred/shared';
import { createConversation, setStandingInstructions } from '@kindred/minds-client';
import { sendMessage } from '../telegram/bot-api';
import {
  extractEvents,
  detectCreatorInteractionTarget,
  buildCreatorInteractionEvent,
  classifyAmbiguousMessage,
} from '../telegram/extract-events';

// Dashboard URL referenced by the "Kindred conversations happen in your
// dashboard" private-message redirect (Step 5 of the P0 onboarding
// flow). Hard-coded because the agent runs in a context that has no
// Next.js public env vars — and the URL is also documented in the spec
// for this task. If the production URL ever moves, change it here.
const DASHBOARD_URL = 'https://kindred.haybee.xyz/dashboard';

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
// `my_chat_member` is the new shape this worker added for the P0
// onboarding flow (Steps 3 and 4) — Telegram sends it whenever the
// bot itself is added to, promoted in, or removed from a group chat.
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
  my_chat_member?: {
    chat: {
      id: number;
      type: string;
      title?: string;
    };
    from: {
      id: number;
    };
    new_chat_member: {
      status: string;
      user: {
        id: number;
        username?: string;
      };
    };
  };
}

function isTelegramUpdate(value: unknown): value is TelegramUpdate {
  return typeof value === 'object' && value !== null;
}

const LINK_COMMAND_PATTERN = /^\/link[@\w]*\s+([A-Za-z0-9]+)/;

// Telegram renders the deep link t.me/<bot>?start=<code> as a /start
// message in the private chat, with the deep-link payload as the first
// argument after the command. Example: pressing Start with
// ?start=ABCDEFGH produces the message text "/start ABCDEFGH".
//
// We deliberately keep this pattern permissive about the command form
// (the bot username may be appended on group mentions, e.g. /start@KindredBot)
// and about whether any payload is present at all — a bare /start with
// no payload is the canonical "user just opened the chat" event and
// should be ignored, not treated as a malformed linking attempt.
const START_COMMAND_PATTERN = /^\/start(?:[@\w]*)?(?:\s+([A-Za-z0-9]+))?/;

// Welcome message sent in the private DM after the creator presses Start
// with a valid linking code (P0 onboarding Step 2). The content is
// deliberately identical to the spec's reference copy — the wording was
// reviewed and frozen at the time the spec was approved, and changing
// it here without re-approving would diverge from the spec.
const WELCOME_MESSAGE =
  '👋 Welcome to Kindred.\n\n' +
  "You're almost done.\n\n" +
  '1. Add me to your Telegram Group.\n\n' +
  '2. Promote me to Administrator.\n\n' +
  "3. I'll quietly observe your community and remember relationships.\n\n" +
  "I never chat in your group.\n\n" +
  "After you've added me, I'll finish the connection automatically.";

const ADMIN_PROMOTION_REQUEST_MESSAGE = (groupName: string) =>
  `I joined ${groupName}.\n\n` +
  'Please promote me to Administrator so I can begin monitoring your community.';

const ONBOARDING_SUCCESS_MESSAGE = (groupName: string) =>
  '✅ Kindred is now connected.\n\n' +
  'Monitoring:\n' +
  `${groupName}\n\n` +
  'Your community is now being remembered.\n\n' +
  'Future insights will appear in your dashboard.';

const PRIVATE_DEFAULT_REPLY =
  'Kindred conversations happen inside your dashboard.\n\n' +
  `Open:\n${DASHBOARD_URL}`;

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
  // Resolve the creator's Telegram user ID. Preferred source is the
  // TelegramLinkRequest.creatorTelegramUserId captured at /start time
  // (Build Plan: this fix) — the new onboarding flow makes /start the
  // canonical place to learn the creator's identity, and the value lives
  // on the link request because no Community row exists yet at /start
  // time. Fall back to the legacy /link-time sender (Checkpoint 36) so
  // creators who skip /start (old flow, bots that pre-date this fix)
  // still get a Community.creatorTelegramUserId — both paths land on
  // the same field and the notification worker reads that field, not
  // either of these two paths.
  const creatorTelegramUserId =
    linkRequest.creatorTelegramUserId !== null && linkRequest.creatorTelegramUserId !== undefined
      ? linkRequest.creatorTelegramUserId
      : fromTelegramUserId !== undefined
        ? BigInt(fromTelegramUserId)
        : undefined;

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

// Captures the creator's Telegram user ID at /start time. The deep link
// t.me/<bot>?start=<code> produces a "/start <code>" message in the
// creator's private chat with the bot. At that moment the Community
// doesn't exist yet (the bot hasn't been added to the group), so we
// persist the ID on the TelegramLinkRequest itself — when /link runs in
// the group later, handleLinkingCode reads it back and writes it onto
// Community.creatorTelegramUserId, which is what the notification
// worker will read.
//
// Mirrors the lookup rules of handleLinkingCode (silently ignore on
// unknown/expired/consumed) so a stray /start with a bad code is the
// same shape of no-op on both code paths, and re-/start is idempotent:
// re-running /start on an already-known request refreshes the stored
// Telegram user ID with whatever the latest message.from.id says,
// which is the right behavior if the creator re-runs onboarding from
// a different Telegram account.
//
// P0 onboarding Step 2 — after persisting the creator's Telegram user
// ID, send the welcome message. Sending is best-effort: a failure to
// deliver the welcome text (Telegram outage, bad token, etc.) is
// logged but does NOT block the persistence — the creator's identity
// capture is the primary record, and the welcome message is purely
// user-facing copy. A failed welcome can be retried by re-/starting,
// which re-runs this same handler.
async function handleStartCommand(
  code: string | undefined,
  fromTelegramUserId: number | undefined,
): Promise<void> {
  if (!code) {
    return; // Bare /start with no deep-link payload — just "user opened chat".
  }
  if (fromTelegramUserId === undefined) {
    return; // No sender — nothing to attribute.
  }

  const linkRequest = await prisma.telegramLinkRequest.findUnique({
    where: { code: code.toUpperCase() },
  });
  if (!linkRequest) {
    return; // Unknown code — same shape as handleLinkingCode's silent ignore.
  }
  if (linkRequest.consumedAt) {
    return; // Already used by a /link in the group — the ID was already captured.
  }
  if (linkRequest.expiresAt < new Date()) {
    return; // Expired.
  }

  await prisma.telegramLinkRequest.update({
    where: { id: linkRequest.id },
    data: { creatorTelegramUserId: BigInt(fromTelegramUserId) },
  });

  try {
    await sendMessage({ chatId: fromTelegramUserId, text: WELCOME_MESSAGE });
  } catch (error) {
    console.error(
      'Failed to send welcome DM after /start (creator Telegram ID was still persisted):',
      error,
    );
  }
}

// P0 onboarding Step 5 — any private message that isn't a /start command
// (and isn't an internal command like /help the bot doesn't actually
// expose) gets the dashboard-redirect reply. The bot is deliberately not
// a chatbot: no AI, no LLM, no conversation, per the spec. Sending is
// best-effort like the welcome message — if it fails, the user will
// notice the next time they message the bot, but no data is at risk.
//
// Skipped for non-private chats: in groups the bot must never reply to
// any non-command message (Blueprint Section 5.3: groups are observed
// silently). The chat.type === 'private' check is the only guard needed
// because the caller (handlePrivateMessage below) is only invoked from
// the private branch.
async function handlePrivateDefaultReply(fromTelegramUserId: number): Promise<void> {
  try {
    await sendMessage({ chatId: fromTelegramUserId, text: PRIVATE_DEFAULT_REPLY });
  } catch (error) {
    console.error('Failed to send private default reply:', error);
  }
}

// P0 onboarding Step 3 / Step 4 — handle my_chat_member updates for the
// bot itself. Telegram sends this update whenever the bot is added to,
// promoted in, or removed from a group chat. The shape of
// `new_chat_member.status` (Telegram docs:
// https://core.telegram.org/bots/api#chatmember) tells us what happened:
//   - 'member' — bot is in the group as a plain member
//   - 'administrator' — bot has been promoted to admin
//   - 'left' / 'kicked' — bot was removed (we don't act on these in P0)
//
// The flow the spec mandates:
//
//   1. Bot joined a group → confirm a Community row exists for this
//      chat (i.e. the creator has already run /link in the group, OR
//      the link request was pre-associated with a chat id — neither
//      mechanism exists today, so today this only resolves after
//      /link). If found, DM the creator asking for admin promotion.
//      This is the "verify this onboarding belongs to the creator"
//      guard in the spec — without a Community row, we cannot know
//      which creator the group belongs to, and we must NOT DM a
//      random Telegram user.
//
//   2. Bot promoted to admin → activate the Community, create the
//      Mind conversation if it isn't already created (the legacy
//      /link path may have already done this — we don't redo work),
//      and DM the creator a success message.
async function handleMyChatMember(update: NonNullable<TelegramUpdate['my_chat_member']>): Promise<void> {
  // Only group / supergroup my_chat_member updates are relevant —
  // channels are out of scope (spec: "Groups only"). The bot should
  // never be in a private chat as a "member" so the chat.type check
  // is also a safety net against future Telegram changes.
  if (update.chat.type !== 'group' && update.chat.type !== 'supergroup') {
    return;
  }

  // Telegram's status strings are stable for the bot's perspective.
  // Anything else (creator, owner — impossible for a non-user bot, but
  // defensive) is ignored.
  const status = update.new_chat_member.status;
  if (status !== 'member' && status !== 'administrator') {
    return;
  }

  const telegramChatId = BigInt(update.chat.id);
  const community = await prisma.community.findUnique({ where: { telegramChatId } });
  if (!community) {
    // No Community row for this group. The spec requires us to verify
    // the onboarding belongs to the creator — without a Community row
    // we cannot make that determination, and DMing an arbitrary user
    // would be both wrong and a privacy violation. Log and skip.
    console.log(
      `my_chat_member: no Community for chat ${telegramChatId} (status=${status}); skipping DM.`,
    );
    return;
  }

  if (!community.creatorTelegramUserId) {
    // The Community exists but we don't know which Telegram user is the
    // creator — same privacy concern as above. Log and skip.
    console.log(
      `my_chat_member: Community ${community.id} has no creatorTelegramUserId; cannot DM.`,
    );
    return;
  }

  if (status === 'member') {
    try {
      await sendMessage({
        chatId: community.creatorTelegramUserId,
        text: ADMIN_PROMOTION_REQUEST_MESSAGE(update.chat.title ?? 'your group'),
      });
    } catch (error) {
      console.error('Failed to send admin-promotion-request DM:', error);
    }
    return;
  }

  // status === 'administrator' — complete onboarding.
  // Create the Mind conversation if not already present, then activate
  // the Community and send the success message. Mirrors the
  // Mind-conversation-creation block in handleLinkingCode so that
  // either path (legacy /link, or the new my_chat_member flow) ends
  // in the same state.
  if (!community.mindsConversationId) {
    const { alias } = await createConversation();
    await setStandingInstructions(alias);
    await prisma.community.update({
      where: { id: community.id },
      data: {
        status: 'active',
        mindsConversationId: alias,
      },
    });
  } else {
    // Mind conversation already exists (legacy /link path got there
    // first). Just flip the status.
    await prisma.community.update({
      where: { id: community.id },
      data: { status: 'active' },
    });
  }

  try {
    await sendMessage({
      chatId: community.creatorTelegramUserId,
      text: ONBOARDING_SUCCESS_MESSAGE(update.chat.title ?? 'your group'),
    });
  } catch (error) {
    console.error('Failed to send onboarding success DM:', error);
  }
}

export const telegramIngestWorker = new Worker<TelegramIngestJobData>(
  QUEUE_NAMES.TELEGRAM_INGEST,
  async (job: Job<TelegramIngestJobData>) => {
    if (!isTelegramUpdate(job.data.update)) {
      return;
    }

    // P0 onboarding Steps 3 & 4 — handle my_chat_member BEFORE the
    // message branch. These updates have no `message` field, so the
    // message branch would silently no-op anyway, but handling them
    // first is clearer and avoids a misleading "no text" log line.
    if (job.data.update.my_chat_member) {
      await handleMyChatMember(job.data.update.my_chat_member);
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

    // Private chat branch — handles BOTH /start (Step 2) and the
    // default reply (Step 5). The order matters: /start must be
    // matched first because a literal "/start" message would
    // otherwise hit the default-reply branch. startMatch[1] is the
    // code (or undefined for a bare /start).
    if (message.chat.type === 'private') {
      const startMatch = message.text.match(START_COMMAND_PATTERN);
      if (startMatch) {
        await handleStartCommand(startMatch[1], message.from?.id);
        return;
      }
      if (message.from?.id !== undefined) {
        // Step 5: any other private message gets the dashboard redirect.
        // Sending is best-effort (see handlePrivateDefaultReply).
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
    // captured already. The /link message that created this Community
    // is the canonical place (see handleLinkingCode above); for the new
    // onboarding flow, that value is sourced from
    // TelegramLinkRequest.creatorTelegramUserId populated at /start
    // time (handleStartCommand), not from the /link sender.
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
