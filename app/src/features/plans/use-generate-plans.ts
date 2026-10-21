import { useCallback, useEffect, useState } from 'react';

import { describeApiError } from '@/api/errors';
import { generatePlans } from '@/api/plans';
import type { NightPreferences, Plan } from '@/types/api';

export type GeneratePlansState =
  | { status: 'loading' }
  | { status: 'success'; plans: Plan[] }
  | { status: 'error'; message: string };

/** Requests plans for the preferences when mounted; `retry` sends the request again. */
export function useGeneratePlans(preferences: NightPreferences) {
  const [state, setState] = useState<GeneratePlansState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    generatePlans(preferences, controller.signal)
      .then(({ plans }) => setState({ status: 'success', plans }))
      .catch((error: unknown) => {
        // Leaving the screen aborts the request; that isn't an error to show.
        if (!controller.signal.aborted) {
          setState({ status: 'error', message: describeApiError(error) });
        }
      });
    return () => controller.abort();
  }, [preferences, attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
