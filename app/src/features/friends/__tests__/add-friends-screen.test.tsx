import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import { searchUsers, sendFriendRequest } from '@/api/friends';
import AddFriendsScreen from '@/app/friends';
import type { UserSearchResult } from '@/types/api';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/api/friends');
const mockAuth = { accessToken: 'token-1' as string | null };
jest.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ accessToken: mockAuth.accessToken }),
}));

const ann: UserSearchResult = { id: 'u2', displayName: 'Ann', relation: 'none' };
const anna: UserSearchResult = { id: 'u3', displayName: 'Anna', relation: 'requestSent' };

afterEach(() => {
  jest.clearAllMocks();
  mockAuth.accessToken = 'token-1';
});

async function searchFor(text: string) {
  const user = userEvent.setup();
  await render(<AddFriendsScreen />);
  await user.type(screen.getByLabelText('Search by name'), text);
  await user.press(screen.getByRole('button', { name: 'Search' }));
  return user;
}

describe('AddFriendsScreen', () => {
  it('needs at least two characters to search', async () => {
    const user = userEvent.setup();
    await render(<AddFriendsScreen />);

    await user.type(screen.getByLabelText('Search by name'), ' a ');

    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
  });

  it('shows the results and which ones already have a request', async () => {
    jest.mocked(searchUsers).mockResolvedValue({ users: [ann, anna] });

    await searchFor('ann');

    expect(await screen.findByText('Ann')).toBeOnTheScreen();
    expect(searchUsers).toHaveBeenCalledWith('token-1', 'ann', expect.any(AbortSignal));
    expect(screen.getByRole('button', { name: 'Add Ann as a friend' })).toBeOnTheScreen();
    expect(screen.getByText('Request sent')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add Anna as a friend' })).not.toBeOnTheScreen();
  });

  it('sends a request and then shows it as sent', async () => {
    jest.mocked(searchUsers).mockResolvedValue({ users: [ann] });
    jest.mocked(sendFriendRequest).mockResolvedValue(undefined);

    const user = await searchFor('ann');
    await user.press(await screen.findByRole('button', { name: 'Add Ann as a friend' }));

    expect(sendFriendRequest).toHaveBeenCalledWith('token-1', 'u2');
    expect(await screen.findByText('Request sent')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add Ann as a friend' })).not.toBeOnTheScreen();
  });

  it('searches again when the request conflicts, to show the real state', async () => {
    jest
      .mocked(searchUsers)
      .mockResolvedValueOnce({ users: [ann] })
      .mockResolvedValueOnce({ users: [{ ...ann, relation: 'requestReceived' }] });
    jest.mocked(sendFriendRequest).mockRejectedValue(new ApiError(409, '{"title":"Conflict"}'));

    const user = await searchFor('ann');
    await user.press(await screen.findByRole('button', { name: 'Add Ann as a friend' }));

    expect(await screen.findByText('Wants to be your friend')).toBeOnTheScreen();
    expect(searchUsers).toHaveBeenCalledTimes(2);
  });

  it('says when no one was found', async () => {
    jest.mocked(searchUsers).mockResolvedValue({ users: [] });

    await searchFor('zz');

    expect(await screen.findByText('No one found for “zz”.')).toBeOnTheScreen();
  });

  it('explains a failed search', async () => {
    jest.mocked(searchUsers).mockRejectedValue(new ApiError(401, ''));

    await searchFor('ann');

    expect(await screen.findByText(/session has expired/)).toBeOnTheScreen();
  });

  it('asks a guest to log in', async () => {
    mockAuth.accessToken = null;
    const user = userEvent.setup();
    await render(<AddFriendsScreen />);

    await user.press(screen.getByRole('button', { name: 'Log in' }));

    expect(router.push).toHaveBeenCalledWith('/login');
    await waitFor(() => expect(searchUsers).not.toHaveBeenCalled());
  });
});
