import Link from 'next/link';
import { Users, ChevronRight } from 'lucide-react';

// Gradient purple card that surfaces the community's connection
// status at a glance. Visually the strongest element on the page
// outside the hero — it's the "I see your community is hooked up"
// signal the user needs to feel before they trust anything else on
// the dashboard.
//
// Reads community.id, .telegramChatTitle, .createdAt, .status — all
// real data from the existing Prisma query in the page, no new
// fetches. The "Mind active" line is derived from the existence of
// mindsConversationId (set at community creation; if it's null, the
// Mind conversation never established and the line is hidden).
export interface CommunityStatusCardProps {
  community: {
    id: string;
    telegramChatTitle: string | null;
    createdAt: Date;
    status: string;
    mindsConversationId: string | null;
  };
}

function formatConnectedSince(date: Date): string {
  // Short relative-time formatter specifically for this card.
  // Mirrors the formatConnectedAgo in apps/web/app/dashboard/page.tsx
  // but kept inline so the component is self-contained and portable.
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(diffSec) < 60) return 'just now';
  if (Math.abs(diffSec) < 3600) return rtf.format(-Math.round(diffSec / 60), 'minute');
  if (Math.abs(diffSec) < 86400) return rtf.format(-Math.round(diffSec / 3600), 'hour');
  if (Math.abs(diffSec) < 86400 * 30) return rtf.format(-Math.round(diffSec / 86400), 'day');
  return rtf.format(-Math.round(diffSec / (86400 * 30)), 'month');
}

export function CommunityStatusCard({ community }: CommunityStatusCardProps) {
  const connected = formatConnectedSince(community.createdAt);
  const statusLabel = community.status === 'active' ? 'Learning' : 'Paused';
  const statusColor = community.status === 'active' ? 'bg-emerald-300' : 'bg-amber-300';
  const mindActive = community.mindsConversationId !== null;

  return (
    <Link
      href="/dashboard/community"
      className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-brand-primary to-deep-purple p-5 text-white shadow-lg transition-all hover:shadow-xl sm:p-6"
    >
      <div className="relative flex items-center gap-4">
        {/* Circular icon container — solid white-on-purple for
            strong contrast at small phone sizes. */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/25">
          <Users className="h-6 w-6 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-white sm:text-lg">
            {community.telegramChatTitle || 'My Telegram Community'}
          </h2>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-white sm:text-sm">
            <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${statusColor}`} />
            <span className="font-medium">{statusLabel}</span>
          </div>
          <div className="mt-0.5 text-xs text-white/90">
            Connected {connected}
            {mindActive ? <> · <span className="font-medium text-white">Mind active</span></> : null}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-white/80 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
