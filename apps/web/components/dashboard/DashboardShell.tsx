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
// 2026 redesign).
//
// Per the 2026 reference image, the desktop sidebar is a DARK
// PURPLE surface with a WHITE PILL for the active nav item — the
// inverse of the mobile bottom nav (white surface, purple pill).
// The two presentations share the same nav items, the same
// active-detection logic, and the same profile menu; only the
// chrome (background, text colors, pill treatment) is different.
//
//   Desktop/tablet (sm+): 240px fixed left sidebar, dark purple
//                          bg, white text, white pill for the
//                          active item. Settings rendered as a
//                          small icon row above the profile
//                          (matches the reference).
//
//   Mobile (<sm): compact top header (brand mark + bell + avatar)
//                 AND a fixed bottom nav with the 4 primary items.
//                 Settings is reached only through the profile menu.

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
  // nav. The class is composed from a `variant` so the same code
  // path produces the white-pill-on-dark treatment (sidebar) and
  // the purple-pill-on-white treatment (mobile bottom nav).
  type NavVariant = 'sidebar' | 'mobile';
  const renderNavLink = (item: NavItem, variant: NavVariant) => {
    const active = isActive(item.href);
    const Icon = item.icon;

    if (variant === 'sidebar') {
      // Dark purple sidebar:
      //   active  = white pill, dark icon, dark text
      //   other   = transparent bg, white-ish icon, white-ish text
      return (
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            active
              ? 'bg-white text-deep-purple shadow-sm'
              : 'text-white/80 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Icon
            className={`h-4 w-4 shrink-0 ${active ? 'text-deep-purple' : 'text-white/70'}`}
          />
          <span className="truncate">{item.label}</span>
        </Link>
      );
    }

    // Mobile bottom nav:
    //   active  = purple-light pill, brand-purple icon + text
    //   other   = transparent, gray icon + secondary text
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
  };

  // Profile avatar circle used in the sidebar (bottom) and the
  // mobile top header (right side).
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
      {/* ==================== DESKTOP SIDEBAR (dark purple) ==================== */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden h-screen w-60 flex-col overflow-y-auto bg-gradient-to-b from-deep-purple via-deep-purple to-brand-primary px-4 py-6 sm:flex">
        {/* Brand mark: a CSS-only rendering of the KINDRED brand.
            The PNG asset (`/brand/kindred-logo.png`) has dark navy
            text on a light background — invisible on the dark
            purple sidebar. The phone uses the same PNG on a light
            surface, where it looks great. The sidebar needs the
            same brand mark but in light tones for legibility.

            Approach: render the icon as an inline SVG with
            light-tinted fills, and render KINDRED + the tagline
            as text in white. One element per brand component, no
            PNG to invert, no contrast issues, no clipping. */}
        <Link
          href="/dashboard"
          className="mb-8 flex shrink-0 items-start gap-2.5"
          aria-label="Kindred Mind — never let a loyal fan become a forgotten fan."
        >
          {/* Heart+people icon, light-tinted. Uses an inline SVG
              (not a PNG) so the colors stay crisp at any size
              and match the sidebar's palette. */}
          <svg
            viewBox="0 0 64 56"
            className="h-10 w-10 shrink-0"
            aria-hidden
          >
            {/* Purple K figure */}
            <path
              d="M14 6c-3.3 0-6 2.7-6 6v15c0 6 5 11 11 11h2c1 0 1.5-1 1-2l-3-4c-1-1.5 0-3.5 1.5-3.5h2.5c1.5 0 2.5-2 1.5-3.5L18 19c-1-1.5 0-3.5 1.5-3.5h1.5c1 0 1.5-1 1-2l-3-4c-1-1.5 0-3.5 1.5-3.5h.5c.5 0 1-.3 1-.8V7c0-.6-.5-1-1-1h-5z"
              fill="#C4B5FD"
            />
            {/* Peach/orange figure */}
            <path
              d="M36 16c-3.3 0-6 2.7-6 6v12c0 4 3 7 7 7h3c1 0 1.7-1 1.3-2l-2-5c-.5-1.3.5-2.5 1.8-2.5h2.5c1.5 0 2.5-2 1.5-3.5l-3-4.5c-1-1.5 0-3.5 1.5-3.5h.5c.5 0 1-.3 1-.8V17c0-.6-.5-1-1-1h-8z"
              fill="#FB923C"
            />
            {/* White heart overlap */}
            <path
              d="M26 36c-2 0-3 1.5-3 3 0 2 1.5 3 3 3h12c1.5 0 3-1 3-3 0-1.5-1-3-3-3H26z"
              fill="#FFFFFF"
            />
          </svg>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-base font-bold uppercase tracking-wider text-white">
              Kindred<sup className="text-[0.5em]">®</sup>
            </p>
            <p className="mt-0.5 text-[10px] leading-tight text-white/70">
              Never let a loyal fan become a forgotten fan.
            </p>
          </div>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => renderNavLink(item, 'sidebar'))}
        </nav>
        {/* Flexible space — pushes Settings + account to the bottom
            of the sidebar, separated by a clear gap. */}
        <div className="mt-auto flex flex-col gap-3 pt-6">
          {/* Settings as a small icon-only row, per the reference
              (the 4 nav items above carry the full labels; Settings
              is a secondary affordance). */}
          <Link
            href={SETTINGS_ITEM.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive(SETTINGS_ITEM.href)
                ? 'bg-white text-deep-purple shadow-sm'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
            aria-label="Settings"
          >
            <Settings
              className={`h-4 w-4 shrink-0 ${
                isActive(SETTINGS_ITEM.href) ? 'text-deep-purple' : 'text-white/70'
              }`}
            />
            <span className="truncate">{SETTINGS_ITEM.label}</span>
          </Link>
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/10"
            >
              {ProfileAvatar}
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                {username ?? 'You'}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-white/70 transition-transform ${
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

      {/* ==================== DESKTOP TOP HEADER (page-level actions) ====================
          Sits beside the sidebar (ml-60 to clear it) and contains
          a max-w-6xl inner container that aligns with the main
          content below. The inner container is centered, so on
          extra-wide screens the "Connect another community"
          button sits at the right edge of the same column as
          the dashboard content. Hidden on mobile. */}
      {topRightAction && (
        <div className="sticky top-0 z-30 hidden border-b border-border bg-background/95 backdrop-blur sm:block">
          <div className="sm:ml-60 flex h-16 items-center px-4 sm:px-8">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-end">
              <Link
                href={topRightAction.href}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3.5 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface"
              >
                {topRightAction.label}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MOBILE TOP HEADER (light) ====================
          The brand mark is a single wide PNG (441x119, 3.71:1)
          that contains the K-mark + 'KINDRED®' + tagline all in
          one asset. We render it at h-9 (36px) and let the width
          follow the natural aspect ratio — `flex-1` on the Link
          gives the image as much horizontal room as it needs
          before the bell/avatar. No text overlays: the image IS
          the brand mark, and adding KINDRED text next to it would
          double-render the brand and break the reference. */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:hidden">
        <Link href="/dashboard" className="flex min-w-0 flex-1 items-center" aria-label="Kindred Mind">
          <img
            src="/brand/kindred-logo.png"
            alt="Kindred Mind — never let a loyal fan become a forgotten fan."
            className="h-9 w-auto max-w-full"
          />
        </Link>
        <div className="flex shrink-0 items-center gap-2">
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

      {/* ==================== MOBILE FIXED BOTTOM NAV (light) ==================== */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden"
      >
        <ul className="flex items-stretch justify-between">
          {NAV_ITEMS.map((item) => renderNavLink(item, 'mobile'))}
        </ul>
      </nav>

      {/* ==================== MAIN CONTENT ====================
          On desktop (`sm:`), the main starts at x=240 (ml-60) to
          make room for the fixed sidebar and EXPANDS to fill
          the remaining viewport — this is the structural fix
          the user identified. The previous version had
          `mx-auto w-full max-w-5xl`, which capped the content
          at 1024px and centered it, leaving a huge blank area
          on wide screens. Now the main is just `sm:ml-60` with
          a `min-h-screen` to keep it the full viewport height,
          and the max-width constraint is moved INSIDE to a
          child container (`max-w-6xl` = 1152px). On a 1280px
          desktop, the content area gets the full 1040px (1280
          − 240). On a 1920px desktop, the inner container is
          centered at 1152px and the sidebar still hugs the left
          edge. On mobile, no `sm:ml-60`, full width as before. */}
      <main
        className={`min-h-screen pb-32 sm:ml-60 sm:pb-16 ${
          topRightAction ? 'pt-0' : 'pt-0'
        }`}
      >
        <div
          className={`mx-auto w-full max-w-6xl px-4 sm:px-8 ${
            topRightAction ? 'pt-6 sm:pt-8' : 'pt-6 sm:pt-10'
          }`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
