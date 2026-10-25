import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { AuthResponse, User } from '@/types/api';

type AuthState = {
  /** The signed-in account, or null when using the app as a guest. */
  user: User | null;
  accessToken: string | null;
  signIn: (response: AuthResponse) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * Who is signed in. Kept in memory only for now: the session is lost when the app closes.
 * Storing it securely on the device and restoring it is issue #86.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthResponse | null>(null);

  const signIn = useCallback((response: AuthResponse) => setSession(response), []);
  const signOut = useCallback(() => setSession(null), []);

  const value = useMemo<AuthState>(
    () => ({
      user: session?.user ?? null,
      accessToken: session?.accessToken ?? null,
      signIn,
      signOut,
    }),
    [session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
