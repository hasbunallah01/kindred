// Minimal Telegram Bot API client for the agent.
//
// Scope: only the call we need for the onboarding flow — sendMessage
// to a single chat (either a private chat by user id, or a group by
// chat id). No long-polling, no webhooks, no update parsing (the
// webhook receiver and the update narrow logic live elsewhere). Keeping
// the surface area small is the whole point: a focused wrapper around
// fetch makes the few call sites in this onboarding flow readable
// without dragging in a full Telegram SDK and its dependency tree.
//
// `sendMessage` is the documented Bot API call
// (https://core.telegram.org/bots/api#sendmessage). The agent's
// TELEGRAM_BOT_TOKEN is read at call time, not at module load, so a
// missing token only fails the first send, not module import.
//
// `replyMarkup` is an optional inline-keyboard payload. It is
// forwarded to Telegram verbatim (after JSON.stringify), so callers
// can attach any shape Telegram accepts — the only one the agent
// uses today is a single "Add me to your group" URL button on the
// /start welcome message that deep-links to the group picker. We
// keep the type loose on purpose: typing the full InlineKeyboardMarkup
// union (URL buttons, callback buttons, switch_inline buttons, etc.)
// would be a recurring chore for no current benefit, and an explicit
// `unknown` field is the right escape hatch for a thin client.

interface SendMessageArgs {
  chatId: number | bigint;
  text: string;
  replyMarkup?: unknown;
}

interface TelegramApiResponseOk {
  ok: true;
  result: unknown;
}

interface TelegramApiResponseErr {
  ok: false;
  description?: string;
  error_code?: number;
}

type TelegramApiResponse = TelegramApiResponseOk | TelegramApiResponseErr;

export async function sendMessage({ chatId, text, replyMarkup }: SendMessageArgs): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set.');
  }

  // The Bot API expects a JSON body. chat_id is serialized as a
  // number-as-string regardless of whether the input was a JS number
  // or a BigInt (the chat id may exceed Number.MAX_SAFE_INTEGER for
  // some groups, so callers pass BigInt from the Prisma BigInt
  // column; JSON.stringify(BigInt) would throw without a replacer).
  // reply_markup is only included when a caller passed one — sending
  // an empty object is valid but noisy and Telegram returns the same
  // result.
  const body: Record<string, unknown> = {
    chat_id: typeof chatId === 'bigint' ? chatId.toString() : chatId,
    text,
  };
  if (replyMarkup !== undefined) {
    body.reply_markup = replyMarkup;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as TelegramApiResponse | null;
  if (!response.ok || !payload?.ok) {
    const reason =
      payload && payload.ok === false
        ? (payload.description ?? `HTTP ${response.status}`)
        : `HTTP ${response.status}`;
    throw new Error(`Telegram sendMessage failed: ${reason}`);
  }
}
