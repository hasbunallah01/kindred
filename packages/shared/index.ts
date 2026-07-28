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
} as const;

// The raw Telegram Update JSON is intentionally typed as `unknown` here —
// apps/agent's worker is responsible for narrowing/validating its actual
// shape (Blueprint Section 5.3: the webhook receiver does no processing,
// only enqueues).
export interface TelegramIngestJobData {
  update: unknown;
  receivedAt: string;
}
