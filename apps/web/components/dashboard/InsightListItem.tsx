import Link from 'next/link';
import { ChevronRight, Sparkles, Heart, TrendingUp, Users, MessageCircle } from 'lucide-react';

// Single insight row in the "Recent insights" list. Each row is
// a small AI-observation card: icon + text + relative time + a
// heart "save" affordance + a chevron to the full insights page.
//
// The icon is chosen from a small set keyed off the leading
// non-whitespace character of the insight content. This is a soft
// heuristic — Kindred will eventually send its own `icon` field
// on Insight rows; until then, choosing from the first character
// gives the list a varied, AI-observation feel without inventing
// fake categorization.
export interface InsightListItemProps {
  insight: {
    id: string;
    content: string;
    createdAt: Date;
    source: string;
  };
  href?: string;
}

function formatTimestamp(date: Date): { primary: string; secondary: string } {
  // Two-line timestamp: "Today, 9:30 AM" or "Yesterday, 8:15 AM" or
  // "Mar 14, 7:22 PM" for older. The agent's
  // humanization can refine this later; this is enough for the
  // demo and matches the reference copy verbatim.
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const insightDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((today.getTime() - insightDay.getTime()) / 86400000);

  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (dayDiff === 0) return { primary: `Today, ${time}`, secondary: '' };
  if (dayDiff === 1) return { primary: `Yesterday, ${time}`, secondary: '' };
  return {
    primary: date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    secondary: time,
  };
}

function pickIcon(content: string, source: string) {
  if (source === 'reactive') return MessageCircle;
  // Soft content-based heuristic — pick based on the first
  // recognizable keyword. Stable enough for the demo; will be
  // replaced with an explicit `icon` field on the Insight row
  // when the agent learns to send one.
  const lower = content.toLowerCase();
  if (lower.startsWith('↗') || lower.includes('engagement') || lower.includes('increased') || lower.includes('growth')) {
    return TrendingUp;
  }
  if (lower.includes('welcome') || lower.includes('returned') || lower.includes('active') || lower.includes('hasn')) {
    return Users;
  }
  return Sparkles;
}

export function InsightListItem({ insight, href = '/dashboard/insights' }: InsightListItemProps) {
  const Icon = pickIcon(insight.content, insight.source);
  const { primary, secondary } = formatTimestamp(insight.createdAt);
  const snippet = insight.content.split('\n')[0] || '';

  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-2xl border border-border bg-white p-3.5 transition-all hover:border-brand-primary/30 hover:shadow-sm sm:p-4"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-light text-brand-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-text-primary">
          {snippet}
        </p>
        <p className="mt-1 text-xs text-text-muted">
          {primary}
          {secondary ? <span className="text-text-muted/70"> · {secondary}</span> : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1 self-center">
        {/* Heart save affordance is a visual placeholder for the demo;
            saving an insight will be wired to a real API in a follow-up.
            Marked as a non-interactive span so the row (which is the
            Link) remains the only interactive element. */}
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Heart className="h-4 w-4" />
        </span>
        <ChevronRight className="h-4 w-4 text-text-muted transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
