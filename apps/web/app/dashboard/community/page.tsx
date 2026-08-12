import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { ArrowLeft, Users, MessageCircle, Clock } from 'lucide-react';
import { auth } from '@/lib/auth';
import { prisma } from '@kindred/db';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { CommunityStatusCard } from '@/components/dashboard/CommunityStatusCard';

// /dashboard/community — detailed view of the creator's community:
// members, recent activity, and the most active participants.
//
// The dashboard nav links to this page from the sidebar and bottom
// nav, so the route must exist (otherwise 404 from the
// navigator). The page re-uses the same data the overview reads
// (community + member count) and adds:
//   - a member list (most recent first)
//   - the most recent relationship events for the community
//
// Server component. Auth check matches the dashboard.

export default async function CommunityPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect('/login');
  }

  const userId = session.user.id;
  const username = session.user.username ?? null;
  const email = session.user.email ?? null;

  const community = await prisma.community.findFirst({
    where: { creatorId: userId },
    orderBy: { createdAt: 'desc' },
  });

  const members = community
    ? await prisma.member.findMany({
        where: { communityId: community.id },
        orderBy: { lastSeenAt: 'desc' },
        take: 50,
      })
    : [];

  const recentEvents = community
    ? await prisma.relationshipEvent.findMany({
        where: { member: { communityId: community.id } },
        orderBy: { occurredAt: 'desc' },
        take: 20,
        include: { member: { select: { displayName: true } } },
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
            Community
          </h1>
          <p className="text-sm text-text-secondary sm:text-base">
            The people and moments Kindred is tracking.
          </p>
        </header>

        {!community ? (
          <section className="rounded-2xl border border-dashed border-border bg-white p-8 text-center">
            <p className="text-sm text-text-secondary">
              No community connected yet.{' '}
              <Link
                href="/onboarding/group"
                className="font-medium text-brand-primary"
              >
                Connect one
              </Link>{' '}
              to start building memory.
            </p>
          </section>
        ) : (
          <>
            <CommunityStatusCard community={community} />

            <section className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Members ({members.length})
              </h2>
              {members.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-white p-6 text-center text-sm text-text-secondary">
                  No members yet. Once people in your group send messages,
                  they'll appear here.
                </div>
              ) : (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {members.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-light text-sm font-semibold text-brand-primary">
                        {m.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text-primary">
                          {m.displayName}
                        </p>
                        <p className="text-xs text-text-muted">
                          Last seen{' '}
                          {m.lastSeenAt.toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Recent activity
              </h2>
              {recentEvents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-white p-6 text-center text-sm text-text-secondary">
                  No relationship events yet. As members participate, the
                  activity log fills in.
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {recentEvents.map((event) => (
                    <li
                      key={event.id}
                      className="flex items-start gap-3 rounded-2xl border border-border bg-white p-3.5"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-light text-brand-primary">
                        {event.type === 'participation' ? (
                          <MessageCircle className="h-3.5 w-3.5" />
                        ) : event.type === 'joined' ? (
                          <Users className="h-3.5 w-3.5" />
                        ) : (
                          <Clock className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text-primary">
                          <span className="font-medium">{event.member.displayName}</span>{' '}
                          <span className="text-text-secondary">
                            {event.type === 'joined' && 'joined'}
                            {event.type === 'first_interaction' && 'sent their first message'}
                            {event.type === 'participation' && 'was active'}
                            {event.type === 'creator_interaction' && 'received a reply from the creator'}
                            {event.type === 'absence_started' && 'went quiet'}
                            {event.type === 'returned' && 'came back'}
                            {event.type === 'milestone' && 'hit a milestone'}
                          </span>
                        </p>
                        <p className="text-xs text-text-muted">
                          {event.occurredAt.toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
