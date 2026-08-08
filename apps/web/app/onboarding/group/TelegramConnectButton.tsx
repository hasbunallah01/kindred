'use client';

import { useState } from 'react';
import { PlatformCard } from '@/components/dashboard/PlatformCard';
import { FaTelegram } from 'react-icons/fa6';
import { FormError } from '@/components/auth/FormError';

// Client-side wrapper for the Telegram platform card on
// /onboarding/group. On click:
//   1. POST /api/telegram/link to mint a one-shot LinkRequest
//   2. Build a Telegram deeplink that opens the bot's PRIVATE chat
//      with /start <code> (NOT the group-picker shortcut)
//   3. window.location.assign(deeplink) — the browser navigates
//      away to Telegram, where:
//        a. the bot receives /start <code>, captures the creator's
//           Telegram user ID, and DMs a guided welcome message
//        b. the welcome includes an "Add me to your group" button
//           that opens the group-picker (t.me/<bot>?startgroup=true)
//        c. the user picks a group, the bot is added, my_chat_member
//           fires, the agent binds the chat to the pending link
//           request, and a Community row is created
//
// Why not jump straight to ?startgroup=<code>?
//   The user wanted the bot to guide them through onboarding, not
//   skip to a raw group picker. The bot's /start handler already
//   captures the creator's identity and DMs a copy-reviewed welcome;
//   the inline button on that welcome then opens the group picker in
//   a guided way. This matches the wireframe flow the user approved.
//
// Errors are surfaced inline via the same FormError component the
// auth pages use — calm red, no full-page error UI. The 401 case
// (session expired between the server-side check and this client
// call) sends the user back to /login.

interface LinkResponse {
  code: string;
  expiresAt: string;
}

// The bot's Telegram username. Read from env when set (so the
// deployment can override it); falls back to the production value
// for the local build. The deeplink we build is just a normal
// t.me/<bot> chat-open link with the linking code as the /start
// payload — Telegram renders that as a "/start <code>" message in
// the bot's private chat, which is the canonical "user opened the
// bot with a linking code" signal the agent's /start handler reads.
const BOT_USERNAME =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'KindredHaybeeBot';

function buildDeeplink(code: string): string {
  // ?start=<code> opens the bot's private chat and sends /start <code>
  // as a normal message. The agent's handleStartCommand reads the
  // code, captures the creator's Telegram user ID, and DMs the
  // welcome message that includes the "Add me to your group" button
  // (which itself opens t.me/<bot>?startgroup=true — the group
  // picker — so the user lands there with one extra click, but the
  // bot has already captured their identity and given them guidance).
  return `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(code)}`;
}

export function TelegramConnectButton() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setError(null);

    try {
      const response = await fetch('/api/telegram/link', { method: 'POST' });
      if (response.status === 401) {
        // Session expired mid-flow — bounce to /login.
        window.location.assign('/login');
        return;
      }
      if (!response.ok) {
        throw new Error('Could not generate a linking code. Please try again.');
      }
      const body = (await response.json()) as LinkResponse;
      const deeplink = buildDeeplink(body.code);
      // Hard navigation so the browser leaves the app entirely
      // (Telegram opens the deeplink, and the user comes back
      // through /onboarding/success → /dashboard when they're done).
      window.location.assign(deeplink);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setIsConnecting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isConnecting}
        className="block w-full text-left disabled:cursor-not-allowed disabled:opacity-60"
        aria-busy={isConnecting}
      >
        <PlatformCard
          name="Telegram"
          icon={<FaTelegram className="h-5 w-5" />}
          active
          ctaLabel={isConnecting ? 'Opening Telegram…' : 'Connect'}
          onActivate={handleClick}
        />
      </button>
      {error && <FormError message={error} />}
    </div>
  );
}
