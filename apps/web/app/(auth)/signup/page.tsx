'use client';

import { useState, type FormEvent } from 'react';
import { createAuthClient } from 'better-auth/react';

// No baseURL needed — the client and the /api/auth/* route are served from
// the same origin (see Better Auth's own installation docs on this point).
const authClient = createAuthClient();

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Better Auth's sign-up creates the user (emailVerified: false) and,
    // per Checkpoint 18's emailVerification.sendOnSignUp config, triggers
    // the verification email through the Resend adapter automatically —
    // nothing else to wire here.
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

    setSuccess(true);
  };

  if (success) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="max-w-sm text-neutral-400">
          We&apos;ve sent a verification link to <strong>{email}</strong>. Click it to verify your
          account.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-6"
      >
        <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>

        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm text-neutral-400">
            Name
          </label>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
          />
        </div>

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
            minLength={8}
            autoComplete="new-password"
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
          {isSubmitting ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
    </main>
  );
}
