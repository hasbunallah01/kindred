'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { AuthShell } from '@/components/auth/AuthShell';
import { OtpField } from '@/components/auth/TextField';
import { FormError } from '@/components/auth/FormError';
import { SubmitButton } from '@/components/auth/SubmitButton';

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
    <AuthShell
      title="Verify your email"
      description={`We sent a 6-digit code to ${email ? email : 'your inbox'}. Enter it below to continue.`}
      backHref="/login"
      backLabel="← Back to sign in"
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

        <FormError message={error} />

        <SubmitButton isSubmitting={isSubmitting} loadingLabel="Verifying…">
          Verify
        </SubmitButton>
      </form>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
