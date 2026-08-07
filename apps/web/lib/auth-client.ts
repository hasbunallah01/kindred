import { createAuthClient } from 'better-auth/react';
import { emailOTPClient, inferAdditionalFields } from 'better-auth/client/plugins';
import type { auth } from './auth';

// Shared Better Auth client for every client component that needs one:
// signup, login, verify-email (OTP), and reset-password (OTP).
//
// No baseURL needed — the client and the /api/auth/* route are served from
// the same origin (see Better Auth's own installation docs on this point).
//
// `inferAdditionalFields<typeof auth>()` is required so the client knows
// about the `user.additionalFields` configured on the server side in
// ./auth.ts — without it, `authClient.signUp.email({ username })` would
// fail TypeScript's type check because the inferred client API would
// only know about the core User fields (name, email, password, image).
// See https://www.better-auth.com/docs/concepts/typescript#additional-fields
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), emailOTPClient()],
});
