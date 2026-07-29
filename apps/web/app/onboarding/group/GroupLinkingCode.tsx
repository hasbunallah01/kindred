'use client';

import { useEffect, useState } from 'react';
import { LinkingCodeDisplay } from '@/components/settings/LinkingCodeDisplay';

interface LinkCodeResponse {
  code: string;
  expiresAt: string;
  // Full deep link the Connect Telegram button should open. The
  // /api/telegram/link route now returns this so the client doesn't
  // need TELEGRAM_BOT_USERNAME in NEXT_PUBLIC_* env vars.
  botUrl: string;
}

export function GroupLinkingCode() {
  const [data, setData] = useState<LinkCodeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCode = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/telegram/link', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Could not generate a linking code. Please try again.');
      }
      const body = (await response.json()) as LinkCodeResponse;
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchCode();
  }, []);

  if (isLoading) {
    return <p className="text-sm text-neutral-400">Generating your code…</p>;
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-red-400">{error ?? 'Something went wrong.'}</p>
        <button
          onClick={() => void fetchCode()}
          className="text-sm text-neutral-400 underline hover:text-neutral-200"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <a
        href={data.botUrl}
        target="_blank"
        rel="noreferrer"
        className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950"
      >
        Connect Telegram
      </a>
      <LinkingCodeDisplay code={data.code} expiresAt={data.expiresAt} />
      <p className="text-xs text-neutral-500">
        Press <strong>Start</strong> in Telegram, then add the bot to your group and grant admin
        permissions. Or post{' '}
        <code className="text-neutral-300">/link {data.code}</code> directly in the group.
      </p>
      <button
        onClick={() => void fetchCode()}
        className="text-xs text-neutral-500 underline hover:text-neutral-300"
      >
        Generate a new code
      </button>
    </div>
  );
}
