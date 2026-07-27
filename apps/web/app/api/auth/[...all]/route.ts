import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

// Mounts every Better Auth endpoint (sign-up, sign-in, sign-out, session,
// verify-email, reset-password, etc.) at /api/auth/*.
export const { GET, POST } = toNextJsHandler(auth);
