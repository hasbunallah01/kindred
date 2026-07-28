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
  // TEMPORARY DIAGNOSTIC (to be reverted): matcher set to a path that
  // never matches anything real, so middleware still builds and deploys
  // but is never invoked for any actual request. The first version of
  // this diagnostic used an empty array (matcher: []) — that build
  // FAILED outright, a different and more informative failure than the
  // 404 it was meant to test. Since matcher: [] is the only thing that
  // changed between "builds fine, 404s at runtime" and "fails to build
  // at all," an empty matcher array is very likely invalid or mishandled
  // specifically at Vercel's build/deployment step (Next.js's own local
  // tooling tolerates it; Vercel's Edge Function manifest generation
  // apparently does not). Using a real, non-empty (but never-matching)
  // pattern avoids that failure mode while preserving the same
  // diagnostic intent: isolate whether middleware invocation itself
  // (under runtime: 'nodejs') is what broke routing on all three domains.
  runtime: 'nodejs',
  matcher: ['/__diagnostic_never_matches__'],
};
