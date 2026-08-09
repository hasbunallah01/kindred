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
  ChevronDown,
} from 'lucide-react';
import { authClient } from '@/lib/auth-client';

// Shared shell for every authenticated /dashboard/* page. Two
// presentations share the same component:
//   - Desktop: a 240px fixed left sidebar with the brand mark and
//     the primary nav. A top header (rendered to the right of the
//     sidebar) carries the page-level "Connect another community"
//     action supplied by the page.
//   - Mobile: a compact top header (logo + hamburger) that opens a
//     slide-down drawer with the same nav. Per the wireframe, the
//     mobile header has NO connect button — the action is reached
//     through the dashboard's content area instead.
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
  /**
   * Optional page-level action to render in the desktop top header
   * (e.g. "Connect another community"). Pass `null` or omit to
   * render nothing in that slot. Not rendered on mobile — the
   * wireframe keeps mobile headers quiet.
   */
  topRightAction?: {
    href: string;
    label: string;
  } | null;
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

export function DashboardShell({
  username,
  email,
  children,
  topRightAction = null,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
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
                  ? 'bg-purple-light text-brand-primary'
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

  // The profile pill, simplified per the wireframe: avatar
  // initial + username + chevron, no email line, no inline sign-out
  // button. Sign-out is in the dropdown menu (matches the
  // "dropdown" shape the wireframe implies with the chevron).
  const ProfilePill = (
    <button
      type="button"
      onClick={() => setProfileOpen((open) => !open)}
      aria-haspopup="menu"
      aria-expanded={profileOpen}
      className="flex w-full items-center gap-3 rounded-input border border-border bg-surface px-3 py-2.5 text-left transition-colors hover:bg-white"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-primary text-sm font-semibold text-white">
        {(username ?? email ?? '?').charAt(0).toUpperCase()}
      </div>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">
        {username ?? 'You'}
      </span>
      <ChevronDown
        className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${
          profileOpen ? 'rotate-180' : ''
        }`}
      />
    </button>
  );

  const ProfileMenu = profileOpen && (
    <div className="mt-2 rounded-input border border-border bg-background p-2 shadow-sm">
      <div className="px-2 py-1.5 text-xs text-text-muted">
        Signed in as
        <div className="truncate text-sm font-medium text-text-primary">
          {email ?? username ?? '—'}
        </div>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="mt-1 flex w-full items-center gap-2 rounded-input px-2 py-1.5 text-sm text-text-primary transition-colors hover:bg-surface disabled:opacity-50"
      >
        <LogOut className="h-4 w-4 text-text-muted" />
        Sign out
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
        <div className="mt-auto">
          {ProfilePill}
          {ProfileMenu}
        </div>
      </aside>

      {/* ==================== DESKTOP TOP HEADER (page-level actions) ==================== */}
      {topRightAction && (
        <div className="sticky top-0 z-30 hidden border-b border-border bg-background/95 backdrop-blur sm:block">
          <div className="ml-60 flex h-16 items-center justify-end px-8">
            <Link
              href={topRightAction.href}
              className="inline-flex items-center gap-1.5 rounded-input border border-border bg-white px-3.5 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface"
            >
              {topRightAction.label}
            </Link>
          </div>
        </div>
      )}

      {/* ==================== MOBILE TOP HEADER ==================== */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:hidden">
        <Link href="/dashboard" className="inline-block">
          <img
            src="/brand/kindred-logo.png"
            alt="Kindred Mind"
            className="h-8 w-auto"
          />
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen((open) => !open)}
          aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
          className="flex h-9 w-9 items-center justify-center rounded-input text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
        >
          {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
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
            <div>
              {ProfilePill}
              {ProfileMenu}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MAIN CONTENT ==================== */}
      <main
        className={`mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:ml-60 sm:px-8 ${
          topRightAction ? 'sm:pt-8' : 'sm:pt-10'
        }`}
      >
        {children}
      </main>
    </div>
  );
}
