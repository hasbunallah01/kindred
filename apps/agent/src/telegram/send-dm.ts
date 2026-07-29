// Telegram Bot API client for Kindred agent.
//
// Deliberately a thin wrapper over the official `sendMessage` endpoint
// (https://core.telegram.org/bots/api#sendmessage) — the agent only
// sends DMs to a known creator and only ever attaches a single inline
// URL button. Pulling in a third-party Telegram SDK (e.g. telegraf,
// grammY) would add a dependency, a long type surface, and a layer of
// indirection over a 3-field POST — for one endpoint, fetch is the
// right tool.
//
// Lives under apps/agent (not as a new package) because it is consumed
// only by the insight-notification worker; promoting it to
// packages/* would be premature.

const TELEGRAM_API_BASE = 'https://api.telegram.org';

export interface InlineKeyboardButton {
  text: string;
  url: string;
}

// Sent to the official sendMessage endpoint. The `chat_id` here is the
// numeric Telegram user id of the recipient (the creator), not a chat
// id — this client is for direct messages, not group posts. Group
// notifications are explicitly out of scope for Kindred's bot.
export interface SendDmOptions {
  chatId: bigint;
  text: string;
  button: InlineKeyboardButton;
}

// Same invisible-unicode formatting marks that broke
// packages/minds-client/index.ts (see the long comment there) can
// also be pasted into TELEGRAM_BOT_TOKEN. The Bot API will accept the
// token into the URL path, but if it contains e.g. a left-to-right
// mark the request will hit a different (nonexistent) bot and return
// 404 — confusing, because the env var visually "looks right". Strip
// them before composing the URL.
const INVISIBLE_FORMATTING_CHARS = /[\u200B-\u200F\uFEFF\u202A-\u202E]/g;

function sanitizeEnvValue(value: string): string {
  return value.replace(INVISIBLE_FORMATTING_CHARS, '').trim();
}

interface TelegramApiResponse {
  ok: boolean;
  description?: string;
}

// Sends a single DM with one inline button. Throws on transport / API
// errors so the surrounding BullMQ worker can decide whether to retry
// or mark the Notification as failed.
export async function sendTelegramDm(options: SendDmOptions): Promise<void> {
  const rawToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!rawToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set.');
  }
  const token = sanitizeEnvValue(rawToken);

  // Bot API requires chat_id as a JSON number, not a string. bigint
  // is safe to convert with toString() — Telegram user ids fit in
  // 64 bits, and JSON.stringify handles plain numbers up to 2^53,
  // which covers all real Telegram accounts.
  const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;
  const body = {
    chat_id: options.chatId.toString(),
    text: options.text,
    // parse_mode is intentionally omitted: the short notification text
    // is plain prose (emoji + a couple of words) and doesn't need
    // Markdown/HTML parsing, and omitting it sidesteps the
    // "Bad Request: can't parse entities" failure mode that hits
    // whenever a notification contains an unescaped <, &, or *.
    reply_markup: {
      inline_keyboard: [[options.button]],
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as TelegramApiResponse | null;
  if (!response.ok || payload?.ok === false) {
    const description = payload?.description ?? '';
    throw new Error(
      `telegram sendMessage failed: HTTP ${response.status} ${description}`.trim(),
    );
  }
}
