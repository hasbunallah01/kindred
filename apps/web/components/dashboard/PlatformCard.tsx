import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

// Reusable platform card used on /onboarding/group to display each
// community source (Telegram, Discord, X, Slack). Two visual states:
//   - `active=true`  → primary purple border, clickable, CTA button
//   - `active=false` → muted, "Coming soon" badge, no interaction
//
// The card is intentionally a square-ish aspect on desktop (the
// reference lays four of them in a 2×2 grid) and a wide rectangle on
// mobile (the reference stacks them vertically with comfortable
// horizontal margins). Spacing and typography follow the same
// Design Foundation tokens as the rest of the app.

export interface PlatformCardProps {
  name: string;
  icon: ReactNode;
  active: boolean;
  ctaLabel?: string;
  comingSoonLabel?: string;
  description?: string;
  onActivate?: () => void;
  href?: string;
  // Lets the card render as an <a> when href is provided AND active
  // (the Telegram deeplink is an external URL); as a <button> when
  // active but no href (e.g. a future platform that opens a modal);
  // and as a non-interactive div when inactive.
}

export const PlatformCard = forwardRef<HTMLDivElement, PlatformCardProps>(
  function PlatformCard(
    {
      name,
      icon,
      active,
      ctaLabel = 'Connect',
      comingSoonLabel = 'Coming soon',
      description,
      onActivate,
      href,
    },
    ref,
  ) {
    // Inactive state: muted card with a "Coming soon" badge. No
    // interaction, no focus ring.
    if (!active) {
      return (
        <div
          ref={ref}
          className="relative flex h-full w-full flex-col items-center gap-3 rounded-card border border-border bg-surface/60 p-6 opacity-70 sm:flex-row sm:items-center sm:gap-4 sm:p-5"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-input bg-white text-text-muted">
            {icon}
          </div>
          <div className="flex flex-1 flex-col items-center gap-1 text-center sm:items-start sm:text-left">
            <span className="text-base font-semibold text-text-primary">
              {name}
            </span>
            {description && (
              <span className="text-xs text-text-secondary">{description}</span>
            )}
          </div>
          <span className="rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
            {comingSoonLabel}
          </span>
        </div>
      );
    }

    // Active state: white card with the brand-purple border, the platform
    // icon in a soft purple wash, the name, an optional description,
    // and a "Connect →" call-to-action. Renders as an <a> when href is
    // given (the Telegram deeplink), or a <button> when onActivate is
    // given (placeholder for future platforms that open an in-app flow).
    const inner = (
      <>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-input bg-brand-primary/10 text-brand-primary">
          {icon}
        </div>
        <div className="flex flex-1 flex-col items-center gap-1 text-center sm:items-start sm:text-left">
          <span className="text-base font-semibold text-text-primary">
            {name}
          </span>
          {description && (
            <span className="text-xs text-text-secondary">{description}</span>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors group-hover:bg-brand-primary-hover">
          {ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </>
    );

    const baseClass =
      'group relative flex h-full w-full flex-col items-center gap-3 rounded-card border border-brand-primary bg-white p-6 text-left shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-primary/40 sm:flex-row sm:items-center sm:gap-4 sm:p-5';

    if (href) {
      return (
        <a ref={ref as React.Ref<HTMLAnchorElement>} href={href} className={baseClass}>
          {inner}
        </a>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        onClick={onActivate}
        className={baseClass}
      >
        {inner}
      </button>
    );
  },
);
