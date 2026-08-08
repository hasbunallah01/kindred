'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, X, LogOut } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

// Shared top header for the onboarding pages (/onboarding/group and
// /onboarding/success). Matches the wireframe for both desktop and
// mobile: brand wordmark on the left, a control cluster on the right
// (username/avatar on desktop, hamburger on mobile).
//
// The hamburger on mobile is intentionally a "real" control — it
// opens a small menu that lets the user sign out — rather than
// visual-only decoration. The dashboard's drawer is more elaborate
// (full nav); the onboarding pages don't need a nav, but the user
// does need a way out of the flow.

export interface OnboardingHeaderProps {
  username: string | null;
  email: string | null;
}

export function OnboardingHeader({ username, email }: OnboardingHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await authClient.signOut();
      router.push('/login');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <header className="relative border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5 sm:px-6">
        <Link href="/" aria-label="Kindred Mind — back to home" className="inline-block">
          <img
            src="/brand/kindred-logo.png"
            alt="Kindred Mind"
            className="h-9 w-auto sm:h-10"
          />
        </Link>

        {/* Desktop: username + avatar (matches the wireframe's
            desktop header). Mobile: hidden, the hamburger below
            carries the affordance. */}
        <div className="hidden items-center gap-2 sm:flex">
          <span className="text-sm text-text-secondary">
            {username ?? 'You'}
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-sm font-semibold text-white">
            {(username ?? email ?? '?').charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Mobile: hamburger that opens a small menu. The wireframe
            shows a hamburger on every onboarding page; pairing it
            with a real action (sign out) keeps the icon honest. */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          className="flex h-9 w-9 items-center justify-center rounded-input text-text-secondary transition-colors hover:bg-surface hover:text-text-primary sm:hidden"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu sheet. Backdrop click closes it; the menu
          itself contains a sign-out action. Positioned absolutely
          under the header so the page content stays put. */}
      {menuOpen && (
        <div className="absolute inset-x-0 top-16 z-20 border-b border-border bg-background px-5 py-4 shadow-sm sm:hidden">
          <div className="flex items-center justify-between gap-3 rounded-input border border-border bg-surface px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-primary text-sm font-semibold text-white">
                {(username ?? email ?? '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-text-primary">
                  {username ?? 'You'}
                </span>
                {email && (
                  <span className="truncate text-xs text-text-secondary">{email}</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              aria-label="Sign out"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-input text-text-muted transition-colors hover:bg-white hover:text-text-primary disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
