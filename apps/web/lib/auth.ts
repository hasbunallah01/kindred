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
        const html = `<p>${intro}</p><p style="font-size:28px;font-weight:600;letter-spacing:4px;">${otp}</p><p>This code expires in 5 minutes. If you didn't request this, you can ignore this email.</p>`;

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
