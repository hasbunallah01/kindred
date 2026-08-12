import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { auth } from '@/lib/auth';
import { prisma } from '@kindred/db';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { AskKindredModal } from '@/components/modals/AskKindredModal';

// /dashboard/ask — opens the AskKindredModal (a centered overlay)
// for the user's most recent community. The modal posts to
// /api/insights/ask, which calls sendMessage() on the community's
// Mind conversation and polls getMessageHistory() for the reply.
// The reply becomes a new Insight row with source='reactive'.
//
// Server component: looks up the user's community and passes its id
// to the (client) modal. The modal renders the dialog itself.
// We do NOT make this a separate /dashboard/ask page form — the
// modal is the UX, and routing to /dashboard/ask just makes the
// nav link resolve to something with content.

export default async function AskPage() {
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
            Ask Kindred
          </h1>
          <p className="text-sm text-text-secondary sm:text-base">
            Ask anything about your community. Kindred will combine the
            most recent relationship signals with the Mind's memory.
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
              to start asking.
            </p>
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-white p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-light text-brand-primary">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  Ask {community.telegramChatTitle || 'your community'} anything
                </h2>
                <p className="text-sm text-text-secondary">
                  Examples: "Who has been most active lately?" or "Who
                  seems to need a follow-up?"
                </p>
              </div>
            </div>
            <div className="mt-6">
              {/* The modal renders a centered dialog that posts to
                  /api/insights/ask. Calling onClose is a no-op here
                  because the modal has no parent router to navigate
                  back to — the user can dismiss it with the X. */}
              <AskKindredModal
                communityId={community.id}
                onClose={() => {}}
              />
            </div>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}
