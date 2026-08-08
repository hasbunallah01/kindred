'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { AuthShell } from '@/components/auth/AuthShell';
import { TextField } from '@/components/auth/TextField';
import { FormError } from '@/components/auth/FormError';
import { SubmitButton } from '@/components/auth/SubmitButton';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
    });

    setIsSubmitting(false);

    if (signInError) {
      setError(signInError.message ?? 'Invalid email or password.');
      return;
    }

    router.push('/onboarding/group');
  };

  return (
    <AuthShell
      title="Sign in to Kindred Mind"
      description="Welcome back. Sign in to your account."
      // No "back to home" link on the login page — it is itself the entry
      // to most other auth pages, and the landing page is one click away
      // via the logo above the card.
      backHref={null}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          id="email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <TextField
          id="password"
          label="Password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <FormError message={error} />

        <SubmitButton isSubmitting={isSubmitting} loadingLabel="Signing in…">
          Sign in
        </SubmitButton>

        <div className="flex flex-col items-center gap-1.5 pt-1 text-sm">
          <Link
            href="/reset-password"
            className="text-text-secondary transition-colors hover:text-brand-primary"
          >
            Forgot password?
          </Link>
          <p className="text-text-muted">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="font-medium text-brand-primary transition-colors hover:text-brand-primary-hover"
            >
              Create one
            </Link>
          </p>
        </div>
      </form>
    </AuthShell>
  );
}
