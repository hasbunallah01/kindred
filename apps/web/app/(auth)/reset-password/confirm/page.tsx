'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { AuthShell } from '@/components/auth/AuthShell';
import { TextField, OtpField } from '@/components/auth/TextField';
import { FormError } from '@/components/auth/FormError';
import { SubmitButton } from '@/components/auth/SubmitButton';

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
    // email/password sign-in with the just-set password immediately after.
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
    <AuthShell
      title="Enter your new password"
      description={`Enter the 6-digit code sent to ${email ? email : 'your email'} along with your new password.`}
      // No "back" link on the confirm step — the user is mid-flow and the
      // most useful action is "request a new code" which is a future
      // improvement, not a navigation action.
      backHref={null}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <OtpField
          id="otp"
          label="Verification code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoComplete="one-time-code"
          autoFocus
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
        />

        <TextField
          id="password"
          label="New password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          helper="At least 8 characters."
        />

        <TextField
          id="confirmPassword"
          label="Confirm new password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />

        <FormError message={error} />

        <SubmitButton
          isSubmitting={isSubmitting}
          loadingLabel="Resetting…"
          disabled={otp.length !== 6}
        >
          Reset password
        </SubmitButton>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordConfirmForm />
    </Suspense>
  );
}
