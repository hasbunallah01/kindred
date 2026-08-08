'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Users,
  Sparkles,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  Plus,
} from 'lucide-react';
import { authClient } from '@/lib/auth-client';

// Shared shell for every authenticated /dashboard/* page. Two
// presentations share the same component:
//   - Desktop: a 240px fixed left sidebar with the brand mark, the
//     primary nav, and a user-profile footer that includes sign-out.
//   - Mobile: a compact top header (logo + hamburger + connect CTA)
//     that opens a slide-down drawer with the same nav and footer.
//
// The sidebar is the dashboard's contextual onboarding — by living
// inside the actual product shell, it teaches the user what each
// section does, rather than relying on a separate tutorial page.
//
// Active state is intentionally subtle: a soft purple background tint
// + a slightly stronger label, never a giant colored block. Matches
// the design principle "purple is an accent, not the entire UI".

export interface DashboardShellProps {
  username: string | null;
  email: string | null;
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: <Home className="h-4 w-4" /> },
  { label: 'Community', href: '/dashboard/community', icon: <Users className="h-4 w-4" /> },
  { label: 'Insights', href: '/dashboard/insights', icon: <Sparkles className="h-4 w-4" /> },
  { label: 'Ask Kindred', href: '/dashboard/ask', icon: <MessageSquare className="h-4 w-4" /> },
  { label: 'Settings', href: '/dashboard/settings', icon: <Settings className="h-4 w-4" /> },
];

export function DashboardShell({ username, email, children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

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

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname?.startsWith(href) ?? false;
  };

  // The list of nav links, factored out so the desktop sidebar and
  // the mobile drawer render the same items with the same active
  // treatment.
  const NavLinks = (
    <ul className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={() => setDrawerOpen(false)}
              className={`flex items-center gap-3 rounded-input px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand-primary/10 text-brand-primary'
                  : 'text-text-secondary hover:bg-surface hover:text-text-primary'
              }`}
            >
              <span
                className={active ? 'text-brand-primary' : 'text-text-muted'}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  // The user-profile footer (avatar initial + name/email + sign-out),
  // again shared between the desktop sidebar and the mobile drawer.
  const UserFooter = (
    <div className="mt-auto flex items-center gap-3 rounded-input border border-border bg-surface px-3 py-2.5">
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
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        aria-label="Sign out"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-input text-text-muted transition-colors hover:bg-white hover:text-text-primary disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface text-text-primary">
      {/* ==================== DESKTOP SIDEBAR ==================== */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-background px-4 py-6 sm:flex">
        <Link href="/dashboard" className="mb-8 inline-block">
          <img
            src="/brand/kindred-logo.png"
            alt="Kindred Mind"
            className="h-9 w-auto"
          />
        </Link>
        <nav className="flex-1">{NavLinks}</nav>
        {UserFooter}
      </aside>

      {/* ==================== MOBILE TOP HEADER ==================== */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:hidden">
        <Link href="/dashboard" className="inline-block">
          <img
            src="/brand/kindred-logo.png"
            alt="Kindred Mind"
            className="h-8 w-auto"
          />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/onboarding/group"
            className="inline-flex items-center gap-1 rounded-input bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-primary-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            Connect
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen((open) => !open)}
            aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
            className="flex h-9 w-9 items-center justify-center rounded-input text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
          >
            {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile drawer — full-width sheet that drops down from the
          top of the viewport. Renders only when open to avoid
          trapping focus when closed. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-30 sm:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-text-primary/20 backdrop-blur-sm"
          />
          <div className="relative flex h-full flex-col gap-6 border-b border-border bg-background px-5 pb-6 pt-20">
            <nav>{NavLinks}</nav>
            {UserFooter}
          </div>
        </div>
      )}

      {/* ==================== MAIN CONTENT ==================== */}
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:ml-60 sm:px-8 sm:pt-10">
        {children}
      </main>
    </div>
  );
}
