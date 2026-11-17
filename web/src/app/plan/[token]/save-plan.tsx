'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { saveSharedPlan, type SaveState } from '@/app/actions/plans';
import { buttonClass } from '@/components/button';

/** "Save to my plans" on a shared plan; guests are sent to log in first and come back here. */
export function SavePlan({
  shareToken,
  loggedIn,
  alreadySaved,
}: {
  shareToken: string;
  loggedIn: boolean;
  alreadySaved: boolean;
}) {
  const [state, action, pending] = useActionState<SaveState>(
    saveSharedPlan.bind(null, shareToken),
    { saved: alreadySaved },
  );

  if (!loggedIn) {
    return (
      <div className="mt-8">
        <Link
          href={`/login?next=${encodeURIComponent(`/plan/${shareToken}`)}`}
          className={buttonClass}>
          Log in to save this plan
        </Link>
        <p className="mt-3 text-sm text-mauve">
          Your copy stays in your plans, even if this link stops working.
        </p>
      </div>
    );
  }

  if (state.saved) {
    return (
      <p role="status" className="mt-8 max-w-prose rounded-xl bg-plum px-5 py-4 text-blush">
        {alreadySaved && !pending ? 'This plan is in your saved plans.' : 'Saved to your plans.'}{' '}
        Open the LinkUp app to see it; you keep it even if this link stops working.
      </p>
    );
  }

  return (
    <form action={action} className="mt-8">
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? 'Saving…' : 'Save to my plans'}
      </button>
      {state.error && (
        <p role="alert" className="mt-3 text-sm text-coral">
          {state.error}
        </p>
      )}
    </form>
  );
}
