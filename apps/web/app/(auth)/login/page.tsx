'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';

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
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-6"
      >
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>

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

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm text-neutral-400">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>

        <Link
          href="/reset-password"
          className="text-center text-sm text-neutral-400 hover:text-neutral-200"
        >
          Forgot password?
        </Link>
      </form>
    </main>
  );
}
