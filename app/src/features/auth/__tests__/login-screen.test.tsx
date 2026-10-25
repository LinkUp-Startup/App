import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Text } from 'react-native';

import { login } from '@/api/auth';
import { ApiError, NetworkError } from '@/api/client';
import LoginScreen from '@/app/login';
import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import type { AuthResponse } from '@/types/api';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), dismissTo: jest.fn() },
}));
jest.mock('@/api/auth', () => ({ login: jest.fn(), register: jest.fn() }));

const response: AuthResponse = {
  accessToken: 'token-1',
  expiresAt: '2026-10-30T20:00:00Z',
  user: { id: 'u1', email: 'ann@example.com', displayName: 'Ann' },
};

/** Shows who the app thinks is signed in, so tests can see the effect of a login. */
function WhoAmI() {
  const { user } = useAuth();
  return <Text>{user ? `signed in as ${user.email}` : 'guest'}</Text>;
}

async function renderScreen() {
  const user = userEvent.setup();
  await render(
    <AuthProvider>
      <LoginScreen />
      <WhoAmI />
    </AuthProvider>,
  );
  return user;
}

const logInButton = () => screen.getByRole('button', { name: 'Log in' });

afterEach(() => {
  jest.mocked(login).mockReset();
  jest.mocked(router.dismissTo).mockReset();
  jest.mocked(router.replace).mockReset();
});

describe('LoginScreen', () => {
  it('shows no errors before the first attempt', async () => {
    await renderScreen();

    expect(screen.queryByText('Enter your email.')).not.toBeOnTheScreen();
    expect(screen.queryByText('Enter your password.')).not.toBeOnTheScreen();
  });

  it('shows field errors instead of calling the API when the form is empty', async () => {
    const user = await renderScreen();

    await user.press(logInButton());

    expect(screen.getByText('Enter your email.')).toBeOnTheScreen();
    expect(screen.getByText('Enter your password.')).toBeOnTheScreen();
    expect(login).not.toHaveBeenCalled();
  });

  it('rejects an email that is not an email', async () => {
    const user = await renderScreen();

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await user.press(logInButton());

    expect(screen.getByText('Enter a valid email address.')).toBeOnTheScreen();
    expect(login).not.toHaveBeenCalled();
  });

  it('clears a field error as soon as it is fixed', async () => {
    const user = await renderScreen();
    await user.press(logInButton());
    expect(screen.getByText('Enter your email.')).toBeOnTheScreen();

    await user.type(screen.getByLabelText('Email'), 'ann@example.com');

    expect(screen.queryByText('Enter your email.')).not.toBeOnTheScreen();
  });

  it('logs in, signs the user in and goes to the Account tab', async () => {
    jest.mocked(login).mockResolvedValue(response);
    const user = await renderScreen();

    await user.type(screen.getByLabelText('Email'), '  ann@example.com ');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await user.press(logInButton());

    expect(login).toHaveBeenCalledWith({
      email: 'ann@example.com',
      password: 'correct-horse-battery',
    });
    expect(await screen.findByText('signed in as ann@example.com')).toBeOnTheScreen();
    expect(router.dismissTo).toHaveBeenCalledTimes(1);
    expect(router.dismissTo).toHaveBeenCalledWith('/account');
  });

  it('keeps the password masked', async () => {
    await renderScreen();

    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  });

  it('says "wrong email or password" on a 401 and stays on the screen', async () => {
    jest.mocked(login).mockRejectedValue(new ApiError(401, 'Unauthorized'));
    const user = await renderScreen();

    await user.type(screen.getByLabelText('Email'), 'ann@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.press(logInButton());

    expect(await screen.findByText('Wrong email or password.')).toBeOnTheScreen();
    expect(screen.getByText('guest')).toBeOnTheScreen();
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('explains when the server cannot be reached, and lets the user try again', async () => {
    jest
      .mocked(login)
      .mockRejectedValueOnce(new NetworkError('offline'))
      .mockResolvedValueOnce(response);
    const user = await renderScreen();
    await user.type(screen.getByLabelText('Email'), 'ann@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');

    await user.press(logInButton());
    expect(await screen.findByText(/can't reach linkup/i)).toBeOnTheScreen();

    await user.press(logInButton());
    expect(await screen.findByText('signed in as ann@example.com')).toBeOnTheScreen();
    expect(screen.queryByText(/can't reach linkup/i)).not.toBeOnTheScreen();
  });

  it('blames the server on a 5xx', async () => {
    jest.mocked(login).mockRejectedValue(new ApiError(500, ''));
    const user = await renderScreen();
    await user.type(screen.getByLabelText('Email'), 'ann@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');

    await user.press(logInButton());

    expect(await screen.findByText(/something went wrong on our side/i)).toBeOnTheScreen();
  });

  it('clears the server error when the user edits a field', async () => {
    jest.mocked(login).mockRejectedValue(new ApiError(401, ''));
    const user = await renderScreen();
    await user.type(screen.getByLabelText('Email'), 'ann@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.press(logInButton());
    expect(await screen.findByText('Wrong email or password.')).toBeOnTheScreen();

    await user.type(screen.getByLabelText('Password'), '2');

    expect(screen.queryByText('Wrong email or password.')).not.toBeOnTheScreen();
  });

  it('disables the buttons while the request is running and sends it only once', async () => {
    let finish: (value: AuthResponse) => void = () => {};
    jest.mocked(login).mockReturnValue(new Promise<AuthResponse>((resolve) => (finish = resolve)));
    const user = await renderScreen();
    await user.type(screen.getByLabelText('Email'), 'ann@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');

    await user.press(logInButton());

    const busy = screen.getByRole('button', { name: 'Logging in…' });
    expect(busy).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create an account' })).toBeDisabled();
    await user.press(busy);
    expect(login).toHaveBeenCalledTimes(1);

    finish(response);
    expect(await screen.findByText('signed in as ann@example.com')).toBeOnTheScreen();
  });

  it('offers to create an account instead', async () => {
    const user = await renderScreen();

    await user.press(screen.getByRole('button', { name: 'Create an account' }));

    expect(router.replace).toHaveBeenCalledWith('/register');
  });
});
