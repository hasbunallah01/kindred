'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

// useSearchParams() requires a Suspense boundary for the page to build
// statically (Next.js App Router requirement) — the form itself lives in
// VerifyEmailForm below; this file's default export just supplies that
// boundary.
function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';

  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Sign-up (Checkpoint 19/20) already created the session — an
    // unverified account can hold one, per Blueprint Section 4. This step's
    // only job is flipping emailVerified to true; no separate sign-in call
    // is needed here.
    const { error: verifyError } = await authClient.emailOtp.verifyEmail({
      email,
      otp,
    });

    setIsSubmitting(false);

    if (verifyError) {
      setError(verifyError.message ?? 'That code is invalid or has expired.');
      return;
    }

    router.push('/onboarding');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-6"
    >
      <h1 className="text-xl font-semibold tracking-tight">Verify your email</h1>
      <p className="text-sm text-neutral-400">
        We sent a 6-digit code to <strong>{email}</strong>. Enter it below.
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

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting || otp.length !== 6}
        className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
      >
        {isSubmitting ? 'Verifying…' : 'Verify'}
      </button>
    </form>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <Suspense fallback={null}>
        <VerifyEmailForm />
      </Suspense>
    </main>
  );
}
