'use client';

import { useEffect, useState } from 'react';
import { LinkingCodeDisplay } from '@/components/settings/LinkingCodeDisplay';

interface LinkCodeResponse {
  code: string;
  expiresAt: string;
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
      <LinkingCodeDisplay code={data.code} expiresAt={data.expiresAt} />
      <button
        onClick={() => void fetchCode()}
        className="text-xs text-neutral-500 underline hover:text-neutral-300"
      >
        Generate a new code
      </button>
    </div>
  );
}
