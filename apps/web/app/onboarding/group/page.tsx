import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { GroupLinkingCode } from './GroupLinkingCode';

// Same real, server-side session validation as onboarding/page.tsx —
// this page mutates data (generates a linking code tied to the creator),
// so it needs more than middleware's optimistic cookie check.
export default async function OnboardingGroupPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/login');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Add Kindred to your group</h1>
        <p className="text-sm text-neutral-400">
          Add the Kindred bot to your Telegram community, then post this code as a message there:
        </p>

        <GroupLinkingCode />

        <p className="text-xs text-neutral-500">
          Post it as <code className="text-neutral-300">/link YOURCODE</code> in the group.
        </p>
      </div>
    </main>
  );
}
