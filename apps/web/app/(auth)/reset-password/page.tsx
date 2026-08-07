'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { AuthShell } from '@/components/auth/AuthShell';
import { TextField } from '@/components/auth/TextField';
import { SubmitButton } from '@/components/auth/SubmitButton';
import { FormError } from '@/components/auth/FormError';

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
    <AuthShell
      title="Reset your password"
      description="Enter your account email and we will send you a 6-digit code."
      backHref="/login"
      backLabel="Remembered it? Sign in"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          id="email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoFocus
        />

        <FormError message={error} />

        <SubmitButton isSubmitting={isSubmitting} loadingLabel="Sending code…">
          Send code
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
