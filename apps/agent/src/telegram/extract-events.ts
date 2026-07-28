// Raw message context -> structured RelationshipEvent candidates.
//
// Kept as pure functions (no Prisma, no I/O) so the extraction rules
// themselves stay testable in isolation from the worker's DB/queue
// plumbing — the worker (telegram-ingest.worker.ts) is what actually
// persists whatever this returns.

import { ENABLE_OPENAI_FALLBACK } from '@kindred/shared';

export interface ExtractedEvent {
  type: 'joined' | 'first_interaction' | 'creator_interaction' | 'participation';
  payload: Record<string, unknown>;
  occurredAt: Date;
  // Only set for creator_interaction, where the event belongs to the
  // member being replied to, not the message's own sender (Checkpoint 36).
  memberIdOverride?: string;
}

export interface ExtractContext {
  isNewMember: boolean;
  // Whether this member already has a 'participation' event within the
  // current window (Checkpoint 37) — computed by the worker via a DB
  // query, since this module stays free of I/O.
  hasRecentParticipation: boolean;
  messageText: string;
  occurredAt: Date;
}

function truncate(text: string, maxLength = 200): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

// Checkpoint 35: a brand-new member's first message produces both a
// 'joined' and a 'first_interaction' event — two distinct facts (they
// arrived; they said something) even though they happen at the same
// instant.
//
// Checkpoint 37: an EXISTING member's activity produces a lightweight
// 'participation' event, but only once per window — not once per
// message, or the ledger floods. A brand-new member's first_interaction
// already captures "they were active"; participation only applies to
// members who aren't new, so the two never double up on the same
// message.
export function extractEvents(context: ExtractContext): ExtractedEvent[] {
  const events: ExtractedEvent[] = [];

  if (context.isNewMember) {
    events.push({
      type: 'joined',
      payload: {},
      occurredAt: context.occurredAt,
    });
    events.push({
      type: 'first_interaction',
      payload: { messagePreview: truncate(context.messageText) },
      occurredAt: context.occurredAt,
    });
  } else if (!context.hasRecentParticipation) {
    events.push({
      type: 'participation',
      payload: {},
      occurredAt: context.occurredAt,
    });
  }

  return events;
}

// Checkpoint 36: a creator_interaction event is only meaningful when the
// creator is replying to a *specific* member — RelationshipEvent.memberId
// is required (schema), so a generic creator announcement with no
// reply_to_message has no member to attach an event to and correctly
// produces nothing.
export interface CreatorReplyContext {
  isFromCreator: boolean;
  replyToTelegramUserId?: bigint;
  creatorTelegramUserId?: bigint;
}

// Returns the Telegram user ID being replied to, if this message qualifies
// as a creator-to-member interaction — null otherwise. The worker still
// has to look up whether that Telegram user is actually a tracked Member
// (I/O), which is why this stays a plain predicate rather than returning
// a full event.
export function detectCreatorInteractionTarget(context: CreatorReplyContext): bigint | null {
  if (!context.isFromCreator) {
    return null;
  }
  if (context.replyToTelegramUserId === undefined || context.creatorTelegramUserId === undefined) {
    return null;
  }
  if (context.replyToTelegramUserId === context.creatorTelegramUserId) {
    return null; // Replying to themselves isn't an interaction with a member.
  }
  return context.replyToTelegramUserId;
}

export function buildCreatorInteractionEvent(
  messageText: string,
  occurredAt: Date,
): ExtractedEvent {
  return {
    type: 'creator_interaction',
    payload: { messagePreview: truncate(messageText) },
    occurredAt,
  };
}

// Checkpoint 38: messages the rule-based extraction above can't classify
// at all — currently, anything without text (photos, stickers, voice
// notes, etc.), since every rule above depends on message.text. Off by
// default (ENABLE_OPENAI_FALLBACK, packages/shared) — ambiguous messages
// are simply skipped/logged, never sent anywhere. This exists so the
// code path is real and testable, not as a tuned classifier.
export interface AmbiguousMessageContext {
  messageType: string;
}

export async function classifyAmbiguousMessage(
  context: AmbiguousMessageContext,
): Promise<ExtractedEvent['type'] | null> {
  if (!ENABLE_OPENAI_FALLBACK) {
    console.log(
      `Skipping ambiguous message (type: ${context.messageType}) — OpenAI fallback is disabled.`,
    );
    return null;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('ENABLE_OPENAI_FALLBACK is true but OPENAI_API_KEY is not set — skipping.');
    return null;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            "Classify a Telegram message that has no text content (e.g. a photo, sticker, or voice note) as either 'participation' or 'none'. Respond with only that single word.",
        },
        { role: 'user', content: `Message type: ${context.messageType}` },
      ],
      max_tokens: 5,
    }),
  });

  if (!response.ok) {
    console.error('OpenAI fallback request failed with status', response.status);
    return null;
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const guess = data.choices?.[0]?.message?.content?.trim().toLowerCase();

  return guess === 'participation' ? 'participation' : null;
}
