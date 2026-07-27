'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

// useSearchParams() requires a Suspense boundary for the page to build
// statically (Next.js App Router requirement) — same pattern as
// verify-email/page.tsx.
function ResetPasswordConfirmForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';

  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    const { error: resetError } = await authClient.emailOtp.resetPassword({
      email,
      otp,
      password,
    });

    if (resetError) {
      setIsSubmitting(false);
      setError(resetError.message ?? 'That code is invalid or has expired.');
      return;
    }

    // resetPassword updates the credential but does not itself establish a
    // session. The product requirement is explicit that the user must be
    // signed in automatically after a reset, so we chain an ordinary
    // email/password sign-in with the just-set password immediately after
    // — reusing the exact same sign-in call Checkpoint 20's login page
    // uses, not a new mechanism.
    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
    });

    setIsSubmitting(false);

    if (signInError) {
      // Password was reset successfully even if this sign-in call somehow
      // fails — send them to log in manually rather than losing the reset.
      router.push('/login');
      return;
    }

    router.push('/onboarding');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-6"
    >
      <h1 className="text-xl font-semibold tracking-tight">Enter your new password</h1>
      <p className="text-sm text-neutral-400">
        Enter the 6-digit code sent to <strong>{email}</strong> along with your new password.
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor="otp" className="text-sm text-neutral-400">
          Verification code
        </label>
        <input
          id="otp"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoComplete="one-time-code"
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
          className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-center text-lg tracking-[0.5em] text-neutral-100"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm text-neutral-400">
          New password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="confirmPassword" className="text-sm text-neutral-400">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting || otp.length !== 6}
        className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
      >
        {isSubmitting ? 'Resetting…' : 'Reset password'}
      </button>
    </form>
  );
}

export default function ResetPasswordConfirmPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <Suspense fallback={null}>
        <ResetPasswordConfirmForm />
      </Suspense>
    </main>
  );
}
