import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { prisma } from '@kindred/db';

// Same real, server-side session validation as the earlier onboarding
// steps. This page's own gate is the point of the checkpoint: it must
// only show success once an active Community actually exists for this
// creator — not merely because they reached this URL.
export default async function OnboardingSuccessPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/login');
  }

  const community = await prisma.community.findFirst({
    where: { creatorId: session.user.id, status: 'active' },
    orderBy: { createdAt: 'desc' },
  });

  // No active community yet — the linking step (Checkpoint 28/31) hasn't
  // completed, so there's nothing to confirm. Send them back to finish it
  // rather than showing a false success.
  if (!community) {
    redirect('/onboarding/group');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">You&apos;re connected</h1>
        <p className="text-sm text-neutral-400">
          Kindred is now watching over <strong>{community.telegramChatTitle}</strong>.
        </p>

        <Link
          href="/dashboard"
          className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
