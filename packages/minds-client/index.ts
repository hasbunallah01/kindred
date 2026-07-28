// Thin, typed wrapper over the HelloMinds Messaging API (Blueprint
// Section 6.4). Build Plan Checkpoint 41 scope: CreateConversation,
// SendMessage, GetMessageHistory only — GetConversation and
// ListConversations are documented but not needed by any checkpoint in
// this build (Blueprint 6.4: "admin/ops tooling only, not creator-facing");
// SubscribeEvents is added separately at Checkpoint 47.
//
// CONFIRMED (from the Ethoswarm Bazaar "Hello Minds Messaging" listing,
// the only reachable documentation of this API — see Checkpoint 40's
// commit): auth via a Builder Access Key in an X-Access-Key header;
// each tool's HTTP method; SendMessage and GetConversation are keyed by
// "alias", not the raw conversationId; CreateConversation's response
// includes both; GetMessageHistory paginates with a "fingerprint"
// cursor, not a page/offset.
//
// NOT CONFIRMED: the exact URL sub-paths below. No OpenAPI spec, SDK, or
// rendered docs page was reachable from this sandbox — hellominds.ai/docs
// and build.hellominds.ai are both client-rendered apps this
// environment's fetch tool cannot execute. The paths below are
// constructed by ordinary REST convention from the documented tool names
// and are deliberately isolated in ENDPOINTS below as the one place to
// fix if they turn out to differ — check your own logged-in dashboard
// (which renders fine in a real browser) against these.

const BASE_URL = process.env.HELLOMINDS_API_URL ?? 'https://hellominds.ai';

const ENDPOINTS = {
  createConversation: () => `${BASE_URL}/api/messaging/conversations`,
  sendMessage: (alias: string) =>
    `${BASE_URL}/api/messaging/conversations/${encodeURIComponent(alias)}/messages`,
  getMessageHistory: (alias: string) =>
    `${BASE_URL}/api/messaging/conversations/${encodeURIComponent(alias)}/messages`,
};

function authHeaders(): Record<string, string> {
  const accessKey = process.env.MINDS_BUILDER_API_KEY;
  if (!accessKey) {
    throw new Error('MINDS_BUILDER_API_KEY is not set.');
  }
  return {
    'X-Access-Key': accessKey,
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

// Creates a new conversation with the Kindred Mind. Called once per
// Community at linking time (Checkpoint 42) — the returned alias is what
// every subsequent call in this file uses to address that conversation.
export async function createConversation(): Promise<MindsConversation> {
  const response = await fetch(ENDPOINTS.createConversation(), {
    method: 'POST',
    headers: authHeaders(),
  });
  await assertOk(response, 'createConversation');
  return (await response.json()) as MindsConversation;
}

export interface MindsMessage {
  role: string;
  content: string;
  createdAt?: string;
}

// Sends a message into the conversation identified by alias — used for
// batched relationship-event digests (Checkpoint 43), standing-check
// nudges (Checkpoint 46), and the reactive "Ask Kindred" flow
// (Checkpoint 49, called directly from apps/web).
export async function sendMessage(alias: string, content: string): Promise<MindsMessage> {
  const response = await fetch(ENDPOINTS.sendMessage(alias), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ content }),
  });
  await assertOk(response, 'sendMessage');
  return (await response.json()) as MindsMessage;
}

// Checkpoint 45: the documented API surface (CreateConversation,
// GetConversation, GetMessageHistory, ListConversations, SendMessage,
// SubscribeEvents — the same 6 tools confirmed at Checkpoint 41) has no
// dedicated "set standing instructions" endpoint. Per the Build Plan's
// own documented fallback for this exact case, standing instructions are
// established via an initial SendMessage carrying the directive as plain
// text, rather than a first-class API concept.
export const STANDING_INSTRUCTIONS =
  'Watch for members who were consistently active and have gone unusually ' +
  'quiet. When this happens, tell me who they are and why they mattered. ' +
  'Also tell me when someone returns after an absence, and flag meaningful ' +
  'upcoming anniversaries.';

export async function setStandingInstructions(alias: string): Promise<MindsMessage> {
  return sendMessage(alias, STANDING_INSTRUCTIONS);
}

export interface MessageHistoryPage {
  messages: MindsMessage[];
  // "fingerprint" per the documented pagination mechanism — a forward-only
  // cursor, not a page number or offset. Undefined/absent means no further
  // pages.
  nextFingerprint?: string;
}

// Retrieves message history for a conversation, optionally continuing
// from a prior page's fingerprint cursor. Used for digest verification
// (Checkpoint 44) and polling for the Mind's reactive answer
// (Checkpoint 49) when SSE isn't the delivery path in use.
export async function getMessageHistory(
  alias: string,
  fingerprint?: string,
): Promise<MessageHistoryPage> {
  const url = new URL(ENDPOINTS.getMessageHistory(alias));
  if (fingerprint) {
    url.searchParams.set('fingerprint', fingerprint);
  }

  const response = await fetch(url.toString(), { headers: authHeaders() });
  await assertOk(response, 'getMessageHistory');
  return (await response.json()) as MessageHistoryPage;
}
