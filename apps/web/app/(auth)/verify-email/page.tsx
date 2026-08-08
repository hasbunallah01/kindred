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

  // Resend state — separated from the verify-form submit so the two
  // actions don't share their loading indicators. Without this, a
  // user who hits the 5-minute OTP expiry has no in-page recovery
  // path short of leaving and triggering signup from scratch.
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResendMessage(null);

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

    router.push('/onboarding/group');
  };

  const handleResend = async () => {
    if (!email) {
      setResendMessage('Add your email above to request a new code.');
      return;
    }
    setIsResending(true);
    setResendMessage(null);
    setError(null);

    const { error: resendError } =
      await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'email-verification',
      });

    setIsResending(false);

    if (resendError) {
      setResendMessage(
        resendError.message ??
          'Could not resend the code. Please try again in a moment.',
      );
      return;
    }

    setResendMessage(
      'A fresh code is on its way. Check your inbox (and spam folder).',
    );
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

        {/* Resend link — separate from the verify submit so the two
            actions never share a loading state. The 60-second cooldown
            is enforced server-side by Better Auth (default 3 requests
            per 60s on /email-otp/send-verification-otp) and the
            resendMessage tells the user what to expect. */}
        <div className="flex flex-col items-center gap-1 pt-1 text-sm">
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending || !email}
            className="font-medium text-brand-primary transition-colors hover:text-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isResending ? 'Sending…' : "Didn't get the code? Resend"}
          </button>
          {resendMessage && (
            <p className="text-xs text-text-secondary">{resendMessage}</p>
          )}
        </div>
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
