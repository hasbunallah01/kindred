import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@kindred/db';

// Better Auth configuration for Kindred.
//
// BETTER_AUTH_SECRET and BETTER_AUTH_URL are read automatically from the
// environment by Better Auth itself — no need to pass them here (see
// Blueprint Section 11 / .env.example). In development, Better Auth falls
// back to an insecure default secret if unset rather than throwing; it
// throws only in production if BETTER_AUTH_SECRET is missing.
//
// Email sending (verification, password reset) is intentionally not wired
// yet — that depends on Resend, which is Build Plan Checkpoint 18.
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
});
