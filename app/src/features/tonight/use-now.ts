import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** The current time, refreshed every `intervalMs` and as soon as the app comes back to the front. */
export function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, intervalMs);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [intervalMs]);
  return now;
}
