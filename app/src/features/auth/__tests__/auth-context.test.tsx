import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import type { AuthResponse } from '@/types/api';

const response: AuthResponse = {
  accessToken: 'token-1',
  expiresAt: '2026-10-30T20:00:00Z',
  user: { id: 'u1', email: 'ann@example.com', displayName: 'Ann' },
};

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe('AuthProvider', () => {
  it('starts as a guest', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
  });

  it('signIn stores the account and token', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });

    await act(async () => result.current.signIn(response));

    expect(result.current.user).toEqual(response.user);
    expect(result.current.accessToken).toBe('token-1');
  });

  it('signOut goes back to being a guest', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await act(async () => result.current.signIn(response));

    await act(async () => result.current.signOut());

    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
  });

  it('a second sign in replaces the first', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await act(async () => result.current.signIn(response));

    await act(async () =>
      result.current.signIn({
        ...response,
        accessToken: 'token-2',
        user: { ...response.user, displayName: 'Bea' },
      }),
    );

    expect(result.current.accessToken).toBe('token-2');
    expect(result.current.user?.displayName).toBe('Bea');
  });

  it('useAuth outside the provider is a clear error', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(renderHook(() => useAuth())).rejects.toThrow(/inside <AuthProvider>/);

    consoleError.mockRestore();
  });
});
