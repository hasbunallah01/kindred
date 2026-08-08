import type { ReactNode } from 'react';

// Calm, on-brand empty state used throughout the dashboard when a
// section has no real data yet (e.g. before the first community
// insight arrives). Renders an optional icon in a soft purple wash
// (matching the platform card), a headline, a short paragraph, and an
// optional CTA. Kept intentionally minimal — the dashboard's own
// empty state IS the onboarding, per the Kindred Mind design.

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  cta?: ReactNode;
}

export function EmptyState({ icon, title, description, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-white p-6 text-center sm:p-8">
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold tracking-tight text-text-primary">
        {title}
      </h3>
      {description && (
        <p className="max-w-md text-sm text-text-secondary">{description}</p>
      )}
      {cta && <div className="mt-2">{cta}</div>}
    </div>
  );
}
