// Telegram onboarding state machine.
//
// Implements Steps 2-5 of the Telegram onboarding spec:
//   2. /start <code> in private chat  → welcome message
//   3. bot joins a group (my_chat_member, status='member')
//                                    → "I joined, but I need admin"
//   4. bot promoted in that group (my_chat_member, status='administrator')
//                                    → Community created/transitioned
//                                      to 'active', Mind conversation
//                                      opened, success message
//   5. any other private text        → dashboard-redirect default reply
//
// The connecting state between Step 2 and Step 3 — "which Telegram user
// is mid-onboarding for which creator" — has nowhere to live on the
// existing schema (TelegramLinkRequest has no Telegram-user-id column,
// Community requires telegramChatId which doesn't exist until Step 3).
// We bridge it with a short-lived Redis key, scoped to the lifetime of
// the link code and cleared as soon as the link completes. This is a
// use of the existing Redis instance, not a redesign of how Redis is
// used elsewhere (no new key namespaces, no schema, no new pub/sub
// channels — just a TTL key).

import IORedis from 'ioredis';
import { prisma } from '@kindred/db';
import { createConversation, setStandingInstructions } from '@kindred/minds-client';
import { sendTelegramMessage } from './telegram-client';

// Same connection convention as every other worker
// (apps/agent/src/workers/*.worker.ts): REDIS_URL is guaranteed by the
// agent's startup gate (validateRequiredEnv), so no localhost fallback —
// a silent fallback here would hang the worker the same way it would
// hang the others if Redis isn't reachable. maxRetriesPerRequest: null
// is required for BullMQ Worker connections; the same option is fine
// for direct ioredis usage here.
const redis = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

// The expected on-disk shape of my_chat_member updates. Full Telegram
// update spec is wider; only the fields this module actually reads are
// typed here.
export interface MyChatMemberUpdate {
  chat: {
    id: number;
    type: string;
    title?: string;
  };
  from: {
    id: number;
  };
  date: number;
  new_chat_member: {
    status: string;
    // Telegram sends these as a string; we just look at the status
    // discriminator above and don't read the rest, but the parser must
    // not throw on the unknown field — `as unknown` not needed, the
    // status check is sufficient.
    [key: string]: unknown;
  };
}

// Exact copy of the spec's example text for Step 2. Kept verbatim
// because the spec pins it as the canonical welcome — the same message
// for every creator, no personalization yet (that lives in Mind-side
// context, not here).
const WELCOME_MESSAGE = [
  '👋 Welcome to Kindred!',
  '',
  "You're connecting your Kindred workspace.",
  '',
  'Next:',
  '• Add me to the Telegram group you want me to observe.',
  '• Grant the required administrator permissions.',
  '',
  "I'll automatically detect when setup is complete.",
].join('\n');

// Step 3 — bot joined but not yet promoted. Sent to the creator's
// private chat (chatId === creatorTelegramUserId, since for a 1:1
// conversation with a bot the chat id and the user id are equal).
const JOINED_NEEDS_ADMIN_MESSAGE = [
  '✅ I joined your group.',
  '',
  '⚠️ I still need the required administrator permissions before I can begin observing your community.',
].join('\n');

// Step 4 — success. The chat title is interpolated because the spec's
// example ends with "Kindred is now connected to <chat title>." —
// the value is informational only, not stored on the message itself.
function buildSuccessMessage(chatTitle: string): string {
  return [
    '🎉 Success!',
    '',
    `Kindred is now connected to ${chatTitle}.`,
    '',
    "I'll begin observing your community.",
  ].join('\n');
}

// Step 5 — default reply to any non-/start private message. Pinned
// verbatim by the spec: the dashboard URL is the only place creators
// can do anything conversational with their workspace. The bot is
// strictly an onboarding/notifications surface.
const DEFAULT_REPLY_MESSAGE = [
  "Kindred isn't a conversational chatbot.",
  'Please open your Kindred dashboard to manage your workspace and view your insights.',
  '',
  'https://kindred.haybee.xyz',
].join('\n');

// Sent in private chat when /start is called with a code that's
// unknown, expired, or already used. Distinct from the default reply
// (Step 5) because the failure mode here is the creator following the
// flow wrong, not the creator trying to chat with the bot — pointing
// them back to the dashboard to regenerate a code is the right
// recovery action.
const INVALID_CODE_MESSAGE = [
  "That code is invalid or has expired.",
  'Please return to your Kindred dashboard to generate a new one.',
  '',
  'https://kindred.haybee.xyz',
].join('\n');

// How long the "this Telegram user is mid-onboarding for this creator"
// Redis key lives. Matches the link-code TTL (15 minutes — see
// apps/web/app/api/telegram/link/route.ts EXPIRY_MINUTES), so the key
// expires at roughly the same time the code does. Slightly under the
// code TTL so we never have a Redis key for a code that the DB has
// already forgotten.
const ONBOARDING_KEY_TTL_SECONDS = 14 * 60;

function onboardingKey(telegramUserId: bigint): string {
  return `kindred:onboarding:telegram:${telegramUserId.toString()}`;
}

// Step 2: /start <code> in private chat.
//
// Validates the code against TelegramLinkRequest, records the
// creator→telegram-user mapping in Redis (so a later my_chat_member
// event from the same user can be attributed back to this creator),
// and sends the welcome message.
//
// Known limitation, not silently glossed over: if two different Kindred
// creators happen to use the same Telegram account (e.g. a shared
// device), the second /start would overwrite the first creator's
// mapping in Redis. Acceptable for the MVP scope — the spec calls out
// a single-creator-per-account model implicitly ("the creator's
// workspace"), and resolving multi-tenant-per-account properly needs
// real auth on the Telegram side, which Telegram doesn't provide.
export async function handleStartCommand(
  rawCode: string,
  fromTelegramUserId: number,
): Promise<void> {
  const code = rawCode.toUpperCase();
  const linkRequest = await prisma.telegramLinkRequest.findUnique({ where: { code } });

  if (!linkRequest || linkRequest.consumedAt || linkRequest.expiresAt < new Date()) {
    await sendTelegramMessage(BigInt(fromTelegramUserId), INVALID_CODE_MESSAGE);
    return;
  }

  // Record the creator→telegram-user mapping for the next steps to
  // pick up. Keyed by telegram user id (what my_chat_member.from.id
  // will give us), valued by creator id (the foreign key Community
  // needs at the my_chat_member step). Note we do NOT mark the
  // TelegramLinkRequest consumed here — consumption happens at
  // successful linking, so a creator who /start's but never finishes
  // can retry with the same code until it expires.
  await redis.set(
    onboardingKey(BigInt(fromTelegramUserId)),
    linkRequest.creatorId,
    'EX',
    ONBOARDING_KEY_TTL_SECONDS,
  );

  await sendTelegramMessage(BigInt(fromTelegramUserId), WELCOME_MESSAGE);
}

// Step 3 / Step 4: bot's status changed in a group (my_chat_member).
//
// The two states we care about:
//   - 'member'          → bot was just added (or re-added) as a regular
//                         member. Step 3: create Community as
//                         pending_link and tell the creator to promote.
//   - 'administrator'   → bot is now an admin. Step 4: complete the
//                         link (transition to active, open the Mind
//                         conversation), send the success message.
//   - anything else     → ignore. 'left'/'kicked' means the creator
//                         removed the bot from the group; that's not
//                         a state we need to act on.
export async function handleMyChatMemberUpdate(update: MyChatMemberUpdate): Promise<void> {
  // Spec: only Telegram groups are in scope. 'channel' updates from
  // my_chat_member are out of MVP scope; 'private' is impossible —
  // my_chat_member doesn't fire for the bot's own private chat with
  // the creator.
  if (update.chat.type !== 'group' && update.chat.type !== 'supergroup') {
    return;
  }

  const newStatus = update.new_chat_member.status;
  const telegramChatId = BigInt(update.chat.id);
  const fromTelegramUserId = BigInt(update.from.id);

  // Look up the creator this group-add is attributable to. The
  // mapping is set by handleStartCommand (Step 2). If there's no
  // mapping, the bot was added to a group outside the onboarding
  // flow — for MVP, we do nothing. (Future: detect existing
  // communities via telegramChatId and route accordingly.)
  const creatorId = await redis.get(onboardingKey(fromTelegramUserId));
  if (!creatorId) {
    return;
  }

  if (newStatus === 'member') {
    await handleBotAddedAsMember({
      creatorId,
      telegramChatId,
      telegramChatTitle: update.chat.title,
      creatorTelegramUserId: fromTelegramUserId,
    });
    return;
  }

  if (newStatus === 'administrator') {
    await handleBotPromotedToAdmin({
      creatorId,
      telegramChatId,
      telegramChatTitle: update.chat.title,
      creatorTelegramUserId: fromTelegramUserId,
    });
    return;
  }

  // 'left', 'kicked' — creator removed the bot. No action; the
  // pending_link Community row (if any) will simply stay pending
  // and the linking-code-expiry worker will sweep the TelegramLink
  // Request at expiry.
}

interface BotAddedArgs {
  creatorId: string;
  telegramChatId: bigint;
  telegramChatTitle: string | undefined;
  creatorTelegramUserId: bigint;
}

// Step 3 internal: bot is now in the group as a regular member.
// Create the Community row in pending_link state and tell the
// creator (in private chat) to promote the bot.
//
// Idempotent: if a pending_link Community for this chat already
// exists (e.g. the bot was added, removed, and re-added), the
// upsert below re-uses it rather than erroring on the unique
// telegramChatId constraint.
async function handleBotAddedAsMember(args: BotAddedArgs): Promise<void> {
  await prisma.community.upsert({
    where: { telegramChatId: args.telegramChatId },
    create: {
      creatorId: args.creatorId,
      telegramChatId: args.telegramChatId,
      telegramChatTitle: args.telegramChatTitle ?? 'Untitled community',
      status: 'pending_link',
      creatorTelegramUserId: args.creatorTelegramUserId,
    },
    update: {
      // If we're being re-added, keep creatorId / title fresh; status
      // is reset to pending_link because the previous attempt didn't
      // complete (the bot is being added again, so we're back at the
      // start of Step 3).
      creatorId: args.creatorId,
      status: 'pending_link',
      creatorTelegramUserId: args.creatorTelegramUserId,
    },
  });

  await sendTelegramMessage(args.creatorTelegramUserId, JOINED_NEEDS_ADMIN_MESSAGE);
}

interface BotPromotedArgs {
  creatorId: string;
  telegramChatId: bigint;
  telegramChatTitle: string | undefined;
  creatorTelegramUserId: bigint;
}

// Step 4 internal: bot has just been promoted to administrator.
// Complete the link:
//   1. Transition the Community to 'active' (creating it as active
//      directly if the bot was added with admin from the start, in
//      which case Step 3 was skipped).
//   2. Mark the TelegramLinkRequest as consumed.
//   3. Open the Mind conversation (mirrors handleLinkingCode in
//      telegram-ingest.worker.ts: createConversation +
//      setStandingInstructions + write the alias back).
//   4. Clear the Redis onboarding key (no longer needed).
//   5. Send the success message to the creator in private chat.
//
// Race-condition note: if the bot is added as admin in a single
// step (Step 3 collapsed into Step 4), no pending_link row exists
// yet, so the upsert's create branch runs — and it writes status
// 'active' directly, skipping the pending_link intermediate state.
// That's intentional: the spec's flow is "add then promote," but
// Telegram allows both at once, and the end result is the same.
async function handleBotPromotedToAdmin(args: BotPromotedArgs): Promise<void> {
  const chatTitle = args.telegramChatTitle ?? 'Untitled community';

  // Resolve the link request to consume. There may be multiple
  // (rare: a creator starting two /start flows), so consume the
  // oldest unconsumed, unexpired one for this creator. We pick the
  // one with the earliest expiresAt (proxy for "oldest issued" since
  // TelegramLinkRequest doesn't have a createdAt column — see schema
  // packages/db/schema.prisma) so a newer code doesn't accidentally
  // invalidate an older-but-still-valid flow.
  const linkRequest = await prisma.telegramLinkRequest.findFirst({
    where: {
      creatorId: args.creatorId,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: 'asc' },
  });

  const community = await prisma.community.upsert({
    where: { telegramChatId: args.telegramChatId },
    create: {
      creatorId: args.creatorId,
      telegramChatId: args.telegramChatId,
      telegramChatTitle: chatTitle,
      status: 'active',
      creatorTelegramUserId: args.creatorTelegramUserId,
    },
    update: {
      creatorId: args.creatorId,
      status: 'active',
      creatorTelegramUserId: args.creatorTelegramUserId,
    },
  });

  if (linkRequest) {
    await prisma.telegramLinkRequest.update({
      where: { id: linkRequest.id },
      data: { consumedAt: new Date() },
    });
  }

  // Open the Mind conversation outside the transaction (mirrors the
  // existing handleLinkingCode rationale: an external HTTP call
  // doesn't belong inside a database transaction, and a slow/failed
  // Minds call shouldn't block the Community row from existing).
  //
  // Same known limitation as the existing code: if createConversation
  // throws, the Community row is already 'active' but lacks a
  // mindsConversationId. Acceptable for MVP scope; a real
  // retry/backfill path isn't built here.
  if (!community.mindsConversationId) {
    const { alias } = await createConversation();
    await setStandingInstructions(alias);
    await prisma.community.update({
      where: { id: community.id },
      data: { mindsConversationId: alias },
    });
  }

  // Onboarding flow is complete — clear the Redis mapping.
  await redis.del(onboardingKey(args.creatorTelegramUserId));

  await sendTelegramMessage(args.creatorTelegramUserId, buildSuccessMessage(chatTitle));
}

// Step 5: any private-chat message that isn't a /start with a code
// gets the dashboard-redirect reply. This is the explicit
// "Kindred isn't a chatbot" boundary the spec calls out: no AI
// conversation, no commands, no cleverness — just point the user
// back to the dashboard.
export async function handlePrivateDefaultReply(fromTelegramUserId: number): Promise<void> {
  await sendTelegramMessage(BigInt(fromTelegramUserId), DEFAULT_REPLY_MESSAGE);
}
