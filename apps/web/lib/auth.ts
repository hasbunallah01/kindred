import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@kindred/db';
import { sendEmail } from './email';

// Better Auth configuration for Kindred.
//
// BETTER_AUTH_SECRET and BETTER_AUTH_URL are read automatically from the
// environment by Better Auth itself — no need to pass them here (see
// Blueprint Section 11 / .env.example). In development, Better Auth falls
// back to an insecure default secret if unset rather than throwing; it
// throws only in production if BETTER_AUTH_SECRET is missing.
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  // Trusted origins for CSRF / origin-header validation. Better Auth only
  // accepts requests whose `Origin` header matches one of these (or the
  // configured baseURL / BETTER_AUTH_URL). Without this, every Vercel
  // preview deployment (`https://<project>-git-<branch>-<account>.vercel.app`)
  // is rejected with "Invalid origin" because baseURL is set to the
  // production domain. The wildcard covers every Vercel preview URL in
  // one entry (Better Auth's matchesOriginPattern supports `*`). The
  // production custom domain (e.g. https://kindred.haybee.xyz) is still
  // covered automatically by baseURL / BETTER_AUTH_URL — we don't need
  // to list it here.
  //
  // We intentionally do NOT include `http://localhost:*` in this list:
  // local dev should set BETTER_AUTH_URL=http://localhost:3000 (see
  // .env.example), and Better Auth trusts the baseURL by default.
  trustedOrigins: [
    'https://*.vercel.app',
  ],
  // Public username handle — declared here so Better Auth's Prisma adapter
  // accepts and persists the `username` field on signup. The Prisma column
  // is `username String? @unique` (nullable, unique) — nullable so existing
  // users (pre-username rollout) keep signing in with email + password
  // without modification. New signups are required to provide one at the
  // form level (apps/web/app/(auth)/signup/page.tsx); the Prisma unique
  // constraint surfaces "username already taken" via Better Auth's standard
  // error channel. The transform normalises any incoming value to lowercase
  // server-side, defending against clients that bypass the form's auto-
  // lowercasing. The 3-20 char alphanumeric+underscore rule is enforced
  // at the form layer — see signup/page.tsx for the regex + helper copy.
  user: {
    additionalFields: {
      username: {
        type: 'string',
        required: false,
        input: true,
        unique: true,
        transform: {
          input: (value) => (typeof value === 'string' ? value.toLowerCase() : value),
        },
      },
    },
  },
  // Email verification and password reset both use Better Auth's official
  // emailOTP plugin (better-auth/plugins) rather than the link-based
  // emailVerification hook from the original Checkpoint 18 build — the
  // product requirement changed to OTP for both flows (see the Checkpoint
  // 21 commit for the full reasoning). This is the smallest customization
  // that satisfies it: no hand-rolled OTP generation, storage, or
  // expiry logic — all of that is the plugin's job. Both flows reuse the
  // exact same sendVerificationOTP hook and the exact same Resend-backed
  // sendEmail() from Checkpoint 18 — one underlying send mechanism for
  // both, per the "shared OTP implementation" requirement.
  plugins: [
    emailOTP({
      // Sends the OTP automatically as part of sign-up itself — this
      // plugin-level trigger is self-contained and replaces the old
      // core emailVerification.sendOnSignUp + sendVerificationEmail pair
      // entirely, rather than combining it with
      // emailOTP's overrideDefaultEmailVerification flag. Fewer moving
      // parts for the same outcome.
      sendVerificationOnSignUp: true,
      async sendVerificationOTP({ email, otp, type }) {
        const subject =
          type === 'forget-password'
            ? 'Reset your password — Kindred'
            : 'Verify your email — Kindred';
        const intro =
          type === 'forget-password'
            ? 'Use this code to reset your Kindred password:'
            : 'Use this code to verify your email address:';

        // Logo is served from apps/web/public/brand/ (Next.js serves
        // anything under public/ at the site root) and referenced via the
        // existing NEXT_PUBLIC_APP_URL env var — no hardcoded domain.
        // Email clients need an absolute, publicly-reachable URL; a local
        // file path or relative path won't render in an inbox.
        const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kindred.haybee.xyz';
        const logoUrl = `${siteUrl}/brand/kindred-logo-email.png`;

        const html = `
          <div style="text-align:center;padding:24px 0 8px;">
            <img src="${logoUrl}" alt="Kindred" width="200" style="max-width:200px;height:auto;" />
          </div>
          <p>${intro}</p>
          <p style="font-size:28px;font-weight:600;letter-spacing:4px;">${otp}</p>
          <p>This code expires in 5 minutes. If you didn't request this, you can ignore this email.</p>
        `;

        // Not awaited, per the emailOTP plugin's own documented guidance
        // (identical rationale to Checkpoint 18's original comment): avoids
        // a timing side-channel. Errors are still caught and logged.
        void sendEmail({ to: email, subject, html }).catch((error: unknown) => {
          console.error('Failed to send OTP email:', error);
        });
      },
    }),
  ],
});
