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

  it('searches from the keyboard, with the text trimmed', async () => {
    jest.mocked(searchUsers).mockResolvedValue({ users: [ann] });
    const user = userEvent.setup();
    await render(<AddFriendsScreen />);

    await user.type(screen.getByLabelText('Search by name'), '  ann  ', { submitEditing: true });

    expect(await screen.findByText('Ann')).toBeOnTheScreen();
    expect(searchUsers).toHaveBeenCalledWith('token-1', 'ann', expect.any(AbortSignal));
  });

  it('does not search from the keyboard with too little text', async () => {
    const user = userEvent.setup();
    await render(<AddFriendsScreen />);

    await user.type(screen.getByLabelText('Search by name'), 'a', { submitEditing: true });

    expect(searchUsers).not.toHaveBeenCalled();
  });

  it('shows Searching… and blocks a second search while one is running', async () => {
    let finish: (value: { users: UserSearchResult[] }) => void = () => {};
    jest.mocked(searchUsers).mockReturnValue(new Promise((resolve) => (finish = resolve)));

    await searchFor('ann');

    expect(screen.getByRole('button', { name: 'Searching…' })).toBeDisabled();
    finish({ users: [ann] });
    expect(await screen.findByRole('button', { name: 'Search' })).toBeEnabled();
  });

  it('a newer search replaces a running one without showing its failure', async () => {
    jest
      .mocked(searchUsers)
      // 1. The first search shows Ann
      .mockResolvedValueOnce({ users: [ann] })
      // 2. A second search hangs until it is aborted, then fails like fetch does
      .mockImplementationOnce(
        (_token, _query, signal) =>
          new Promise((_resolve, reject) =>
            signal?.addEventListener('abort', () => reject(new Error('aborted'))),
          ),
      )
      // 3. The search the conflict starts shows the real state
      .mockResolvedValueOnce({ users: [{ ...ann, relation: 'friends' }] });
    jest.mocked(sendFriendRequest).mockRejectedValue(new ApiError(409, ''));

    const user = await searchFor('ann');
    await screen.findByText('Ann');
    await user.type(screen.getByLabelText('Search by name'), 'a');
    await user.press(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByRole('button', { name: 'Searching…' })).toBeDisabled();

    // Ann's row is still there and can be added while the second search runs
    await user.press(screen.getByRole('button', { name: 'Add Ann as a friend' }));

    expect(await screen.findByText('Friends')).toBeOnTheScreen();
    expect(jest.mocked(searchUsers).mock.calls[1][2]?.aborted).toBe(true);
    expect(searchUsers).toHaveBeenLastCalledWith('token-1', 'ann', expect.any(AbortSignal));
    expect(screen.queryByText(/unexpected/)).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled();
  });

  it('explains a failed request and keeps the Add button', async () => {
    jest.mocked(searchUsers).mockResolvedValue({ users: [ann] });
    jest.mocked(sendFriendRequest).mockRejectedValue(new ApiError(404, ''));

    const user = await searchFor('ann');
    await user.press(await screen.findByRole('button', { name: 'Add Ann as a friend' }));

    expect(await screen.findByText('This user no longer exists.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add Ann as a friend' })).toBeEnabled();
    expect(searchUsers).toHaveBeenCalledTimes(1); // Only a conflict searches again
  });

  it('shows Sending… on the row while the request is on its way', async () => {
    let finish: () => void = () => {};
    jest.mocked(searchUsers).mockResolvedValue({ users: [ann] });
    jest
      .mocked(sendFriendRequest)
      .mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));

    const user = await searchFor('ann');
    await user.press(await screen.findByRole('button', { name: 'Add Ann as a friend' }));

    expect(screen.getByRole('button', { name: 'Add Ann as a friend' })).toBeDisabled();
    expect(screen.getByText('Sending…')).toBeOnTheScreen();
    finish();
    expect(await screen.findByText('Request sent')).toBeOnTheScreen();
  });

  it('labels friends and received requests', async () => {
    jest.mocked(searchUsers).mockResolvedValue({
      users: [
        { id: 'u4', displayName: 'Bob', relation: 'friends' },
        { id: 'u5', displayName: 'Carla', relation: 'requestReceived' },
      ],
    });

    await searchFor('an');

    expect(await screen.findByText('Friends')).toBeOnTheScreen();
    expect(screen.getByText('Wants to be your friend')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /as a friend/ })).not.toBeOnTheScreen();
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
