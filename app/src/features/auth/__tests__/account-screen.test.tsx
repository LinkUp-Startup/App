import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useEffect } from 'react';

import AccountScreen from '@/app/(tabs)/account';
import { AuthProvider, useAuth } from '@/features/auth/auth-context';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn() },
}));

/** Signs Ann in as soon as it mounts, standing in for a completed login. */
function SignedInAsAnn() {
  const { signIn } = useAuth();
  useEffect(() => {
    signIn({
      accessToken: 'token-1',
      expiresAt: '2026-10-30T20:00:00Z',
      user: { id: 'u1', email: 'ann@example.com', displayName: 'Ann' },
    });
  }, [signIn]);
  return null;
}

afterEach(() => jest.mocked(router.push).mockReset());

describe('AccountScreen', () => {
  it('tells a guest that everything works without an account', async () => {
    await render(
      <AuthProvider>
        <AccountScreen />
      </AuthProvider>,
    );

    expect(screen.getByText(/everything works without an account/i)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeOnTheScreen();
  });

  it('opens the login and register screens', async () => {
    const user = userEvent.setup();
    await render(
      <AuthProvider>
        <AccountScreen />
      </AuthProvider>,
    );

    await user.press(screen.getByRole('button', { name: 'Log in' }));
    await user.press(screen.getByRole('button', { name: 'Create account' }));

    expect(router.push).toHaveBeenNthCalledWith(1, '/login');
    expect(router.push).toHaveBeenNthCalledWith(2, '/register');
  });

  it('shows who is signed in instead of the login buttons', async () => {
    await render(
      <AuthProvider>
        <SignedInAsAnn />
        <AccountScreen />
      </AuthProvider>,
    );

    expect(await screen.findByText('Signed in as Ann')).toBeOnTheScreen();
    expect(screen.getByText('ann@example.com')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Log in' })).not.toBeOnTheScreen();
  });

  it('logging out goes back to the guest view', async () => {
    const user = userEvent.setup();
    await render(
      <AuthProvider>
        <SignedInAsAnn />
        <AccountScreen />
      </AuthProvider>,
    );

    await user.press(await screen.findByRole('button', { name: 'Log out' }));

    expect(screen.getByText(/everything works without an account/i)).toBeOnTheScreen();
    expect(screen.queryByText('Signed in as Ann')).not.toBeOnTheScreen();
  });
});
