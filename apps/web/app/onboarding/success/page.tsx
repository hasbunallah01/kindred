import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import { FaTelegram } from 'react-icons/fa6';
import { auth } from '@/lib/auth';
import { prisma } from '@kindred/db';

// /onboarding/success — the calm confirmation page shown after
// Kindred has bound to the creator's Telegram community. Gates
// itself on the existence of an active Community for the current
// user; without one, the user is redirected back to the connect
// step (no point celebrating a connection that hasn't happened).
//
// The design is intentionally quiet: a soft checkmark, a single
// "Open dashboard" CTA, no confetti or large illustrations. The
// transition to the dashboard is the celebration, not this page.

export default async function OnboardingSuccessPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect('/login');
  }

  const community = await prisma.community.findFirst({
    where: { creatorId: session.user.id, status: 'active' },
    orderBy: { createdAt: 'desc' },
  });

  // No active community yet — the linking step hasn't completed.
  // Send them back to finish it rather than showing a false success.
  if (!community) {
    redirect('/onboarding/group');
  }

  return (
    <main className="min-h-screen bg-surface text-text-primary">
      {/* Same top header as the group page so the creator never
          feels they're on a different site between steps. */}
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/" aria-label="Kindred Mind — back to home" className="inline-block">
            <img
              src="/brand/kindred-logo.png"
              alt="Kindred Mind"
              className="h-9 w-auto sm:h-10"
            />
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-text-secondary sm:inline">
              {session.user.username ?? 'You'}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-sm font-semibold text-white">
              {(session.user.username ?? '?').charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 px-5 py-12 text-center sm:gap-6 sm:py-16">
        {/* Soft checkmark — purple wash, no animation, no confetti. */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
          <Check className="h-8 w-8" strokeWidth={2.5} />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Kindred is now connected!
          </h1>
          <p className="text-sm text-text-secondary sm:text-base">
            Your community is connected and your Mind has started listening.
          </p>
        </div>

        {/* Connected community card. Reassures the creator that
            Kindred is talking to the right group, not a generic
            placeholder. */}
        <div className="flex w-full items-center gap-3 rounded-card border border-border bg-white p-4 text-left">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-input bg-brand-primary/10 text-brand-primary">
            <FaTelegram className="h-5 w-5" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-text-primary">
              {community.telegramChatTitle || 'My Telegram Community'}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-text-secondary">
              <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
              Connected just now
            </span>
          </div>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-input bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-primary-hover sm:w-auto sm:px-5"
        >
          Open dashboard
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </main>
  );
}
