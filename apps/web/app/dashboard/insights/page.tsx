import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { prisma } from '@kindred/db';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { InsightListItem } from '@/components/dashboard/InsightListItem';

// /dashboard/insights — the full insight feed. Same data source as
// the overview's "Recent insights" section but with no cap, and
// ordered newest-first. The dashboard nav links here from the
// sidebar and bottom nav, so the route must exist.

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

  const insights = community
    ? await prisma.insight.findMany({
        where: { communityId: community.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
    : [];

  return (
    <DashboardShell username={username} email={email}>
      <div className="flex flex-col gap-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to overview
        </Link>

        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Insights
          </h1>
          <p className="text-sm text-text-secondary sm:text-base">
            Everything Kindred has noticed about your community.
          </p>
        </header>

        {!community ? (
          <section className="rounded-2xl border border-dashed border-border bg-white p-8 text-center">
            <p className="text-sm text-text-secondary">
              No community connected yet.
            </p>
          </section>
        ) : insights.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-border bg-white p-8 text-center">
            <p className="text-sm text-text-secondary">
              No insights yet. As your community talks, Kindred will surface
              the moments worth knowing about.
            </p>
          </section>
        ) : (
          <ul className="flex flex-col gap-2">
            {insights.map((insight) => (
              <li key={insight.id}>
                <InsightListItem insight={insight} href={undefined} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardShell>
  );
}
