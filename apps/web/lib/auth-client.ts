import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';

// Shared Better Auth client for every client component that needs one:
// signup, login, verify-email (OTP), and reset-password (OTP).
//
// No baseURL needed — the client and the /api/auth/* route are served from
// the same origin (see Better Auth's own installation docs on this point).
export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
});
