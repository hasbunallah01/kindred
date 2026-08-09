import { forwardRef } from 'react';
import { ArrowRight } from 'lucide-react';

// Reusable platform card used on /onboarding/group to display each
// community source (Telegram, Discord, X, Slack). Two visual states:
//   - `active=true`  → primary purple border, clickable, plain
//                       purple "Connect →" text (not a pill button —
//                       the wireframe keeps the CTA quiet so the
//                       icon stays the visual anchor)
//   - `active=false` → muted, "Coming soon" badge, no interaction
//
// The icon is now an IMAGE (the official brand mark for each
// platform, supplied by the user) rather than a react-icons glyph.
// Brand marks read at a glance even at small sizes; react-icons'
// line-style glyphs needed to be drawn at 32px+ to feel
// proportional, and the wireframe's cards are not that large. The
// user-supplied PNG/JPEG assets are saved under
// apps/web/public/brand/platforms/.
//
// Sizing follows the wireframe: the icon container is 64px (h-16
// w-16) on both viewports — large enough to feel deliberate,
// small enough that the 2x2 grid still fits comfortably on a
// 360px-wide phone. The image inside is 48px (h-12 w-12) so it
// sits centered with a small, even margin around it.

export interface PlatformCardProps {
  name: string;
  /** Path to the brand mark image (e.g. "/brand/platforms/telegram.jpg"). */
  iconSrc: string;
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
      iconSrc,
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
    // interaction, no focus ring. The brand mark image keeps its
    // built-in gray treatment (the user supplied the Slack/X/Discord
    // marks already desaturated) so we just place it on a soft
    // white square — no color filter needed.
    if (!active) {
      return (
        <div
          ref={ref}
          className="relative flex h-full w-full flex-col items-center gap-3 rounded-card border border-border bg-surface/60 p-5 opacity-80 sm:flex-row sm:items-center sm:gap-4 sm:p-5"
        >
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-input bg-white p-2.5">
            <img
              src={iconSrc}
              alt={`${name} logo`}
              className="h-12 w-12 object-contain"
            />
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

    // Active state: white card with the brand-purple border, the
    // brand mark on a soft purple wash (the brand-primary is the
    // new brighter #6C5CE7, so the soft wash uses the new
    // purple-light #EDE9FE for an even tint), the platform name,
    // an optional description, and a plain "Connect →" call to
    // action in purple text. The CTA is plain text (not a filled
    // pill button) per the wireframe — the icon is the visual
    // anchor, the CTA should not compete with it.
    const inner = (
      <>
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-input bg-purple-light p-2.5">
          <img
            src={iconSrc}
            alt={`${name} logo`}
            className="h-12 w-12 object-contain"
          />
        </div>
        <div className="flex flex-1 flex-col items-center gap-1 text-center sm:items-start sm:text-left">
          <span className="text-base font-semibold text-text-primary">
            {name}
          </span>
          {description && (
            <span className="text-xs text-text-secondary">{description}</span>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary transition-colors group-hover:text-brand-primary-hover">
          {ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </>
    );

    const baseClass =
      'group relative flex h-full w-full flex-col items-center gap-3 rounded-card border border-brand-primary bg-white p-5 text-left shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-primary/40 sm:flex-row sm:items-center sm:gap-4 sm:p-5';

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
