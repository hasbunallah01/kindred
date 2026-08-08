'use client';

import type { InputHTMLAttributes, ReactNode } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  // Optional helper text shown directly under the input (e.g. "At
  // least 8 characters"). Differs visually from the page-level
  // description copy above the form.
  helper?: ReactNode;
}

// Labeled text input used by every auth form. Visual style matches
// the Design Foundation's text input (Section 9.1): white background,
// soft hairline border, 14px radius, generous 14px×16px padding,
// 16px font (so iOS doesn't auto-zoom on focus). Label sits above
// the input (never inside as a placeholder), Inter 500 14px.
export function TextField({ label, helper, className = '', ...rest }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={rest.id} className="text-sm font-medium text-text-primary">
        {label}
      </label>
      <input
        className={`rounded-input border border-border bg-white px-4 py-3 text-base text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/40 disabled:bg-surface disabled:text-text-muted ${className}`}
        {...rest}
      />
      {helper && <p className="text-xs text-text-secondary">{helper}</p>}
    </div>
  );
}

// Labeled text input styled for 6-digit OTP entry. Same field
// structure as TextField but with centered monospace tracking so
// each digit sits in its own visual cell.
export function OtpField({ label, helper, className = '', ...rest }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={rest.id} className="text-sm font-medium text-text-primary">
        {label}
      </label>
      <input
        className={`rounded-input border border-border bg-white px-4 py-3 text-center text-2xl tracking-[0.5em] text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/40 ${className}`}
        {...rest}
      />
      {helper && <p className="text-xs text-text-secondary">{helper}</p>}
    </div>
  );
}
