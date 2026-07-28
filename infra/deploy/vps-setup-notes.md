# Telegram Bot Setup — Kindred

Build Plan Checkpoint 25. This is a manual, one-time setup you do yourself
via Telegram's own BotFather — I have no way to create a Telegram bot or
hold a Telegram account on your behalf. Everything below is the exact
sequence; the results (bot token, username) feed the environment variables
the rest of Checkpoints 26–31 depend on.

## 1. Create the bot

1. Open Telegram, search for **@BotFather**, start a chat with it.
2. Send `/newbot`.
3. Give it a display name (e.g. `Kindred`).
4. Give it a username ending in `bot` (e.g. `KindredHQ_bot`) — this becomes
   `TELEGRAM_BOT_USERNAME`.
5. BotFather replies with a token that looks like `123456789:AAExampleTokenValue` —
   this is `TELEGRAM_BOT_TOKEN`. Treat it like a password: it grants full
   control of the bot. Never commit it — it goes in Vercel's Environment
   Variables and your local `.env` only.

## 2. Disable privacy mode (critical — do this now, not later)

By default, Telegram bots only see `/commands` and @mentions in a group,
not ordinary messages. Kindred's entire ingestion model (Blueprint Section
5) depends on seeing ordinary conversation, so this must be turned off
**before** the bot is added to any real community:

1. In the BotFather chat, send `/mybots`.
2. Select your bot → **Bot Settings** → **Group Privacy**.
3. Set it to **Disabled** (BotFather will confirm: "Privacy mode is
   disabled for @YourBotUsername").

This is a bot-wide setting, done once here — not something each creator
configures later (Blueprint Section 5.2).

## 3. Generate the webhook secret

`TELEGRAM_WEBHOOK_SECRET` is not issued by Telegram — it's a string *you*
generate and give to Telegram (via `setWebhook`, Checkpoint 30), which
Telegram then echoes back on every webhook request so we can verify it's
really them. Telegram requires it to match `^[A-Za-z0-9_-]{1,256}$`.

Generate one:
```bash
openssl rand -hex 32
```

## 4. What you should now have

Four values, ready for Vercel's Environment Variables (and your local
`.env`, gitignored):

| Variable | Source |
|---|---|
| `TELEGRAM_BOT_TOKEN` | BotFather's `/newbot` response |
| `TELEGRAM_BOT_USERNAME` | The username you chose (no `@`) |
| `TELEGRAM_WEBHOOK_SECRET` | Self-generated, step 3 above |
| — | Privacy mode confirmed disabled (step 2) |

## 5. What's still ahead (later checkpoints, not this one)

- **Checkpoint 29** builds the webhook receiver endpoint itself.
- **Checkpoint 30** is the actual `setWebhook` call registering that
  endpoint with Telegram, using the token and secret above — I can give
  you the exact command, but I cannot run it myself: `api.telegram.org`
  is not reachable from this sandbox's network (same class of
  restriction as the `binaries.prisma.sh` limitation documented since
  Checkpoint 5). It needs to be run from your own machine or CI, once a
  real deployment is live to point it at.
