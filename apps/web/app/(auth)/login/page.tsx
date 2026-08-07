'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { AuthShell } from '@/components/auth/AuthShell';
import { TextField } from '@/components/auth/TextField';
import { SubmitButton } from '@/components/auth/SubmitButton';
import { FormError } from '@/components/auth/FormError';

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

    // Onboarding is the next step in the Blueprint's stated flow. The
    // onboarding page itself isn't built yet (out of scope — Phase 3) and
    // Checkpoint 22's middleware is what actually protects this route.
    router.push('/onboarding');
  };

  return (
    <AuthShell
      title="Sign in to Kindred Mind"
      description="Welcome back. Pick up where you left off."
      backHref="/"
      backLabel="← Back to home"
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

        <TextField
          id="password"
          label="Password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
        />

        <FormError message={error} />

        <SubmitButton isSubmitting={isSubmitting} loadingLabel="Signing in…">
          Sign in
        </SubmitButton>

        <Link
          href="/reset-password"
          className="text-center text-sm font-medium text-text-secondary transition-colors hover:text-brand-primary"
        >
          Forgot password?
        </Link>
      </form>
    </AuthShell>
  );
}
