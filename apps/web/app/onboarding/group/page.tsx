import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { FaDiscord, FaXTwitter, FaSlack } from 'react-icons/fa6';
import { auth } from '@/lib/auth';
import { prisma } from '@kindred/db';
import { PlatformCard } from '@/components/dashboard/PlatformCard';
import { TelegramConnectButton } from './TelegramConnectButton';

// /onboarding/group — the only onboarding step the user actually
// has to interact with. "Connect your first community" with the
// four-platform grid (Telegram active, Discord/X/Slack muted as
// "Coming soon").
//
// Redirect rules:
//   - No session → /login
//   - Already connected (active community exists) → /dashboard
//
// Server component: session check + "already connected" check happen
// here. The actual connect interaction (POST to /api/telegram/link,
// then redirect to the Telegram deeplink) lives in
// TelegramConnectButton, a small client component, so the user can
// see the loading state during the API call.
export default async function OnboardingGroupPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect('/login');
  }

  // If the creator already has an active community, onboarding is
  // effectively done — skip past it straight to the dashboard.
  const existing = await prisma.community.findFirst({
    where: { creatorId: session.user.id, status: 'active' },
    select: { id: true },
  });
  if (existing) {
    redirect('/dashboard');
  }

  const username = session.user.username ?? null;

  return (
    <main className="min-h-screen bg-surface text-text-primary">
      {/* Top header: brand wordmark on the left, creator's username
          on the right. On mobile, a small "+" button takes them
          back to /onboarding/group (this page) so they can switch
          accounts; on desktop, the username alone is enough
          affordance. */}
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
              {username ?? 'You'}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-sm font-semibold text-white">
              {(username ?? '?').charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-col items-stretch gap-6 px-5 py-8 sm:gap-8 sm:px-8 sm:py-14">
        {/* Headline + subhead */}
        <div className="flex flex-col gap-2 text-center sm:text-left">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Connect your first community
          </h1>
          <p className="mx-auto max-w-xl text-sm text-text-secondary sm:mx-0 sm:text-base">
            Kindred learns the relationships inside your community over time.
            Choose where your community lives to get started.
          </p>
        </div>

        {/* Platform grid — Telegram is the only active card, the
            other three render as muted "Coming soon" placeholders
            so the creator understands future platform support is
            coming without being offered a choice that would fail. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TelegramConnectButton />

          <PlatformCard
            name="Discord"
            icon={<FaDiscord className="h-5 w-5" />}
            active={false}
          />
          <PlatformCard
            name="X (Twitter)"
            icon={<FaXTwitter className="h-5 w-5" />}
            active={false}
          />
          <PlatformCard
            name="Slack"
            icon={<FaSlack className="h-5 w-5" />}
            active={false}
          />
        </div>

        {/* Subtle explanation under the grid. Communicates the
            background-learning promise without being loud. */}
        <div className="flex items-start gap-2 rounded-input border border-border bg-white px-4 py-3 text-sm text-text-secondary">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
          <p>
            Once connected, Kindred starts learning quietly in the background.
            You won&apos;t be flooded with notifications.
          </p>
        </div>

        {/* Small "skip for now" link. Not the primary path — the
            primary path is the Telegram card. This exists so a user
            who isn't ready to connect right now (e.g. they're on
            mobile and the group is on their laptop) can still reach
            the dashboard. */}
        <div className="text-center text-sm text-text-muted sm:text-left">
          Not ready yet?{' '}
          <Link
            href="/dashboard"
            className="font-medium text-text-secondary transition-colors hover:text-brand-primary"
          >
            Skip to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
