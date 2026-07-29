// Cross-app constants shared between apps/web (producer) and apps/agent
// (consumer) so both agree on queue names and job payload shapes without
// duplicating string literals or types in two places.
//
// Deviation from the Blueprint's literal file location, explained: Section
// 2's folder tree places this at apps/agent/queues/definitions.ts
// "(shared with web via package)" — but apps/web importing from inside
// apps/agent isn't a real package boundary (agent is meant to consume
// shared definitions, not the other way around). Putting it in
// packages/shared — already designated for "cross-app constants... used
// by both apps" — is the same intent via the correct dependency direction.

export const QUEUE_NAMES = {
  TELEGRAM_INGEST: 'telegram-ingest',
  MIND_DIGEST_SENDER: 'mind-digest-sender',
  MIND_STANDING_CHECK: 'mind-standing-check',
  MILESTONE_SCANNER: 'milestone-scanner',
  LINKING_CODE_EXPIRY: 'linking-code-expiry',
  // Checkpoint 53 / Telegram notification delivery: triggered after an
  // autonomous Insight is persisted by the Minds SSE listener
  // (apps/agent/src/minds/sse-listener.ts handleMindsSseEvent) to deliver
  // a short Telegram DM to the community's creator. The producer (the
  // SSE listener) and the consumer (this worker) live in the same app
  // (apps/agent) — the queue exists so the Telegram send happens off
  // the SSE hot path, and so a failed send can be retried by BullMQ
  // without losing the Insight.
  INSIGHT_NOTIFICATION: 'insight-notification',
} as const;

// The raw Telegram Update JSON is intentionally typed as `unknown` here —
// apps/agent's worker is responsible for narrowing/validating its actual
// shape (Blueprint Section 5.3: the webhook receiver does no processing,
// only enqueues).
export interface TelegramIngestJobData {
  update: unknown;
  receivedAt: string;
}

// Telegram notification delivery (Checkpoint 53): the SSE listener enqueues
// a job per autonomous Insight it persists, identified by `insightId`.
// Carrying only the id (rather than the full Insight payload) keeps the
// queue contract minimal and means a stale job that runs after the
// underlying Insight was updated still reads the freshest state from
// the database.
export interface InsightNotificationJobData {
  insightId: string;
}

// Build Plan Checkpoint 38 / Blueprint Sections 5.3 & 14: whether ambiguous
// messages (ones the rule-based extraction in
// apps/agent/src/telegram/extract-events.ts can't classify — currently,
// any non-text message: photos, stickers, voice notes) are sent to OpenAI
// for a best-guess classification. Off by default — ambiguous messages
// are simply skipped/logged instead. This is a plain constant, not an env
// var, so flipping it is a deliberate local code change, not something
// that can be silently toggled by configuration.
export const ENABLE_OPENAI_FALLBACK = false;
