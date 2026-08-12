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
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-white p-3 sm:p-3.5">
      {icon && (
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-xl ${iconBgClass} ${iconColorClass}`}
        >
          {icon}
        </div>
      )}
      <div>
        <p className="text-xl font-bold leading-none tracking-tight text-text-primary sm:text-2xl">
          {value}
        </p>
        <p className="mt-1 text-xs font-medium text-text-secondary">
          {label}
        </p>
        {helpText && (
          <p className="mt-0.5 text-[10px] text-text-muted">{helpText}</p>
        )}
      </div>
    </div>
  );
}
