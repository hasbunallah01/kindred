import Link from 'next/link';
import type { ReactNode } from 'react';

// Shared layout for every authentication page (/signup, /login,
// /verify-email, /reset-password, /reset-password/confirm).
//
// Purpose: keep the auth experience visually identical across the five
// pages so a creator moving from the landing page into the auth flow
// feels no visual disconnect. Every page composes the same five things
// in the same order: the Kindred Mind wordmark, the page-specific
// form, and a "back" navigation link. No illustrations, no decorative
// graphics, no dashboard previews — auth is focus mode.
//
// Props:
//   - title: the <h1> shown at the top of the card. Optional because
//     one of the pages (currently none) might want a card without a
//     title. Kept required in practice for the five pages we have.
//   - description: a one-line subtitle shown below the title.
//   - children: the actual form fields and submit button.
//   - backHref / backLabel: the small navigation link below the card.
//     Pass `null` to suppress the link entirely (used on the login
//     page, which is itself the entry to most other auth pages).
//
// Per Kindred Mind Design Foundation (docs/DESIGN_FOUNDATION.md):
// white page, white card with soft border + small shadow, 20px radius,
// generous padding, Inter typography, 14px input/button radius,
// primary purple CTA. Auth is focus mode — the form is the entire
// page.
interface AuthShellProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  backHref?: string | null;
  backLabel?: string;
}

export function AuthShell({
  title,
  description,
  children,
  backHref,
  backLabel,
}: AuthShellProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
      {/* Kindred Mind wordmark. The full logo (not the icon badge) is
          used here so the auth flow reinforces the full product name.
          Links back to the landing page root. h-12 (48px) matches the
          premium SaaS feel (Linear / Vercel / GitHub tier) and matches
          the size used in the landing page navigation. The width is
          `auto` so the 441:119 aspect ratio of .github/brand/kindred-logo.png
          is preserved (no crop, no stretch, no compression). */}
      <Link
        href="/"
        aria-label="Kindred Mind — back to home"
        className="mb-8 inline-block"
      >
        <img
          src="/brand/kindred-logo.png"
          alt="Kindred Mind"
          className="h-12 w-auto"
        />
      </Link>

      {/* The auth card. White, soft border, soft shadow, 20px radius.
          32px padding on desktop, 24px on mobile. The form width is
          intentionally narrow (420px) — Linear, Vercel, GitHub, Clerk
          all keep auth forms tight to help users focus. */}
      <div className="w-full max-w-[420px] rounded-card border border-border bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm text-text-secondary">{description}</p>
        )}

        <div className="mt-6">{children}</div>
      </div>

      {/* Subtle "back" navigation link below the card. Hidden via
          `backHref={null}` on pages where it would be redundant
          (the login page). */}
      {backHref && (
        <Link
          href={backHref}
          className="mt-6 text-sm text-text-secondary transition-colors hover:text-brand-primary"
        >
          {backLabel ?? '← Back'}
        </Link>
      )}
    </main>
  );
}
