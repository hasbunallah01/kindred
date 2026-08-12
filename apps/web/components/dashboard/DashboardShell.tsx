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
  ChevronDown,
  Bell,
} from 'lucide-react';
import { authClient } from '@/lib/auth-client';

// Shared shell for every authenticated /dashboard/* page (the
// 2026 redesign). Two presentations share the same component,
// keyed off the same nav items so the mobile and desktop feel like
// the same product rather than two unrelated layouts:
//
//   - Desktop/tablet (sm+): a 240px fixed left sidebar with the
//     brand mark, the 4 primary nav items at the top, and
//     Settings + profile/sign-out at the bottom (separated by a
//     large flexible gap, so Settings feels like a secondary
//     surface, not a peer of the primary nav).
//
//   - Mobile (<sm): a compact top header (logo + bell + avatar)
//     AND a fixed bottom nav with the 4 primary items. Settings
//     is reached only through the profile menu. This replaces
//     the previous drawer-style mobile nav, which felt admin-y.
//
// Per the design principle "purple is an accent, not the entire
// UI": active state is a soft purple-light background + a stronger
// label color. The community-status gradient is the one place
// that earns the saturated purple — every other surface is white
// or off-white with subtle borders and shadows.

export interface DashboardShellProps {
  username: string | null;
  email: string | null;
  children: React.ReactNode;
  /**
   * Optional page-level action rendered in the desktop top-right
   * (e.g. "Connect another community"). Pass null or omit for
   * no action. Not rendered on mobile.
   */
  topRightAction?: {
    href: string;
    label: string;
  } | null;
}

interface NavItem {
  label: string;
  href: string;
  icon: typeof Home;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: Home },
  { label: 'Community', href: '/dashboard/community', icon: Users },
  { label: 'Insights', href: '/dashboard/insights', icon: Sparkles },
  { label: 'Ask Kindred', href: '/dashboard/ask', icon: MessageSquare },
];

const SETTINGS_ITEM: NavItem = {
  label: 'Settings',
  href: '/dashboard/settings',
  icon: Settings,
};

export function DashboardShell({
  username,
  email,
  children,
  topRightAction = null,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
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

  // A single nav link element, rendered in both sidebar and bottom
  // nav so the active treatment stays in sync.
  const renderNavLink = (item: NavItem) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
          active
            ? 'bg-purple-light text-brand-primary'
            : 'text-text-secondary hover:bg-surface hover:text-text-primary'
        }`}
      >
        <Icon
          className={`h-4 w-4 shrink-0 ${active ? 'text-brand-primary' : 'text-text-muted'}`}
        />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  // Profile avatar circle used in the sidebar (bottom) and the
  // mobile top header (right side). The mobile top header has a
  // click-to-open dropdown identical in shape to the sidebar's
  // profile section.
  const initial = (username ?? email ?? '?').charAt(0).toUpperCase();
  const ProfileAvatar = (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-deep-purple text-sm font-semibold text-white">
      {initial}
    </div>
  );

  // Profile menu: account email + sign out. Renders inline below
  // the trigger when open. Same body in sidebar and mobile.
  const ProfileMenu = (
    <div className="rounded-xl border border-border bg-background p-2 shadow-lg">
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
        className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text-primary transition-colors hover:bg-surface disabled:opacity-50"
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
        <Link href="/dashboard" className="mb-8 inline-flex items-center">
          <img
            src="/brand/kindred-logo.png"
            alt="Kindred Mind"
            className="h-9 w-auto"
          />
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(renderNavLink)}
        </nav>
        {/* Flexible space — pushes Settings + account to the bottom
            of the sidebar, separated by a clear gap. */}
        <div className="mt-auto flex flex-col gap-3 pt-6">
          {renderNavLink(SETTINGS_ITEM)}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-white px-3 py-2.5 text-left transition-colors hover:bg-surface"
            >
              {ProfileAvatar}
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">
                {username ?? 'You'}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${
                  profileOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {profileOpen && (
              <div className="mt-2">{ProfileMenu}</div>
            )}
          </div>
        </div>
      </aside>

      {/* ==================== DESKTOP TOP HEADER (page-level actions) ==================== */}
      {topRightAction && (
        <div className="sticky top-0 z-30 hidden border-b border-border bg-background/95 backdrop-blur sm:block">
          <div className="ml-60 flex h-16 items-center justify-end px-8">
            <Link
              href={topRightAction.href}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3.5 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface"
            >
              {topRightAction.label}
            </Link>
          </div>
        </div>
      )}

      {/* ==================== MOBILE TOP HEADER ==================== */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:hidden">
        <Link href="/dashboard" className="inline-flex items-center">
          <img
            src="/brand/kindred-logo.png"
            alt="Kindred Mind"
            className="h-8 w-auto"
          />
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Notifications"
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
          >
            <Bell className="h-5 w-5" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              aria-label="Account menu"
            >
              {ProfileAvatar}
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-11 w-64">{ProfileMenu}</div>
            )}
          </div>
        </div>
      </header>

      {/* ==================== MOBILE FIXED BOTTOM NAV ==================== */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden"
      >
        <ul className="flex items-stretch justify-between">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium transition-colors ${
                    active
                      ? 'bg-purple-light text-brand-primary'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${active ? 'text-brand-primary' : 'text-text-muted'}`}
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ==================== MAIN CONTENT ====================
          The bottom padding on small screens keeps the last
          content row from sitting under the fixed bottom nav. */}
      <main
        className={`mx-auto w-full max-w-5xl px-4 pb-32 pt-6 sm:ml-60 sm:px-8 sm:pb-16 ${
          topRightAction ? 'sm:pt-8' : 'sm:pt-10'
        }`}
      >
        {children}
      </main>
    </div>
  );
}
