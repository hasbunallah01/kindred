import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Activity,
} from 'lucide-react';
import { auth } from '@/lib/auth';
import { prisma } from '@kindred/db';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { InsightListItem } from '@/components/dashboard/InsightListItem';

// /dashboard/insights — "What has Kindred actually learned about
// my community and its relationships?"
//
// Information architecture:
//   1. Page header + community selector
//   2. Three summary metrics: Meaningful Moments / Relationship
//      Signals / Recent Changes (real DB counts, not hard-coded)
//   3. "What changed" — the primary feed of meaningful insights.
//      Check-in boilerplate is filtered out at the UI layer
//      (defense in depth — the agent SSE listener also drops it
//      at the boundary, but anything that slipped through from
//      older versions, the Minds API directly, or a future
//      regression is still hidden from the creator here).
//   4. "Relationship signals" — per-member observations (status
//      transitions: active / quiet / returning / etc.)
//   5. "Activity history" — raw check-ins, hidden by default
//      behind a toggle. Power users can expand to see the
//      internal pipeline. Advanced users only.

// Check-in pattern: "Forty-second check-in. Same read." or
// "198th check-in. State shifted." — the first line ends with
// "check-in" or "checkin.".
function isCheckInBoilerplate(content: string): boolean {
  const firstLine = content.trim().split('\n', 1)[0] ?? '';
  return /\bcheck[-\s]?in\.?\s*$/i.test(firstLine);
}

export default async function InsightsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect('/login');
  }

  const userId = session.user.id;
  const username = session.user.username ?? null;
  const email = session.user.email ?? null;

  const community = await prisma.community.findFirst({
    where: { creatorId: userId },
  });

  // Pull all insight rows once, then split them in-memory into
  // "meaningful" (primary feed) and "check-in" (system activity,
  // hidden by default). The agent SSE listener already drops
  // check-ins at the boundary, but the DB accumulated several
  // hundred check-in rows before that filter was added — the
  // isCheckInBoilerplate check below is defense in depth.
  const allInsights = community
    ? await prisma.insight.findMany({
        where: { communityId: community.id },
        orderBy: { createdAt: 'desc' },
        take: 500,
      })
    : [];

  const meaningfulInsights = allInsights.filter(
    (i) => !isCheckInBoilerplate(i.content),
  );
  const checkInActivity = allInsights.filter((i) =>
    isCheckInBoilerplate(i.content),
  );

  // Per-member relationship signals. The Member.status enum is
  // (active | quiet | inactive) — that's the natural "signal"
  // surface for "what Kindred has learned about a person."
  const members = community
    ? await prisma.member.findMany({
        where: { communityId: community.id },
        orderBy: { lastSeenAt: 'desc' },
        take: 20,
      })
    : [];

  const relationshipSignalsCount = community
    ? await prisma.relationshipEvent.count({
        where: { member: { communityId: community.id } },
      })
    : 0;

  // "Recent changes" = meaningful insights in the last 7 days.
  // A live "is anything actually new" signal for the creator.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentChanges = meaningfulInsights.filter(
    (i) => i.createdAt >= sevenDaysAgo,
  ).length;

  return (
    <DashboardShell username={username} email={email}>
      <div className="flex flex-col gap-5 sm:gap-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to overview
        </Link>

        {/* ==================== 1. PAGE HEADER ==================== */}
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
            Insights
          </h1>
          <p className="text-sm text-text-secondary sm:text-base">
            The relationship signals and meaningful moments Kindred has
            discovered.
          </p>
          {community && (
            <p className="mt-1 text-xs text-text-muted">
              {community.telegramChatTitle ?? 'Your community'}
            </p>
          )}
        </header>

        {!community ? (
          <section className="rounded-2xl border border-dashed border-border bg-white p-8 text-center">
            <p className="text-sm text-text-secondary">
              No community connected yet.
            </p>
          </section>
        ) : (
          <>
            {/* ==================== 2. SUMMARY METRICS ====================
                Three compact counters. All real DB values:
                - Meaningful Moments: count of insights that aren't
                  check-in boilerplate
                - Relationship Signals: count of RelationshipEvent
                  rows across the community's members
                - Recent Changes: meaningful insights in the last 7
                  days — a "is anything new" pulse */}
            <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
              <SummaryCard
                icon={<Sparkles className="h-4 w-4" />}
                iconBgClass="bg-purple-light"
                iconColorClass="text-brand-primary"
                label="Meaningful moments"
                value={meaningfulInsights.length.toLocaleString()}
                helpText="Insights Kindred has surfaced"
              />
              <SummaryCard
                icon={<Activity className="h-4 w-4" />}
                iconBgClass="bg-soft-pink"
                iconColorClass="text-pink-500"
                label="Relationship signals"
                value={relationshipSignalsCount.toLocaleString()}
                helpText="Member-level observations"
              />
              <SummaryCard
                icon={<TrendingUp className="h-4 w-4" />}
                iconBgClass="bg-soft-emerald"
                iconColorClass="text-emerald-500"
                label="Recent changes"
                value={recentChanges.toLocaleString()}
                helpText="In the last 7 days"
              />
            </section>

            {/* ==================== 3. WHAT CHANGED ====================
                The primary feed of meaningful relationship changes.
                Empty state is clean and honest (better than showing
                100 useless check-ins). */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  What changed
                </h2>
                {meaningfulInsights.length > 0 && (
                  <span className="text-xs text-text-muted">
                    {meaningfulInsights.length}{' '}
                    {meaningfulInsights.length === 1 ? 'insight' : 'insights'}
                  </span>
                )}
              </div>
              {meaningfulInsights.length === 0 ? (
                <section className="rounded-2xl border border-dashed border-border bg-white p-8 text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-purple-light">
                    <Sparkles className="h-5 w-5 text-brand-primary" />
                  </div>
                  <p className="text-sm font-medium text-text-primary">
                    No new relationship insights yet.
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    Kindred is watching your community. When something
                    meaningful changes, you'll see it here.
                  </p>
                </section>
              ) : (
                <ul className="flex flex-col gap-2">
                  {meaningfulInsights.slice(0, 30).map((insight) => (
                    <li key={insight.id}>
                      <InsightListItem insight={insight} href={undefined} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ==================== 4. RELATIONSHIP SIGNALS ====================
                Per-member observations. The Member table tracks
                status (active/quiet/inactive) and last-seen — that's
                the relationship signal Kindred has learned about
                each person. Rendered as compact rows with a status
                indicator. */}
            {members.length > 0 && (
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Relationship signals
                  </h2>
                  <span className="text-xs text-text-muted">
                    {members.length} {members.length === 1 ? 'person' : 'people'}
                  </span>
                </div>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {members.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3.5"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-light text-sm font-semibold text-brand-primary">
                        {m.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text-primary">
                          {m.displayName}
                        </p>
                        <p className="flex items-center gap-1.5 text-xs text-text-muted">
                          <MemberStatusIcon status={m.status} />
                          <span>{memberStatusLabel(m.status)}</span>
                          <span className="text-text-muted/60">·</span>
                          <span>
                            last seen{' '}
                            {m.lastSeenAt.toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ==================== 5. ACTIVITY HISTORY (collapsed) ====================
                Raw check-ins are useful internally but they are
                NOT user-facing insights. We expose them here
                behind a <details> toggle so power users can inspect
                the system's internal cadence without confusing the
                creator. Hidden by default. */}
            {checkInActivity.length > 0 && (
              <section className="flex flex-col gap-3">
                <details className="group rounded-2xl border border-border bg-white">
                  <summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary">
                    <span className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Activity history
                      <span className="text-xs font-normal text-text-muted">
                        · {checkInActivity.length} system{' '}
                        {checkInActivity.length === 1 ? 'check-in' : 'check-ins'}
                      </span>
                    </span>
                    <span className="text-xs text-text-muted group-open:hidden">
                      Show
                    </span>
                    <span className="hidden text-xs text-text-muted group-open:inline">
                      Hide
                    </span>
                  </summary>
                  <div className="border-t border-border px-4 py-3 text-xs text-text-muted">
                    <p className="mb-2">
                      These are Kindred's internal standing-check records.
                      The system runs them periodically to detect
                      relationship state changes. They're useful for
                      debugging but rarely useful to a community creator.
                      Meaningful interpretations are surfaced above.
                    </p>
                    <ul className="max-h-64 space-y-1 overflow-y-auto">
                      {checkInActivity.slice(0, 50).map((i) => (
                        <li
                          key={i.id}
                          className="flex items-center gap-2 rounded bg-surface px-2 py-1"
                        >
                          <Minus className="h-3 w-3 shrink-0 text-text-muted" />
                          <span className="truncate">
                            {i.content.split('\n')[0]}
                          </span>
                          <span className="ml-auto shrink-0 text-text-muted">
                            {i.createdAt.toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              </section>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}

// Small inline card used in the summary row. Same compact shape
// as the Community memory cards on Overview so the two surfaces
// share a visual language.
function SummaryCard({
  icon,
  iconBgClass,
  iconColorClass,
  label,
  value,
  helpText,
}: {
  icon: React.ReactNode;
  iconBgClass: string;
  iconColorClass: string;
  label: string;
  value: string;
  helpText?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-white p-3 sm:p-3.5">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-xl ${iconBgClass} ${iconColorClass}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold leading-none tracking-tight text-text-primary sm:text-2xl">
          {value}
        </p>
        <p className="mt-1 text-xs font-medium text-text-secondary">{label}</p>
        {helpText && <p className="mt-0.5 text-[10px] text-text-muted">{helpText}</p>}
      </div>
    </div>
  );
}

function memberStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Highly engaged';
    case 'quiet':
      return 'Becoming quieter';
    case 'inactive':
      return 'Went quiet';
    default:
      return status;
  }
}

function MemberStatusIcon({ status }: { status: string }) {
  if (status === 'active') {
    return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  }
  if (status === 'quiet') {
    return <Minus className="h-3 w-3 text-amber-500" />;
  }
  if (status === 'inactive') {
    return <TrendingDown className="h-3 w-3 text-text-muted" />;
  }
  return null;
}
