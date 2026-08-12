import Link from 'next/link';
import { Sparkles, ChevronRight, Heart } from 'lucide-react';

// The "What Kindred noticed" hero — the centerpiece of the new
// dashboard hierarchy. Surfaces the most recent autonomous insight
// (or any insight, if there is no autonomous one yet) as a
// personalized observation, with the human-readable subject and
// timestamp the Mind would speak in.
//
// Reads a single `insight` from the existing Prisma query. If no
// insight exists yet, renders an empty state that points the user
// at what to expect rather than a fake placeholder — Kindred should
// feel patient, not performative.
export interface WhatKindredNoticedProps {
  insight: {
    id: string;
    content: string;
    createdAt: Date;
    source: string;
  } | null;
  communityTitle?: string | null;
}

function formatRelativeShort(date: Date): string {
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(diffSec) < 60) return 'just now';
  if (Math.abs(diffSec) < 3600) return rtf.format(-Math.round(diffSec / 60), 'minute');
  if (Math.abs(diffSec) < 86400) return rtf.format(-Math.round(diffSec / 3600), 'hour');
  if (Math.abs(diffSec) < 86400 * 7) return rtf.format(-Math.round(diffSec / 86400), 'day');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Picks a 1-2 line lead from a longer insight, to give the card
// a more "headline + summary" feel. Falls back to the full text if
// no suitable break is found.
function pickHeadline(content: string): { headline: string; body: string } {
  // The first sentence (split on . ! ? followed by whitespace or EOL)
  // is the headline; the rest is the body. Long insights keep the
  // full text on the card rather than truncating — the card scrolls.
  const trimmed = content.trim();
  const sentenceMatch = trimmed.match(/^([^.!?\n]+[.!?])(?:\s+|$)([\s\S]*)$/);
  if (sentenceMatch) {
    const [, firstSentence, rest] = sentenceMatch;
    if (firstSentence && firstSentence.length <= 180) {
      return { headline: firstSentence, body: (rest ?? '').trim() };
    }
  }
  // If first sentence is too long, find the first newline and use
  // everything up to it as the headline.
  const newlineIdx = trimmed.indexOf('\n');
  if (newlineIdx > 0 && newlineIdx <= 200) {
    return {
      headline: trimmed.slice(0, newlineIdx).trim(),
      body: trimmed.slice(newlineIdx + 1).trim(),
    };
  }
  return { headline: trimmed, body: '' };
}

export function WhatKindredNoticed({ insight, communityTitle }: WhatKindredNoticedProps) {
  if (!insight) {
    return (
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary sm:text-base">
            <Sparkles className="h-4 w-4 text-brand-primary" />
            What Kindred noticed
          </h2>
        </div>
        <div className="rounded-2xl border border-dashed border-border bg-white p-6 text-center">
          <p className="text-sm text-text-secondary">
            Nothing yet. As your community talks, Kindred will surface the
            moments worth knowing about.
          </p>
        </div>
      </section>
    );
  }

  const { headline, body } = pickHeadline(insight.content);
  const isAutonomous = insight.source === 'autonomous';

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary sm:text-base">
          <Sparkles className="h-4 w-4 text-brand-primary" />
          What Kindred noticed
        </h2>
        <Link
          href="/dashboard/insights"
          className="text-xs font-medium text-brand-primary transition-colors hover:text-brand-primary-hover"
        >
          View all
        </Link>
      </div>
      <article className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-deep-purple text-sm font-semibold text-white">
            {isAutonomous ? 'K' : 'A'}
          </div>
          <div className="min-w-0 flex-1">
            {communityTitle && (
              <p className="text-xs font-medium text-text-secondary">
                About <span className="text-text-primary">{communityTitle}</span>
              </p>
            )}
            <p className="mt-1 text-base font-semibold leading-snug text-text-primary">
              {headline}
            </p>
            {body && (
              <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                {body}
              </p>
            )}
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-text-muted">
                {formatRelativeShort(insight.createdAt)}
              </p>
              <button
                type="button"
                aria-label="Save this insight"
                className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-soft-pink hover:text-pink-500"
              >
                <Heart className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        <Link
          href="/dashboard/insights"
          className="mt-4 flex items-center justify-center gap-1 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-white hover:text-text-primary"
        >
          See all insights
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </article>
    </section>
  );
}
