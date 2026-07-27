'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // requestPasswordReset sends a "forget-password" OTP through the same
    // emailOTP plugin (and the same Resend-backed sendEmail) as email
    // verification — the shared OTP mechanism the product requirement
    // calls for. This is the current, non-deprecated method name (the
    // plugin's docs note the older /forget-password/email-otp endpoint is
    // deprecated in favor of this one).
    const { error: requestError } = await authClient.emailOtp.requestPasswordReset({
      email,
    });

    setIsSubmitting(false);

    if (requestError) {
      setError(requestError.message ?? 'Something went wrong. Please try again.');
      return;
    }

    router.push(`/reset-password/confirm?email=${encodeURIComponent(email)}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-6"
      >
        <h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-sm text-neutral-400">
          Enter your account email and we&apos;ll send you a 6-digit code.
        </p>

        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm text-neutral-400">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
        >
          {isSubmitting ? 'Sending code…' : 'Send code'}
        </button>
      </form>
    </main>
  );
}
