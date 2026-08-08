import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

// Legacy /onboarding entry point. The product no longer has a
// welcome page (per the Kindred Mind design — there's no "Next"
// between signup and the connect-your-community step). Any URL
// that still points here — older auth redirects, stale bookmarks,
// anything else — bounces to /onboarding/group, the only real
// onboarding step that exists.

export default async function OnboardingIndex() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect('/login');
  }
  redirect('/onboarding/group');
}
