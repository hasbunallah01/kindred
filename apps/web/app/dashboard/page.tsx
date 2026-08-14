import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import {
  Users,
  Heart,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { auth } from '@/lib/auth';
import { prisma } from '@kindred/db';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { CommunityStatusCard } from '@/components/dashboard/CommunityStatusCard';
import { WhatKindredNoticed } from '@/components/dashboard/WhatKindredNoticed';
import { InsightListItem } from '@/components/dashboard/InsightListItem';

// Kindred Mind dashboard — the primary authenticated product
// surface. Answers one question: "What should the community
// creator know right now?"
//
// Information hierarchy:
//   1. Greeting (small, welcoming)
//   2. Community status card (the primary context — which
//      community is being monitored, connection state)
//   3. "What Kindred noticed" — the HERO intelligence
//   4. Community memory — three compact stat cards
//   5. Recent insights — meaningful observations only
//
// Check-in boilerplate filter: the Mind emits steady-state
// "Nth check-in" messages that are accurate but not useful
// for a creator-facing Overview. The agent SSE listener drops
// them at the boundary (see apps/agent/src/minds/sse-listener.ts),
// but defense-in-depth: we also filter at the UI layer so any
// check-in that slipped through (e.g. from older agent versions
// or the Minds API directly) is still hidden from Overview.
// These still appear on the full /dashboard/insights page.

// Pattern matches the Mind's canonical check-in format: the
// first line ends with "check-in" or "checkin." (e.g.
// "Forty-second check-in. Same read.").
function isCheckInBoilerplate(content: string): boolean {
  const firstLine = content.trim().split('\n', 1)[0] ?? '';
  return /\bcheck[-\s]?in\.?\s*$/i.test(firstLine);
}

function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return 'Hello';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Hello';
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect('/login');
  }

  const userId = session.user.id;
  const username = session.user.username ?? null;
  const email = session.user.email ?? null;

  // Find the creator's most recently created community. The Kindred
  // model is "one community per creator for the hackathon" but the
  // schema allows many — findFirst is the simplest correct read.
  const community = await prisma.community.findFirst({
    where: { creatorId: userId },
    orderBy: { createdAt: 'desc' },
  });

  // The four counts that drive the Community Memory strip. Each is a
  // real count against the same community.id — the cards intentionally
  // come AFTER the "What Kindred noticed" hero, so they're support,
  // not the headline.
  const memberCount = community
    ? await prisma.member.count({ where: { communityId: community.id } })
    : 0;

  const relationshipsLearned = community
    ? await prisma.relationshipEvent.count({
        where: { member: { communityId: community.id } },
      })
    : 0;

  // The "Moments" stat counts only the meaningful insights — the
  // check-in boilerplate is excluded so the count represents real
  // relationship intelligence, not internal monitoring events.
  const allInsights = community
    ? await prisma.insight.findMany({
        where: { communityId: community.id },
        select: { id: true, content: true, createdAt: true, source: true },
      })
    : [];

  const meaningfulMoments = allInsights.filter(
    (i) => !isCheckInBoilerplate(i.content),
  ).length;

  // For the hero we prefer a meaningful, non-check-in autonomous
  // insight. If none exists, fall back to the most recent
  // meaningful insight of any source. Check-in boilerplate is
  // excluded from the hero too — the hero should always be
  // human-facing, not a monitoring event.
  const meaningfulInsights = allInsights
    .filter((i) => !isCheckInBoilerplate(i.content))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const heroInsight = meaningfulInsights[0] ?? null;

  // Recent insights list: up to 3 of the most recent MEANINGFUL
  // insights (excluding the hero, so we don't double-show).
  // Capped at 3 (was 5) so the Overview surface stays focused on
  // signal, not on listing every event.
  const recentInsights = meaningfulInsights
    .filter((i) => (heroInsight ? i.id !== heroInsight.id : true))
    .slice(0, 3);

  const greeting = greetingFor(new Date());

  return (
    <DashboardShell username={username} email={email}>
      <div className="flex flex-col gap-5 sm:gap-6">
        {/* ==================== 1. GREETING ====================
            Intentionally small — the greeting welcomes, it doesn't
            dominate. The community card immediately below carries
            the visual weight. */}
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
            {greeting}, {username ?? 'there'} <span aria-hidden>👋</span>
          </h1>
          <p className="text-sm text-text-secondary sm:text-base">
            {community
              ? "Here's what Kindred noticed."
              : 'Connect your first community to start building memory.'}
          </p>
        </header>

        {/* ==================== 2. COMMUNITY STATUS (or welcome) ====================
            The primary context card — which community is connected,
            what's its status, where does the Mind live. The full
            purple gradient signals "this is the Kindred-managed
            surface" and gives the page its first color anchor. */}
        {community ? (
          <CommunityStatusCard community={community} />
        ) : (
          <section className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-white p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-text-primary">
                Connect your first community
              </h2>
              <p className="max-w-md text-sm text-text-secondary">
                Kindred learns the relationships inside your community over
                time. Choose where your community lives to get started.
              </p>
            </div>
            <Link
              href="/onboarding/group"
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        )}

        {/* ==================== 3. WHAT KINDRED NOTICED (hero) ====================
            The dashboard's hero intelligence. The most important
            single relationship observation the creator can see.
            Soft purple surface to read as "AI observation" — distinct
            from the white insight list below. */}
        {community && (
          <WhatKindredNoticed
            insight={heroInsight}
            communityTitle={community.telegramChatTitle}
          />
        )}

        {/* ==================== 4. COMMUNITY MEMORY (supporting metrics) ====================
            Three compact stat cards. The numbers come from real DB
            counts (not hard-coded) but they SUPPORT the hero above
            — they don't try to be the headline. On desktop they sit
            in a horizontal row; on mobile they stack. */}
        {community && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Community memory
            </h2>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
              <StatCard
                label="Members"
                value={memberCount.toLocaleString()}
                icon={<Users className="h-4 w-4" />}
                iconBgClass="bg-purple-light"
                iconColorClass="text-brand-primary"
                helpText="People Kindred knows"
              />
              <StatCard
                label="Relationships"
                value={relationshipsLearned.toLocaleString()}
                icon={<Heart className="h-4 w-4" />}
                iconBgClass="bg-soft-pink"
                iconColorClass="text-pink-500"
                helpText="Signals discovered"
              />
              <StatCard
                label="Moments"
                value={meaningfulMoments.toLocaleString()}
                icon={<Sparkles className="h-4 w-4" />}
                iconBgClass="bg-soft-amber"
                iconColorClass="text-amber-500"
                helpText="Meaningful remembered"
              />
            </div>
          </section>
        )}

        {/* ==================== 5. RECENT INSIGHTS (list) ====================
            Up to 3 MEANINGFUL insights (the check-in boilerplate
            filter is applied above). This is signal, not log —
            the raw history is on /dashboard/insights for anyone
            who wants it. */}
        {community && recentInsights.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Recent insights
              </h2>
              <Link
                href="/dashboard/insights"
                className="text-xs font-medium text-brand-primary transition-colors hover:text-brand-primary-hover"
              >
                View all
              </Link>
            </div>
            <ul className="flex flex-col gap-2">
              {recentInsights.map((insight) => (
                <li key={insight.id}>
                  <InsightListItem insight={insight} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}
