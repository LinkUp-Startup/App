import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { getGroup, listGroupPlans } from '@/api/groups';
import { describeGroupError } from '@/features/groups/errors';
import type { Group, GroupPlanRound } from '@/types/api';

/* How often an open group checks for plans other members generated */
export const GroupRefreshIntervalMs = 15_000;

type GroupState = {
  group?: Group;
  rounds?: GroupPlanRound[];
  error?: string;
};

/**
 * The group and its plans. Loaded whenever the screen is shown (so coming back from planning shows the new
 * plans), and refreshed every GroupRefreshIntervalMs while it stays open, so plans another member generates
 * appear on their own.
 */
export function useGroup(accessToken: string | null, groupId: string | undefined) {
  const [state, setState] = useState<GroupState>({});
  // Only a failed first load replaces the screen with an error; a failed background refresh keeps what is
  // already shown and tries again on the next tick.
  const loaded = useRef(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!accessToken || !groupId) return;
      try {
        const [group, plans] = await Promise.all([
          getGroup(accessToken, groupId, signal),
          listGroupPlans(accessToken, groupId, signal),
        ]);
        loaded.current = true;
        setState({ group, rounds: plans.rounds });
      } catch (caught) {
        if (signal?.aborted) return;
        if (loaded.current) console.warn('Could not refresh the group', caught);
        else setState({ error: describeGroupError(caught) });
      }
    },
    [accessToken, groupId],
  );

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      load(controller.signal);
      const timer = setInterval(() => load(controller.signal), GroupRefreshIntervalMs);
      return () => {
        clearInterval(timer);
        controller.abort();
      };
    }, [load]),
  );

  // After an error: start over, showing "Loading…" until it answers
  const reload = useCallback(() => {
    loaded.current = false;
    setState({});
    return load();
  }, [load]);

  // After a change (a member removed): load again and swap the new data in, without going back to "Loading…"
  const refresh = useCallback(() => load(), [load]);

  return { ...state, reload, refresh };
}
