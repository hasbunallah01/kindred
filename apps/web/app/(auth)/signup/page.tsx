'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { AuthShell } from '@/components/auth/AuthShell';
import { TextField } from '@/components/auth/TextField';
import { FormError } from '@/components/auth/FormError';
import { SubmitButton } from '@/components/auth/SubmitButton';

// Public username validation — applied client-side before submit, and
// mirrored server-side via Better Auth's `additionalFields` transform
// (apps/web/lib/auth.ts) which lowercases any incoming value, plus the
// Prisma unique constraint (packages/db/schema.prisma) which surfaces
// "username already taken" through Better Auth's standard error channel.
//
// Rules: 3-20 chars, lowercase, [a-z0-9_] only, no leading/trailing
// underscore. The regex enforces all of those constraints by
// construction — the leading and trailing [a-z0-9] anchors handle the
// no-edge-underscore rule, the character class handles allowed chars,
// and the {1,18} middle bound forces length 3-20 (1 leading + 1-18
// middle + 1 trailing). Auto-lowercasing on change keeps the input in
// sync with what the server will store.
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_]{1,18}[a-z0-9]$/;
const USERNAME_HELPER =
  '3–20 characters. Lowercase letters, numbers, and underscores. Cannot start or end with an underscore.';

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    // Username format guard — the input pattern attribute already blocks
    // bad characters at the keyboard level, but defence in depth: re-check
    // here so a programmatic submit or a browser that doesn't enforce
    // pattern still produces a clear error message.
    if (!USERNAME_PATTERN.test(username)) {
      setError(USERNAME_HELPER);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    const { error: signUpError } = await authClient.signUp.email({
      name,
      username,
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
      backHref="/"
      backLabel="← Back to home"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          id="name"
          label="Full name"
          type="text"
          required
          autoComplete="name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <TextField
          id="username"
          label="Username"
          type="text"
          required
          // Constrain the input to allowed characters at the keyboard
          // level. The pattern attribute is a *soft* hint — most browsers
          // show a tooltip on submit if the value doesn't match, but they
          // don't block the input itself. The server-side mirror lives
          // in apps/web/lib/auth.ts (transform: input) and the
          // authoritative check is the regex in handleSubmit above.
          pattern="[a-z0-9_]+"
          minLength={3}
          maxLength={20}
          autoComplete="username"
          spellCheck={false}
          value={username}
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
          helper={USERNAME_HELPER}
        />

        <TextField
          id="email"
          label="Email Address"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
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
        />

        <FormError message={error} />

        <SubmitButton isSubmitting={isSubmitting} loadingLabel="Creating account…">
          Create account
        </SubmitButton>

        <p className="pt-1 text-center text-sm text-text-muted">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-brand-primary transition-colors hover:text-brand-primary-hover"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
