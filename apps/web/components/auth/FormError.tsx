'use client';

interface FormErrorProps {
  message: string | null;
}

// Inline form error message. Calm red text, no full-page error UI,
// no stack trace. The error appears directly under the form fields
// (or wherever the parent places it) so the user sees it without
// losing context.
export function FormError({ message }: FormErrorProps) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger"
    >
      {message}
    </p>
  );
}
