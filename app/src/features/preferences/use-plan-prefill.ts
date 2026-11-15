import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getUserPreferences } from '@/api/user-preferences';
import { emptyDefaults, isUserPreferences } from '@/features/preferences/defaults-form';
import { loadGuestPreferences } from '@/storage/guest-preferences';
import type { UserPreferences } from '@/types/api';

/** Reuses the existing stores. An active draft prevents reads on subsequent tab visits. */
export function usePlanPrefill(
  accessToken: string | null,
  applyDefaults: (values: UserPreferences) => void,
  hasDraft: () => boolean,
) {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (hasDraft()) {
        setLoading(false);
        return;
      }
      let active = true;
      const controller = new AbortController();
      setLoading(true);
      setMessage('');
      const load = accessToken
        ? getUserPreferences(accessToken, controller.signal)
        : loadGuestPreferences();
      load
        .then((saved) => {
          if (!active) return;
          if (isUserPreferences(saved)) applyDefaults(saved);
          else {
            applyDefaults(emptyDefaults());
            setMessage(
              'Saved defaults are no longer valid. You can still edit and generate a plan.',
            );
          }
        })
        .catch(() => {
          if (!active) return;
          applyDefaults(emptyDefaults());
          setMessage(
            accessToken
              ? 'Could not load your account defaults. You can still edit and generate a plan.'
              : 'Could not load defaults from this phone. You can still edit and generate a plan.',
          );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
        controller.abort();
      };
    }, [accessToken, applyDefaults, hasDraft]),
  );

  return { loading, message };
}
