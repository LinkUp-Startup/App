import { useEffect } from 'react';

import { syncSavedPlans } from '@/features/plans/saved-plans-sync';

/**
 * Syncs the saved plans with the account whenever someone is signed in: on login (which moves a guest's
 * plans to the account) and when the app starts with a restored session. Failing, for instance offline, only
 * means the plans on the device stay as they are until the next sync.
 */
export function useSyncSavedPlans(accessToken: string | null) {
  useEffect(() => {
    if (!accessToken) return;

    const controller = new AbortController();
    syncSavedPlans(accessToken, controller.signal).catch((error: unknown) => {
      if (!controller.signal.aborted) console.warn('Could not sync saved plans', error);
    });
    return () => controller.abort();
  }, [accessToken]);
}
