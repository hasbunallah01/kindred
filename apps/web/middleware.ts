import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

// Protects /dashboard/* and /onboarding/* per Blueprint Section 4 /
// Build Plan Checkpoint 22. Unaffected by the OTP UX change — Checkpoint
// 22 is unchanged from the original Build Plan.
//
// This follows Better Auth's own documented, officially recommended
// pattern: an optimistic cookie-presence check in middleware, not a full
// session validation. getSessionCookie() only checks that a session
// cookie EXISTS — it does not verify the cookie's contents against the
// database. That's a deliberate tradeoff Better Auth's docs make
// explicit: middleware runs on every matched request, so a real
// database-backed check here would add latency to every request; the
// pattern is "optimistic redirect in middleware, real validation on the
// server for any protected page/action." Since /dashboard and
// /onboarding pages don't exist yet (out of scope — Phase 3), there is
// nothing further to wire here; whoever builds those pages must still
// call auth.api.getSession() server-side before treating the request as
// authenticated for any actual data access.
export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/onboarding/:path*'],
};
