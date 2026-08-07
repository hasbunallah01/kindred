'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { AuthShell } from '@/components/auth/AuthShell';
import { TextField } from '@/components/auth/TextField';
import { SubmitButton } from '@/components/auth/SubmitButton';
import { FormError } from '@/components/auth/FormError';

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
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

    // Better Auth's sign-up creates the user (emailVerified: false) and
    // establishes a session immediately (unverified accounts can still hold
    // a session — see Blueprint Section 4). The emailOTP plugin's
    // sendVerificationOnSignUp config (apps/web/lib/auth.ts) sends the OTP
    // through the existing Resend adapter automatically — nothing else to
    // wire here.
    const { error: signUpError } = await authClient.signUp.email({
      name,
      email,
      password,
    });

    setIsSubmitting(false);

    if (signUpError) {
      setError(signUpError.message ?? 'Something went wrong. Please try again.');
      return;
    }

    router.push(`/verify-email?email=${encodeURIComponent(email)}`);
  };

  return (
    <AuthShell
      title="Create your account"
      description="Start remembering the people behind your community."
      backHref="/login"
      backLabel="Already have an account? Sign in"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          id="name"
          label="Full name"
          type="text"
          required
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          autoFocus
        />

        <TextField
          id="email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />

        <TextField
          id="password"
          label="Password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          helper="At least 8 characters."
          placeholder="••••••••"
        />

        <TextField
          id="confirmPassword"
          label="Confirm password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="••••••••"
        />

        <FormError message={error} />

        <SubmitButton isSubmitting={isSubmitting} loadingLabel="Creating account…">
          Create account
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
