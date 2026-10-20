import { useCallback, useEffect, useState } from 'react';

import { getHealth } from '@/api/health';

export type ApiHealth = 'checking' | 'online' | 'offline';

export function useApiHealth() {
  const [health, setHealth] = useState<ApiHealth>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then(() => setHealth('online'))
      .catch(() => {
        if (!controller.signal.aborted) setHealth('offline');
      });
    return () => controller.abort();
  }, [attempt]);

  const recheck = useCallback(() => {
    setHealth('checking');
    setAttempt((n) => n + 1);
  }, []);

  return { health, recheck };
}
