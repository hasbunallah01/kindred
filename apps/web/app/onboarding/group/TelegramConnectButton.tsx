'use client';

import { useState } from 'react';
import { PlatformCard } from '@/components/dashboard/PlatformCard';
import { FaTelegram } from 'react-icons/fa6';
import { FormError } from '@/components/auth/FormError';

// Client-side wrapper for the Telegram platform card on
// /onboarding/group. On click:
//   1. POST /api/telegram/link to mint a one-shot LinkRequest
//   2. Build the Telegram deeplink from the returned code
//   3. window.location.assign(deeplink) — the browser navigates
//      away to Telegram, where the user picks a group and the bot
//      is added (which fires the my_chat_member event the agent
//      consumes to create the Community)
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
// for the local build. Whatever path is used, the link is a normal
// Telegram deeplink that opens the bot's chat/group selection
// dialog.
const BOT_USERNAME =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'KindredHaybeeBot';

function buildDeeplink(code: string): string {
  // ?startgroup=<code> opens a Telegram dialog asking the user which
  // group to add the bot to. The payload is sent along so the bot
  // can read the linking code without a separate /start in private.
  return `https://t.me/${BOT_USERNAME}?startgroup=${encodeURIComponent(code)}`;
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
