import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { AuthProvider, useAuth } from '@/features/auth/auth-context';

// loadSession handles storage errors itself; this covers anything else going wrong while restoring.
jest.mock('@/storage/session', () => ({
  ...jest.requireActual('@/storage/session'),
  loadSession: jest.fn().mockRejectedValue(new Error('unexpected')),
}));
jest.mock('@/api/auth', () => ({ getMe: jest.fn() }));

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

it('starts as a guest when restoring the session fails unexpectedly', async () => {
  const { result } = await renderHook(() => useAuth(), { wrapper });

  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current.user).toBeNull();
});
