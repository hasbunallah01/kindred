'use client';

import { ArrowLeft, LogOut, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { authClient } from '@/lib/auth-client';

// /dashboard/settings — account-only for now. Reachable from the
// sidebar's bottom Settings item and from the profile/avatar menu.
// Kept as a client component so the Sign Out button can call
// authClient.signOut() directly (the same flow the DashboardShell
// profile menu uses).
//
// The page is intentionally minimal — Kindred's hackathon surface
// doesn't have notification preferences, billing, or team
// management yet. The structure is here so those can be added
// later without re-routing.

export default function SettingsPage() {
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push('/login');
  };

  return (
    <DashboardShell
      username={null}
      email={null}
    >
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
            Settings
          </h1>
          <p className="text-sm text-text-secondary sm:text-base">
            Manage your Kindred account.
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-white p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-light text-brand-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                Account
              </h2>
              <p className="text-sm text-text-secondary">
                Signed in via email. Connected communities and memories
                belong to this account.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-5 sm:p-6">
          <h2 className="text-base font-semibold text-text-primary">
            Sign out
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Sign out of Kindred on this device. Your communities and
            memory are preserved on the server.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </section>
      </div>
    </DashboardShell>
  );
}
