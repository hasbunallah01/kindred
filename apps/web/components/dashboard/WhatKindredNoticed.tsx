import Link from 'next/link';
import { Sparkles, Heart } from 'lucide-react';

// The "What Kindred noticed" hero — the centerpiece of the new
// dashboard hierarchy. Surfaces the most recent autonomous insight
// (or any insight, if there is no autonomous one yet) as a
// personalized observation, with the human-readable subject and
// timestamp the Mind would speak in.
//
// Per the 2026 reference: the entire card sits on a soft purple
// (#EDE9FE) background so it reads as the dashboard's "AI
// observation" surface — visually distinct from the white insight
// list below. The K avatar (Kindred's mark) sits inside the card
// on a darker purple circle, anchoring the body text to the
// brand.
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
  const trimmed = content.trim();
  const sentenceMatch = trimmed.match(/^([^.!?\n]+[.!?])(?:\s+|$)([\s\S]*)$/);
  if (sentenceMatch) {
    const [, firstSentence, rest] = sentenceMatch;
    if (firstSentence && firstSentence.length <= 180) {
      return { headline: firstSentence, body: (rest ?? '').trim() };
    }
  }
  const newlineIdx = trimmed.indexOf('\n');
  if (newlineIdx > 0 && newlineIdx <= 200) {
    return {
      headline: trimmed.slice(0, newlineIdx).trim(),
      body: trimmed.slice(newlineIdx + 1).trim(),
    };
  }
  return { headline: trimmed, body: '' };
}

export function WhatKindredNoticed({ insight }: WhatKindredNoticedProps) {
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

      {/* The hero card. Soft purple background so the whole block
          reads as "AI observation surface" — distinct from the
          white insight list below. Subtle border for definition;
          rounded-2xl matches the rest of the dashboard.
          Sized to be visually prominent without dominating the
          page on phone screens — the reference image shows the
          card fitting in roughly a third of the visible
          viewport on a 360px-wide phone. */}
      <article className="rounded-2xl border border-purple-200 bg-purple-light p-3.5 sm:p-4">
        <div className="flex items-start gap-2.5">
          {/* K avatar — solid purple circle, the brand mark
              anchoring the card. Sits next to the body text. */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-deep-purple text-xs font-semibold text-white">
            K
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug text-text-primary">
              {headline}
            </p>
            {body && (
              <p className="mt-1 text-xs leading-relaxed text-text-secondary line-clamp-3">
                {body}
              </p>
            )}
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[11px] text-text-muted">
                {formatRelativeShort(insight.createdAt)}
              </p>
              <span
                aria-hidden
                className="flex h-6 w-6 items-center justify-center rounded-full text-text-muted transition-colors"
              >
                <Heart className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}
