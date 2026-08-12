import type { ReactNode } from 'react';

// Compact metric card used in the dashboard's Community Memory
// strip. Per the redesign, these are intentionally SMALLER and
// more visual than the previous version — they support the
// "What Kindred noticed" hero rather than dominate the page.
// Each card carries a small icon inside a soft tint container
// (purple for members, pink for relationships, amber for moments)
// and a single number. No giant typography, no border bloat.

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  iconBgClass?: string;
  iconColorClass?: string;
  helpText?: string;
}

export function StatCard({
  label,
  value,
  icon,
  iconBgClass = 'bg-purple-light',
  iconColorClass = 'text-brand-primary',
  helpText,
}: StatCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 sm:p-5">
      {icon && (
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBgClass} ${iconColorClass}`}
        >
          {icon}
        </div>
      )}
      <div>
        <p className="text-2xl font-bold leading-none tracking-tight text-text-primary sm:text-3xl">
          {value}
        </p>
        <p className="mt-1.5 text-sm font-medium text-text-secondary">
          {label}
        </p>
        {helpText && (
          <p className="mt-0.5 text-xs text-text-muted">{helpText}</p>
        )}
      </div>
    </div>
  );
}
