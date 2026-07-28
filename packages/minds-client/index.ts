// Thin, typed wrapper over the official Hello Minds Builder API
// (https://api.build.hellominds.ai). Confirmed against the Builder API
// docs: auth via an API key in an X-Api-Key header, CreateConversation
// keyed by mindId, SendMessage keyed by alias with a messageText field,
// GetMessageHistory paginated with after/limit (no fingerprint cursor),
// and SubscribeEvents exposed as a separate SSE endpoint.

const BASE_URL = 'https://api.build.hellominds.ai';

const ENDPOINTS = {
  createConversation: () => `${BASE_URL}/v1/messaging/conversation`,
  sendMessage: () => `${BASE_URL}/v1/messaging/message`,
  getMessageHistory: (alias: string) =>
    `${BASE_URL}/v1/messaging/histories/${encodeURIComponent(alias)}`,
};

// Confirmed real production bug (live test against the actual API, not
// a hypothetical): fetch's Headers implementation requires header
// VALUES to be ByteString-compatible (code points 0-255 only) and
// throws "Cannot convert argument to a ByteString" otherwise. An env
// var value copied from a dashboard "copy" button can carry invisible
// Unicode formatting marks (U+200E/U+200F LEFT-/RIGHT-TO-LEFT MARK,
// U+FEFF byte-order mark, U+200B zero-width space, U+202A-U+202E
// directional embedding/override marks) that are invisible when
// displayed but break exactly this. MINDS_BUILDER_API_KEY is the
// confirmed culprit — the only one of the configured Minds env vars
// placed directly into an HTTP header (X-Api-Key); MINDS_ID goes into
// a JSON body instead, which doesn't hit this specific restriction the
// same way, but the same invisible-character risk still applies there
// (a stray mark could cause a silent mismatch server-side) — so this
// sanitizer is applied to any env var value used in a request, not just
// header values.
const INVISIBLE_FORMATTING_CHARS = /[\u200B-\u200F\uFEFF\u202A-\u202E]/g;

export function sanitizeEnvValue(value: string): string {
  return value.replace(INVISIBLE_FORMATTING_CHARS, '').trim();
}

function authHeaders(): Record<string, string> {
  const rawApiKey = process.env.MINDS_BUILDER_API_KEY;
  if (!rawApiKey) {
    throw new Error('MINDS_BUILDER_API_KEY is not set.');
  }
  return {
    'X-Api-Key': sanitizeEnvValue(rawApiKey),
    'Content-Type': 'application/json',
  };
}

async function assertOk(response: Response, label: string): Promise<void> {
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${label} failed: HTTP ${response.status} ${body}`.trim());
  }
}

export interface MindsConversation {
  conversationId: string;
  alias: string;
}

// Creates a new conversation with the Kindred Mind. The official
// CreateConversation body takes both alias (the client-chosen handle
// every subsequent call will use to address this conversation) and
// mindId (from MINDS_ID). The alias is a fresh UUID generated per
// conversation.
export async function createConversation(): Promise<MindsConversation> {
  const rawMindId = process.env.MINDS_ID;
  if (!rawMindId) {
    throw new Error('MINDS_ID is not set.');
  }
  const mindId = sanitizeEnvValue(rawMindId);
  const alias = crypto.randomUUID();

  const response = await fetch(ENDPOINTS.createConversation(), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ alias, mindId }),
  });
  await assertOk(response, 'createConversation');
  return (await response.json()) as MindsConversation;
}

// A single message in a conversation. The official Builder API returns
// raw message records with the sender/recipient split, the body in
// `messageText`, and a `senderType` discriminator (1 = the user, the
// other value = the Mind). To keep call sites from having to know the
// API's internal encoding, the client normalizes to a familiar
// { role, content, createdAt } shape here — `role` is 'user' for the
// human side and 'assistant' for the Mind, derived from senderType.
export interface MindsMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  // The API's per-message fingerprint. Pass it back as the `after`
  // cursor on the next getMessageHistory call to fetch messages that
  // came after this one — confirmed against the live API response
  // (Checkpoint 51+).
  fingerprint?: string;
}

// SendMessage's actual response shape (confirmed against the live
// Builder API, Checkpoint 51+). It echoes the alias/conversationId
// and adds the new messageId — a record of the write, not a
// normalized MindsMessage. None of the current call sites read the
// return value, but typing it honestly matters: if a future caller
// expects `result.content`, an undefined-access would compile and
// only blow up at runtime.
export interface SendMessageResult {
  alias: string;
  conversationId: string;
  messageId: string;
  artifactIds: string[];
}

// Sends a message into the conversation identified by alias. The
// official Builder API takes both alias and messageText in the body
// (no conversation id in the path), so we pass alias through here
// rather than baking it into the URL.
export async function sendMessage(alias: string, content: string): Promise<SendMessageResult> {
  const response = await fetch(ENDPOINTS.sendMessage(), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ alias, messageText: content }),
  });
  await assertOk(response, 'sendMessage');
  return (await response.json()) as SendMessageResult;
}

export const STANDING_INSTRUCTIONS =
  'Watch for members who were consistently active and have gone unusually ' +
  'quiet. When this happens, tell me who they are and why they mattered. ' +
  'Also tell me when someone returns after an absence, and flag meaningful ' +
  'upcoming anniversaries.';

export async function setStandingInstructions(alias: string): Promise<SendMessageResult> {
  return sendMessage(alias, STANDING_INSTRUCTIONS);
}

// Builder API raw message record (confirmed against the live
// Checkpoint 51 response). Not part of the public client contract —
// kept module-local and normalized into MindsMessage before being
// returned to callers.
interface RawMindsMessage {
  messageText?: string;
  senderType?: number;
  createdAt?: string;
  fingerprint?: string;
}

export interface MessageHistoryPage {
  messages: MindsMessage[];
  // Forward-only cursor on the official API (the `after` query param).
  // Set to the last message's fingerprint when a page fills up, so the
  // caller can pass it back to fetch what came next. Undefined/absent
  // when the page wasn't full and there are no further messages.
  nextAfter?: string;
}

function normalizeMessage(raw: RawMindsMessage): MindsMessage {
  return {
    // Builder API convention (confirmed live): senderType === 1 is the
    // human side of the conversation; anything else is the Mind. We
    // surface a normalized role so call sites don't have to know the
    // discriminator.
    role: raw.senderType === 1 ? 'user' : 'assistant',
    content: raw.messageText ?? '',
    createdAt: raw.createdAt,
    fingerprint: raw.fingerprint,
  };
}

// Retrieves message history for a conversation. The official API
// paginates with `after` (a message fingerprint from the previous
// page's last item) and `limit`, not page/offset — confirmed against
// the live Builder API response (Checkpoint 51+).
//
// The API returns a bare JSON array, not an envelope — this function
// wraps it in { messages, nextAfter } for call-site ergonomics. The
// `nextAfter` is set whenever a full page comes back, so a caller can
// keep paginating until they get a short page.
export async function getMessageHistory(
  alias: string,
  after?: string,
  limit?: number,
): Promise<MessageHistoryPage> {
  const url = new URL(ENDPOINTS.getMessageHistory(alias));
  if (after) {
    url.searchParams.set('after', after);
  }
  if (limit !== undefined) {
    url.searchParams.set('limit', String(limit));
  }

  const response = await fetch(url.toString(), { headers: authHeaders() });
  await assertOk(response, 'getMessageHistory');
  const raw = (await response.json()) as RawMindsMessage[];

  const messages = raw.map(normalizeMessage);
  const last = messages[messages.length - 1];
  // If the caller specified a limit and we got exactly that many back,
  // assume there's more — the official API doesn't surface a
  // hasMore/nextPageToken in its response, so a full page is the only
  // signal we have. If no limit was set, the API returns everything
  // and there's nothing to page through.
  const nextAfter = limit !== undefined && messages.length === limit ? last?.fingerprint : undefined;

  return { messages, nextAfter };
}
