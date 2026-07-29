// Minimal outbound client for the Telegram Bot API.
//
// The agent receives Telegram updates via the webhook
// (apps/web/app/api/telegram/webhook/route.ts) and processes them in the
// telegram-ingest worker, but every previous checkpoint only needed to
// READ updates — there was no path for the bot to send anything back.
// The onboarding flow (Steps 2-5 of the spec) is the first feature that
// needs the bot to write to Telegram: welcome messages, "I joined your
// group but I need admin permissions" warnings, success notifications,
// and the dashboard-redirect default reply. This module is that
// outbound path.
//
// Uses raw fetch() against the official Bot API
// (https://core.telegram.org/bots/api) rather than a third-party SDK —
// the surface area needed is small (one endpoint, sendMessage), and a
// direct fetch call avoids dragging a dependency tree into apps/agent
// for a single HTTP POST. Adding node-telegram-bot-api / telegraf is
// out of scope for this checkpoint and would change more than the
// onboarding flow requires.

import { sanitizeEnvValue } from '@kindred/minds-client';

// apply the same invisible-character scrub we use for Minds credentials
// (see the long comment on INVISIBLE_FORMATTING_CHARS in
// packages/minds-client/index.ts for the root-cause analysis). Bot
// tokens are also pasted-from-dashboard values, so the same ByteString
// hazard applies to the URL we build here.
const BOT_TOKEN = sanitizeEnvValue(process.env.TELEGRAM_BOT_TOKEN ?? '');

const API_BASE = 'https://api.telegram.org';

export class TelegramApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = 'TelegramApiError';
  }
}

// Sends a text message to a Telegram chat. `chatId` is the numeric chat
// id (user id for private chats, negative group id for groups, etc.) —
// BigInt-typed because Telegram chat ids are wider than Number's safe
// integer range for some accounts; we coerce to a string for the URL
// path so the id is never truncated.
export async function sendTelegramMessage(chatId: bigint, text: string): Promise<void> {
  if (!BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set.');
  }

  const url = `${API_BASE}/bot${BOT_TOKEN}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId.toString(),
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new TelegramApiError(
      `sendMessage failed: HTTP ${response.status}`,
      response.status,
      body,
    );
  }
}
