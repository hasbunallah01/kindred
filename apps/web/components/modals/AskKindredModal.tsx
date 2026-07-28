'use client';

import { useState, type FormEvent } from 'react';

interface AskKindredModalProps {
  communityId: string;
  onClose: () => void;
}

interface AskResponse {
  answer: string;
  insightId: string;
}

export function AskKindredModal({ communityId, onClose }: AskKindredModalProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setAnswer(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/insights/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ communityId, question }),
      });

      const data = (await response.json().catch(() => ({}))) as Partial<AskResponse> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? 'Something went wrong.');
      }

      setAnswer(data.answer ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Ask Kindred</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-neutral-500 hover:text-neutral-300"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Who is Sarah?"
            rows={2}
            required
            className="resize-none rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
          />
          <button
            type="submit"
            disabled={isSubmitting || !question.trim()}
            className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
          >
            {isSubmitting ? 'Asking…' : 'Ask'}
          </button>
        </form>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {answer && (
          <div className="rounded border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200">
            {answer}
          </div>
        )}
      </div>
    </div>
  );
}
