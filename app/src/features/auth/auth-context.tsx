import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { getMe } from '@/api/auth';
import { ApiError } from '@/api/client';
import { isExpired, msUntilExpiry } from '@/features/auth/expiry';
import { clearSavedPlans } from '@/storage/saved-plans';
import { clearSession, loadSession, saveSession, type StoredSession } from '@/storage/session';
import type { AuthResponse, User } from '@/types/api';

type AuthState = {
  /** "loading" until the saved session (if any) has been read from the device, then "ready". */
  status: 'loading' | 'ready';
  /** The signed-in account, or null when using the app as a guest. */
  user: User | null;
  accessToken: string | null;
  signIn: (response: AuthResponse) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

/** Reading the saved session should be instant; if it somehow isn't, start as a guest rather than hang. */
export const RestoreTimeoutMs = 5_000;

/** setTimeout fires immediately for delays above this (about 24.8 days). */
const MaxTimerMs = 2 ** 31 - 1;

function loadSessionWithTimeout(): Promise<StoredSession | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), RestoreTimeoutMs);
    loadSession().then((session) => {
      clearTimeout(timer);
      resolve(session);
    });
  });
}

/**
 * Who is signed in. The session is kept in secure storage (see `storage/session.ts`), so it survives the
 * app being closed:
 *  - on launch it is restored, unless it has expired or is damaged, and then confirmed with the server in
 *    the background. A 401 ends it; being offline doesn't, since we can't tell.
 *  - when the token expires the user is signed out, including after the app was in the background.
 *  - signing out removes it from the device, along with the saved plans kept here (they stay in the account).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthResponse | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');
  // Bumped by signIn and signOut, so a slower restore never overwrites what the user just did.
  const changes = useRef(0);

  const signIn = useCallback((response: AuthResponse) => {
    changes.current += 1;
    setSession(response);
    setStatus('ready');
    // Not being able to store it only means logging in again next time; the session still works now.
    saveSession(response).catch((error: unknown) =>
      console.warn('Could not save the session', error),
    );
  }, []);

  const signOut = useCallback(() => {
    changes.current += 1;
    setSession(null);
    setStatus('ready');
    void clearSession();
    // The account's plans stay in the cloud; clearing them here keeps them from showing to a guest or being
    // uploaded to whoever signs in next on this device.
    clearSavedPlans().catch((error: unknown) => console.warn('Could not clear saved plans', error));
  }, []);

  // Restore the saved session on launch.
  useEffect(() => {
    const controller = new AbortController();
    const startedAt = changes.current;

    void (async () => {
      const stored = await loadSessionWithTimeout();
      if (controller.signal.aborted || changes.current !== startedAt) return;

      if (!stored || isExpired(stored.expiresAt)) {
        if (stored) await clearSession();
        setSession(null);
        setStatus('ready');
        return;
      }

      setSession(stored);
      setStatus('ready');

      try {
        await getMe(stored.accessToken, controller.signal);
      } catch (error) {
        if (controller.signal.aborted || changes.current !== startedAt) return;
        if (error instanceof ApiError && error.status === 401) signOut();
        // Offline or a server error: keep the session, we can't tell whether it is still valid.
      }
    })();

    return () => controller.abort();
  }, [signOut]);

  // End the session when its token expires.
  const expiresAt = session?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      const remaining = msUntilExpiry(expiresAt);
      if (remaining <= 0) signOut();
      else timer = setTimeout(arm, Math.min(remaining, MaxTimerMs));
    };
    arm();

    // Timers don't run reliably while the app is in the background, so check again on return.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isExpired(expiresAt)) signOut();
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [expiresAt, signOut]);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user: session?.user ?? null,
      accessToken: session?.accessToken ?? null,
      signIn,
      signOut,
    }),
    [status, session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
