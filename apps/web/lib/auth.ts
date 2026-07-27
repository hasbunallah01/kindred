import { betterAuth } from 'better-auth';
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
//
// Password reset email sending is intentionally not wired yet — that's
// Build Plan Checkpoint 23, alongside the reset-password pages themselves.
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  emailVerification: {
    // Auto-send a verification email as part of the sign-up flow itself —
    // this is what Checkpoint 18's own goal requires ("calling the sign-up
    // flow triggers a ... Resend send request").
    sendOnSignUp: true,
    async sendVerificationEmail({ user, url }) {
      // Not awaited, per Better Auth's own documented guidance: awaiting
      // the send here can expose a timing side-channel (an attacker could
      // distinguish real vs. non-existent accounts by response latency).
      // Errors are still caught and logged rather than silently swallowed.
      void sendEmail({
        to: user.email,
        subject: 'Verify your email — Kindred',
        html: `<p>Welcome to Kindred.</p><p>Click the link below to verify your email address:</p><p><a href="${url}">${url}</a></p>`,
      }).catch((error: unknown) => {
        console.error('Failed to send verification email:', error);
      });
    },
  },
});
