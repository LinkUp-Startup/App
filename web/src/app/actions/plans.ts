'use server';

import { redirect } from 'next/navigation';
import { getSharedPlan, savePlan, SessionExpiredError } from '@/lib/api';
import { endSession, getSession } from '@/lib/session';

export type SaveState = { saved?: boolean; error?: string };

/**
 * Saves the logged-in account's own copy of a shared plan (#206). The plan is fetched again here from its link
 * rather than taken from the page, so what gets saved is always what the owner shared.
 */
export async function saveSharedPlan(shareToken: string): Promise<SaveState> {
  const here = `/plan/${shareToken}`;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(here)}`);

  try {
    const plan = await getSharedPlan(shareToken);
    if (!plan) return { error: 'This plan isn’t shared anymore, so it can’t be saved.' };
    if ((await savePlan(session.accessToken, plan)) === 'limit') {
      return { error: 'Your saved plans are full. Delete one in the app to save this one.' };
    }
    return { saved: true };
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      await endSession();
      redirect(`/login?next=${encodeURIComponent(here)}`);
    }
    return { error: 'Couldn’t save the plan right now. Try again in a moment.' };
  }
}
