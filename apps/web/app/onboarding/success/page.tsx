import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import { auth } from '@/lib/auth';
import { prisma } from '@kindred/db';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';

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

  const username = session.user.username ?? null;
  const email = session.user.email ?? null;

  return (
    <main className="min-h-screen bg-surface text-text-primary">
      <OnboardingHeader username={username} email={email} />

      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 px-5 py-12 text-center sm:gap-6 sm:py-16">
        {/* Soft checkmark — purple wash, no animation, no confetti.
            Sized larger than before (80px / h-20 w-20) so it reads
            as the page's primary visual anchor, matching the
            wireframe. */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-light text-brand-primary">
          <Check className="h-10 w-10" strokeWidth={2.5} />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            🎉 Kindred is now connected!
          </h1>
          <p className="text-sm text-text-secondary sm:text-base">
            Your community is connected and your Mind has started listening.
          </p>
        </div>

        {/* Connected community card. Reassures the creator that
            Kindred is talking to the right group, not a generic
            placeholder. Now uses the same /brand/platforms/telegram.jpg
            asset as the onboarding card so the "connected" visual
            matches the "click to connect" visual. */}
        <div className="flex w-full items-center gap-3 rounded-card border border-border bg-white p-4 text-left">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-input bg-purple-light p-2">
            <img
              src="/brand/platforms/telegram.jpg"
              alt="Telegram logo"
              className="h-8 w-8 object-contain"
            />
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

        {/* Larger CTA (px-6 py-3.5 text-base) so it reads as the
            primary action, not a quiet link. Full-width on mobile
            (the wireframe), auto-width on desktop. */}
        <Link
          href="/dashboard"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-input bg-brand-primary px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-primary-hover sm:w-auto"
        >
          Open dashboard
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </main>
  );
}
