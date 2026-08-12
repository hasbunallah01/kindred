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

// Kindred Mind dashboard (2026 redesign) — the primary authenticated
// product surface.
//
// Information hierarchy (per the redesign brief):
//   1. Greeting ("Good afternoon, haybeewriting6 👋")
//   2. Community status card (gradient purple, visually strong)
//   3. "What Kindred noticed" — the HERO, surfaces the most recent
//      insight as a personalized AI observation
//   4. Community Memory — three compact stat cards (Members /
//      Relationships / Moments), intentionally small because they
//      support the hero rather than dominate the page
//   5. Recent insights — list of AI-observation rows
//
// Server component: auth is real (not middleware-only), data is
// fetched per-request from Prisma. No mock data anywhere — every
// number on the page comes from a real query on real DB rows.

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

  const meaningfulMoments = community
    ? await prisma.insight.count({ where: { communityId: community.id } })
    : 0;

  // For the hero we prefer an "autonomous" insight (the Mind talking
  // on its own), but fall back to the most recent insight of any
  // source so the hero is never empty when there is data.
  const heroInsight = community
    ? await prisma.insight.findFirst({
        where: {
          communityId: community.id,
          source: 'autonomous',
        },
        orderBy: { createdAt: 'desc' },
      }) ??
      (await prisma.insight.findFirst({
        where: { communityId: community.id },
        orderBy: { createdAt: 'desc' },
      }))
    : null;

  // The recent-insights list: 5 most recent (excluding the hero
  // one, so we don't double-show it). Capped to 5 to keep the list
  // calm — anything more would push the user toward the dedicated
  // /dashboard/insights page.
  const recentInsights = community
    ? await prisma.insight.findMany({
        where: {
          communityId: community.id,
          ...(heroInsight ? { id: { not: heroInsight.id } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })
    : [];

  const greeting = greetingFor(new Date());

  return (
    <DashboardShell
      username={username}
      email={email}
      topRightAction={
        community
          ? {
              href: '/onboarding/group',
              label: 'Connect another community',
            }
          : null
      }
    >
      <div className="flex flex-col gap-7">
        {/* ==================== 1. GREETING ==================== */}
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            {greeting}, {username ?? 'there'} <span aria-hidden>👋</span>
          </h1>
          <p className="text-sm text-text-secondary sm:text-base">
            {community
              ? "Here's what Kindred noticed."
              : 'Connect your first community to start building memory.'}
          </p>
        </header>

        {/* ==================== 2. COMMUNITY STATUS (or welcome) ==================== */}
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
            This is the visual centerpiece of the new dashboard — the
            product's value proposition rendered as a real observation. */}
        {community && (
          <WhatKindredNoticed
            insight={heroInsight}
            communityTitle={community.telegramChatTitle}
          />
        )}

        {/* ==================== 4. COMMUNITY MEMORY (supporting metrics) ==================== */}
        {community && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Community memory
            </h2>
            <div className="grid grid-cols-3 gap-3">
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

        {/* ==================== 5. RECENT INSIGHTS (list) ==================== */}
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
