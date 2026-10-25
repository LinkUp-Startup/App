import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Text } from 'react-native';

import { register } from '@/api/auth';
import { ApiError, NetworkError } from '@/api/client';
import RegisterScreen from '@/app/register';
import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import type { AuthResponse } from '@/types/api';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), dismissTo: jest.fn() },
}));
jest.mock('@/api/auth', () => ({ login: jest.fn(), register: jest.fn() }));

const response: AuthResponse = {
  accessToken: 'token-1',
  expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(), // always in the future
  user: { id: 'u1', email: 'ann@example.com', displayName: 'Ann' },
};

function WhoAmI() {
  const { user } = useAuth();
  return <Text>{user ? `signed in as ${user.displayName}` : 'guest'}</Text>;
}

async function renderScreen() {
  const user = userEvent.setup();
  await render(
    <AuthProvider>
      <RegisterScreen />
      <WhoAmI />
    </AuthProvider>,
  );
  return user;
}

async function fillIn(
  user: ReturnType<typeof userEvent.setup>,
  password = 'correct-horse-battery',
) {
  await user.type(screen.getByLabelText('Name'), '  Ann ');
  await user.type(screen.getByLabelText('Email'), ' ann@example.com ');
  await user.type(screen.getByLabelText('Password'), password);
}

const createButton = () => screen.getByRole('button', { name: 'Create account' });

afterEach(() => {
  jest.mocked(register).mockReset();
  jest.mocked(router.dismissTo).mockReset();
  jest.mocked(router.replace).mockReset();
});

describe('RegisterScreen', () => {
  it('tells the user the password rule up front', async () => {
    await renderScreen();

    expect(screen.getByText('At least 8 characters')).toBeOnTheScreen();
  });

  it('shows an error for every missing field instead of calling the API', async () => {
    const user = await renderScreen();

    await user.press(createButton());

    expect(screen.getByText('Enter a name.')).toBeOnTheScreen();
    expect(screen.getByText('Enter your email.')).toBeOnTheScreen();
    expect(screen.getByText('Use at least 8 characters.')).toBeOnTheScreen();
    expect(register).not.toHaveBeenCalled();
  });

  it('rejects a password that is too short', async () => {
    const user = await renderScreen();
    await fillIn(user, 'short');

    await user.press(createButton());

    expect(screen.getByText('Use at least 8 characters.')).toBeOnTheScreen();
    expect(register).not.toHaveBeenCalled();
  });

  it('keeps the password masked', async () => {
    await renderScreen();

    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  });

  it('stops the name at the length the server allows', async () => {
    await renderScreen();

    expect(screen.getByLabelText('Name').props.maxLength).toBe(50);
  });

  it('creates the account with trimmed details, signs the user in and goes to the Account tab', async () => {
    jest.mocked(register).mockResolvedValue(response);
    const user = await renderScreen();
    await fillIn(user);

    await user.press(createButton());

    expect(register).toHaveBeenCalledWith({
      displayName: 'Ann',
      email: 'ann@example.com',
      password: 'correct-horse-battery',
    });
    expect(await screen.findByText('signed in as Ann')).toBeOnTheScreen();
    expect(router.dismissTo).toHaveBeenCalledTimes(1);
    expect(router.dismissTo).toHaveBeenCalledWith('/account');
  });

  it('points to logging in when the email is already registered', async () => {
    jest.mocked(register).mockRejectedValue(new ApiError(409, 'Conflict'));
    const user = await renderScreen();
    await fillIn(user);

    await user.press(createButton());

    expect(await screen.findByText(/already exists.*logging in/i)).toBeOnTheScreen();
    expect(screen.getByText('guest')).toBeOnTheScreen();
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('shows what the server rejected when it answers 400', async () => {
    const body = JSON.stringify({
      errors: { Email: ['The Email field is not a valid e-mail address.'] },
    });
    jest.mocked(register).mockRejectedValue(new ApiError(400, body));
    const user = await renderScreen();
    await fillIn(user);

    await user.press(createButton());

    expect(await screen.findByText(/not a valid e-mail address/i)).toBeOnTheScreen();
  });

  it('explains when the server cannot be reached', async () => {
    jest.mocked(register).mockRejectedValue(new NetworkError('offline'));
    const user = await renderScreen();
    await fillIn(user);

    await user.press(createButton());

    expect(await screen.findByText(/can't reach linkup/i)).toBeOnTheScreen();
  });

  it('disables the buttons while the request is running and sends it only once', async () => {
    let finish: (value: AuthResponse) => void = () => {};
    jest
      .mocked(register)
      .mockReturnValue(new Promise<AuthResponse>((resolve) => (finish = resolve)));
    const user = await renderScreen();
    await fillIn(user);

    await user.press(createButton());

    const busy = screen.getByRole('button', { name: 'Creating account…' });
    expect(busy).toBeDisabled();
    await user.press(busy);
    expect(register).toHaveBeenCalledTimes(1);

    finish(response);
    expect(await screen.findByText('signed in as Ann')).toBeOnTheScreen();
  });

  it('offers to log in instead', async () => {
    const user = await renderScreen();

    await user.press(screen.getByRole('button', { name: 'I already have an account' }));

    expect(router.replace).toHaveBeenCalledWith('/login');
  });
});
