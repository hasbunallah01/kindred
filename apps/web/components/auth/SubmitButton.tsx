'use client';

import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isSubmitting: boolean;
  loadingLabel: string;
  children: ReactNode;
}

// Primary submit button used by every auth form. While a form is
// submitting, replaces the label with a small spinner and the
// loading text, and disables itself. Visual style matches the
// Design Foundation's primary button: 14px radius, full brand
// purple background, white semibold text.
export function SubmitButton({
  isSubmitting,
  loadingLabel,
  children,
  disabled,
  className = '',
  ...rest
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={isSubmitting || disabled}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-input bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    >
      {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
      {isSubmitting ? loadingLabel : children}
    </button>
  );
}
