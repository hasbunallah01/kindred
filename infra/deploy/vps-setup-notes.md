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
not ordinary messages. Kindred's entire ingestion model (Blueprint Section 5) depends on seeing ordinary conversation, so this must be turned off
**before** the bot is added to any real community:

1. In the BotFather chat, send `/mybots`.
2. Select your bot → **Bot Settings** → **Group Privacy**.
3. Set it to **Disabled** (BotFather will confirm: "Privacy mode is
   disabled for @YourBotUsername").

This is a bot-wide setting, done once here — not something each creator
configures later (Blueprint Section 5.2).

## 3. Generate the webhook secret

`TELEGRAM_WEBHOOK_SECRET` is not issued by Telegram — it's a string _you_
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

| Variable                  | Source                                   |
| ------------------------- | ---------------------------------------- |
| `TELEGRAM_BOT_TOKEN`      | BotFather's `/newbot` response           |
| `TELEGRAM_BOT_USERNAME`   | The username you chose (no `@`)          |
| `TELEGRAM_WEBHOOK_SECRET` | Self-generated, step 3 above             |
| —                         | Privacy mode confirmed disabled (step 2) |

## 5. What's still ahead (later checkpoints, not this one)

- **Checkpoint 29** builds the webhook receiver endpoint itself.
- **Checkpoint 30** is the actual `setWebhook` call registering that
  endpoint with Telegram, using the token and secret above — I can give
  you the exact command, but I cannot run it myself: `api.telegram.org`
  is not reachable from this sandbox's network (same class of
  restriction as the `binaries.prisma.sh` limitation documented since
  Checkpoint 5). It needs to be run from your own machine or CI, once a
  real deployment is live to point it at.

---

## 6. Registering the webhook (Checkpoint 30)

Once the app is deployed and reachable at `https://kindred.haybee.xyz`
(confirmed via Checkpoint 29's `/api/telegram/webhook` route existing),
run this from your own machine — a terminal with `curl`:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d url="https://kindred.haybee.xyz/api/telegram/webhook" \
  -d secret_token="<TELEGRAM_WEBHOOK_SECRET>" \
  -d drop_pending_updates=true
```

Replace both placeholders with your real values (never paste the real
token in a shared/public place). A successful response looks like:

```json
{ "ok": true, "result": true, "description": "Webhook was set" }
```

**To verify it's actually registered** (useful for debugging later):

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

This returns the currently-registered URL, any recent delivery errors,
and a pending-update count — the first place to look if messages aren't
arriving.

**To confirm delivery is actually flowing**: send a plain message (not a
command) in a group where the bot is a member (privacy mode already
disabled per step 2), then check the webhook route's logs (Vercel →
your project → Logs, filtered to `/api/telegram/webhook`) for a
corresponding invocation.

## 7. Mind standing instructions (Checkpoint 45)

Every community's Mind conversation is given a fixed standing instruction
automatically, right when the conversation is created (see
`apps/agent/src/workers/telegram-ingest.worker.ts`, `handleLinkingCode`):

> "Watch for members who were consistently active and have gone unusually
> quiet. When this happens, tell me who they are and why they mattered.
> Also tell me when someone returns after an absence, and flag meaningful
> upcoming anniversaries."

This is Blueprint Section 6.2's example directive, sent via a plain
`SendMessage` call (`setStandingInstructions` in
`packages/minds-client/index.ts`) — the documented API surface has no
dedicated "set standing instructions" endpoint, so this is the Build
Plan's own specified fallback for that gap.

**To verify it's actually present and durable** (once you have a real
linked test community): call `getMessageHistory(alias)` and confirm the
instruction text appears as the first message in the conversation, then
call it again in a fresh process/request to confirm it's still there —
i.e., that it's part of the Mind's persistent memory, not something that
only existed for the lifetime of one request.
