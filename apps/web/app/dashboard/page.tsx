import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import {
  Users,
  Heart,
  Sparkles,
  MessageSquare,
  Plus,
  Brain,
  Bell,
  ArrowRight,
  CircleHelp,
} from 'lucide-react';
import { auth } from '@/lib/auth';
import { prisma } from '@kindred/db';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { FaTelegram } from 'react-icons/fa6';

// Kindred Mind dashboard — the primary authenticated product surface.
//
// Composition:
//   - Greeting (time-of-day aware, uses the creator's username)
//   - Connected community card (if any) or welcome card
//   - Community Memory strip: members, relationships, meaningful moments
//   - Recent Insights: empty state when no insights yet, otherwise list
//   - Ask Kindred: empty state pointing the creator at the reactive
//     intelligence surface (the /dashboard/ask route)
//   - "What to expect": three concepts (Remember / Notice / Ask) that
//     teach the dashboard by living in it — no separate tour page
//
// Server component: the auth check is real (not middleware-only), the
// data is fetched per-request. The shell is a client component for
// the mobile drawer, but the content rendered inside is plain HTML.

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
  // schema allows many — `findFirst` is the simplest correct read.
  const community = await prisma.community.findFirst({
    where: { creatorId: userId },
    orderBy: { createdAt: 'desc' },
  });

  // Pull the count of members for the Community Memory strip. We
  // intentionally read only the counts we display; detailed member
  // lists live on /dashboard/community.
  const memberCount = community
    ? await prisma.member.count({ where: { communityId: community.id } })
    : 0;

  // "Relationships learned" is the count of RelationshipEvent rows
  // across this community's members. Each event represents a single
  // relationship signal — quiet participation, return after absence,
  // etc. — that Kindred's digest worker eventually batches to the
  // Mind. Showing the count here communicates "memory is forming"
  // without exposing the raw event log.
  const relationshipsLearned = community
    ? await prisma.relationshipEvent.count({
        where: { member: { communityId: community.id } },
      })
    : 0;

  // "Meaningful moments" = surfaced insights. The Insight table is
  // the public-facing subset of what the Mind has actually noticed.
  const meaningfulMoments = community
    ? await prisma.insight.count({ where: { communityId: community.id } })
    : 0;

  // The most recent few insights for the dashboard's preview. Capped
  // to 3 to keep the layout calm — more would push the rest of the
  // page below the fold.
  const recentInsights = community
    ? await prisma.insight.findMany({
        where: { communityId: community.id },
        orderBy: { createdAt: 'desc' },
        take: 3,
      })
    : [];

  const greeting = greetingFor(new Date());

  return (
    <DashboardShell username={username} email={email}>
      <div className="flex flex-col gap-8">
        {/* ==================== HEADER ==================== */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              {greeting}, {username ?? 'there'}
            </h1>
            <p className="text-sm text-text-secondary sm:text-base">
              {community
                ? 'Your community memory is beginning to take shape.'
                : 'Connect your first community to start building memory.'}
            </p>
          </div>
          {community && (
            <Link
              href="/onboarding/group"
              className="inline-flex items-center justify-center gap-1.5 self-start rounded-input border border-border bg-white px-3.5 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              Connect another community
            </Link>
          )}
        </header>

        {/* ==================== CONNECTED COMMUNITY (or WELCOME) ==================== */}
        {community ? (
          <section className="flex flex-col gap-3 rounded-card border border-border bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-input bg-brand-primary/10 text-brand-primary">
                <FaTelegram className="h-5 w-5" />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-base font-semibold text-text-primary">
                  {community.telegramChatTitle || 'My Telegram Community'}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                  Connected &middot; Learning
                </span>
              </div>
            </div>
            <Link
              href="/dashboard/community"
              className="text-sm font-medium text-brand-primary transition-colors hover:text-brand-primary-hover"
            >
              View community →
            </Link>
          </section>
        ) : (
          <section className="flex flex-col items-start gap-4 rounded-card border border-border bg-white p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-text-primary">
                Connect your first community
              </h2>
              <p className="max-w-md text-sm text-text-secondary">
                Kindred learns the relationships inside your community over time.
                Choose where your community lives to get started.
              </p>
            </div>
            <Link
              href="/onboarding/group"
              className="inline-flex items-center gap-1.5 rounded-input bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        )}

        {/* ==================== COMMUNITY MEMORY ==================== */}
        {community && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Community Memory
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard
                label="Members"
                value={memberCount.toLocaleString()}
                icon={<Users className="h-4 w-4" />}
                helpText="What Kindred remembers"
              />
              <StatCard
                label="Relationships learned"
                value={relationshipsLearned.toLocaleString()}
                icon={<Heart className="h-4 w-4" />}
                helpText="Quiet signals captured"
              />
              <StatCard
                label="Meaningful moments"
                value={meaningfulMoments.toLocaleString()}
                icon={<Sparkles className="h-4 w-4" />}
                helpText="Surfaced to you"
              />
            </div>
          </section>
        )}

        {/* ==================== RECENT INSIGHTS ==================== */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Recent Insights
            </h2>
            {community && recentInsights.length > 0 && (
              <Link
                href="/dashboard/insights"
                className="text-sm font-medium text-brand-primary transition-colors hover:text-brand-primary-hover"
              >
                View all →
              </Link>
            )}
          </div>
          {recentInsights.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {recentInsights.map((insight) => (
                <li
                  key={insight.id}
                  className="flex flex-col gap-1 rounded-card border border-border bg-white p-4 sm:p-5"
                >
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Brain className="h-3.5 w-3.5" />
                    {insight.createdAt.toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    {insight.memberId && (
                      <span className="text-text-muted">· about a member</span>
                    )}
                  </div>
                  <p className="text-sm text-text-primary">{insight.content}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Bell className="h-5 w-5" />}
              title="Your Mind is listening"
              description={
                community
                  ? 'Insights will appear here as your community talks.'
                  : 'Connect a community to start surfacing insights.'
              }
            />
          )}
        </section>

        {/* ==================== ASK KINDRED ==================== */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Ask Kindred
          </h2>
          <EmptyState
            icon={<MessageSquare className="h-5 w-5" />}
            title="Ask anything about your community"
            description={
              <span>
                Try{' '}
                <span className="italic text-text-primary">
                  &ldquo;Who has been consistently supporting the community
                  recently?&rdquo;
                </span>
              </span>
            }
            cta={
              <Link
                href="/dashboard/ask"
                className="inline-flex items-center gap-1.5 rounded-input bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover"
              >
                Ask Kindred
                <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
        </section>

        {/* ==================== WHAT TO EXPECT ==================== */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            What to expect
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ExpectCard
              title="Remember"
              body="People, conversations, milestones."
              icon={<Users className="h-4 w-4" />}
            />
            <ExpectCard
              title="Notice"
              body="Returning members and meaningful moments."
              icon={<Sparkles className="h-4 w-4" />}
            />
            <ExpectCard
              title="Ask"
              body="Questions about your community over time."
              icon={<CircleHelp className="h-4 w-4" />}
            />
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

// Small "what to expect" card used in the bottom section of the
// dashboard. Communicates the product's three core capabilities
// (Remember / Notice / Ask) without using the visual language of
// a feature list. Each card is intentionally small and quiet — the
// purpose is reassurance, not promotion.
function ExpectCard({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-white p-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-input bg-brand-primary/10 text-brand-primary">
        {icon}
      </div>
      <span className="text-sm font-semibold text-text-primary">{title}</span>
      <p className="text-xs text-text-secondary">{body}</p>
    </div>
  );
}
