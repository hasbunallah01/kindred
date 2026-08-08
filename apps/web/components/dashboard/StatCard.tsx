import type { ReactNode } from 'react';

// Tiny stat card used in the dashboard's Community Memory strip.
// Shows a single number with a label, plus an optional icon. Designed
// to communicate "memory is taking shape" without becoming a
// metrics-heavy analytics panel. The value can be a string (e.g. "—")
// when the backend doesn't have data yet, rather than a misleading
// fake number.

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  helpText?: string;
}

export function StatCard({ label, value, icon, helpText }: StatCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-border bg-white p-4">
      {icon && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-input bg-brand-primary/10 text-brand-primary">
          {icon}
        </div>
      )}
      <div className="flex flex-col">
        <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
          {label}
        </span>
        <span className="mt-0.5 text-2xl font-bold tracking-tight text-text-primary">
          {value}
        </span>
        {helpText && (
          <span className="mt-0.5 text-xs text-text-muted">{helpText}</span>
        )}
      </div>
    </div>
  );
}
