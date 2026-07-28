import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/lib/auth';

// Onboarding step 1 (Blueprint Section 5.1 step 1 / Better Auth docs on
// server-side session validation): a real, database-backed session check,
// not just the optimistic cookie-presence check middleware.ts does. The
// middleware comment from Checkpoint 22 flagged this as still needed —
// this is where it actually gets done, since this is the first real
// protected page.
export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/login');
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  const botLink = botUsername ? `https://t.me/${botUsername}` : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Connect Telegram</h1>
        <p className="text-sm text-neutral-400">
          First, start a private chat with the Kindred bot — this lets it send you notifications
          later.
        </p>

        {botLink ? (
          <a
            href={botLink}
            target="_blank"
            rel="noreferrer"
            className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950"
          >
            Open @{botUsername} and press Start
          </a>
        ) : (
          <p className="text-sm text-red-400">
            TELEGRAM_BOT_USERNAME isn&apos;t configured yet — see infra/deploy/vps-setup-notes.md.
          </p>
        )}

        <Link href="/onboarding/group" className="text-sm text-neutral-400 hover:text-neutral-200">
          I&apos;ve started the bot — continue
        </Link>
      </div>
    </main>
  );
}
