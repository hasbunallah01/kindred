'use client';

import { useState, type FormEvent } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';

// Client component that owns the open/close state for the Ask
// Kindred modal on /dashboard/ask. The page itself is a server
// component (so it can read the community directly from Prisma);
// it renders this launcher with the communityId + communityTitle,
// and the launcher renders a button that opens the modal. The
// modal is NOT rendered at SSR — only the button — so the
// modal's full-page overlay only appears after the user clicks
// "Ask a question", which is the correct UX.
//
// We deliberately do NOT use the existing <AskKindredModal/>
// component here: that component is a controlled modal meant to
// be embedded by another client component that already owns
// open/close state. The /dashboard/ask page didn't have such a
// parent, so embedding it directly caused a 500 (the page tried
// to render a full-page overlay with a server-supplied onClose
// ref, which RSC couldn't serialize). This launcher implements
// the same UX inline.

interface AskKindredLauncherProps {
  communityId: string;
  communityTitle: string;
}

export function AskKindredLauncher({ communityId, communityTitle }: AskKindredLauncherProps) {
  const [isOpen, setIsOpen] = useState(false);
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

      const data = (await response.json().catch(() => ({}))) as {
        answer?: string;
        insightId?: string;
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
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover"
      >
        <MessageSquare className="h-4 w-4" />
        Ask a question
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-text-primary">
                Ask {communityTitle}
              </h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-purple-light hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Who is Sarah? Who has been most active lately?"
                rows={3}
                required
                className="resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
              <button
                type="submit"
                disabled={isSubmitting || !question.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {isSubmitting ? 'Asking…' : 'Ask'}
              </button>
            </form>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}

            {answer && (
              <div className="rounded-xl border border-border bg-purple-light/50 p-4 text-sm leading-relaxed text-text-primary">
                {answer}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
