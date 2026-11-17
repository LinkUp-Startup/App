import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import { acceptFriendRequest, declineFriendRequest, listFriends } from '@/api/friends';
import FriendsScreen from '@/app/my-friends';
import type { FriendsResponse } from '@/types/api';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  // Run the focus effect once on mount, like a screen that has just been shown
  useFocusEffect: (effect: () => void | (() => void)) =>
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));
jest.mock('@/api/friends');
const mockAuth = { accessToken: 'token-1' as string | null };
jest.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ accessToken: mockAuth.accessToken }),
}));

const none: FriendsResponse = { friends: [], incoming: [], outgoing: [] };
const fromBob = { userId: 'u2', displayName: 'Bob', sentAt: '2026-11-15T20:00:00Z' };
const toCarla = { userId: 'u3', displayName: 'Carla', sentAt: '2026-11-15T21:00:00Z' };
const dani = { userId: 'u4', displayName: 'Dani', since: '2026-11-01T18:00:00Z' };

afterEach(() => {
  jest.clearAllMocks();
  mockAuth.accessToken = 'token-1';
});

describe('FriendsScreen', () => {
  it('shows an empty state when there are no friends', async () => {
    jest.mocked(listFriends).mockResolvedValue(none);

    await render(<FriendsScreen />);

    expect(await screen.findByText(/haven.t added any friends yet/)).toBeOnTheScreen();
    expect(listFriends).toHaveBeenCalledWith('token-1', expect.any(AbortSignal));
    expect(screen.queryByText('Friend requests')).not.toBeOnTheScreen();
    expect(screen.queryByText('Sent requests')).not.toBeOnTheScreen();
  });

  it('lists friends, received requests and sent requests', async () => {
    jest
      .mocked(listFriends)
      .mockResolvedValue({ friends: [dani], incoming: [fromBob], outgoing: [toCarla] });

    await render(<FriendsScreen />);

    expect(await screen.findByText('Dani')).toBeOnTheScreen();
    expect(screen.getByText('Bob')).toBeOnTheScreen();
    expect(screen.getByText('Carla')).toBeOnTheScreen();
    expect(screen.getByText('Waiting for an answer')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Accept friend request from Bob' }),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/haven.t added any friends yet/)).not.toBeOnTheScreen();
  });

  it('accepts a request and shows the new friend', async () => {
    jest
      .mocked(listFriends)
      .mockResolvedValueOnce({ ...none, incoming: [fromBob] })
      .mockResolvedValueOnce({ ...none, friends: [{ ...fromBob, since: fromBob.sentAt }] });
    jest.mocked(acceptFriendRequest).mockResolvedValue(undefined);
    const user = userEvent.setup();
    await render(<FriendsScreen />);

    await user.press(await screen.findByRole('button', { name: 'Accept friend request from Bob' }));

    expect(acceptFriendRequest).toHaveBeenCalledWith('token-1', 'u2');
    await waitFor(() => expect(screen.queryByText('Friend requests')).not.toBeOnTheScreen());
    expect(screen.getByText('Bob')).toBeOnTheScreen();
  });

  it('declines a request', async () => {
    jest
      .mocked(listFriends)
      .mockResolvedValueOnce({ ...none, incoming: [fromBob] })
      .mockResolvedValueOnce(none);
    jest.mocked(declineFriendRequest).mockResolvedValue(undefined);
    const user = userEvent.setup();
    await render(<FriendsScreen />);

    await user.press(
      await screen.findByRole('button', { name: 'Decline friend request from Bob' }),
    );

    expect(declineFriendRequest).toHaveBeenCalledWith('token-1', 'u2');
    expect(acceptFriendRequest).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Bob')).not.toBeOnTheScreen());
  });

  it('explains a request that is no longer pending and reloads', async () => {
    jest
      .mocked(listFriends)
      .mockResolvedValueOnce({ ...none, incoming: [fromBob] })
      .mockResolvedValueOnce(none);
    jest.mocked(acceptFriendRequest).mockRejectedValue(new ApiError(404, ''));
    const user = userEvent.setup();
    await render(<FriendsScreen />);

    await user.press(await screen.findByRole('button', { name: 'Accept friend request from Bob' }));

    expect(await screen.findByText('This request is no longer pending.')).toBeOnTheScreen();
    expect(listFriends).toHaveBeenCalledTimes(2);
  });

  it('explains a failed load and tries again', async () => {
    jest
      .mocked(listFriends)
      .mockRejectedValueOnce(new ApiError(401, ''))
      .mockResolvedValueOnce({ ...none, friends: [dani] });
    const user = userEvent.setup();
    await render(<FriendsScreen />);

    expect(await screen.findByText(/session has expired/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Dani')).toBeOnTheScreen();
    expect(screen.queryByText(/session has expired/)).not.toBeOnTheScreen();
  });

  it('shows Loading… until the list arrives', async () => {
    let finish: (value: FriendsResponse) => void = () => {};
    jest.mocked(listFriends).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await render(<FriendsScreen />);

    expect(screen.getByText('Loading…')).toBeOnTheScreen();
    finish(none);

    expect(await screen.findByText(/haven.t added any friends yet/)).toBeOnTheScreen();
    expect(screen.queryByText('Loading…')).not.toBeOnTheScreen();
  });

  it('disables both buttons of a request while it is being answered', async () => {
    let finish: () => void = () => {};
    jest
      .mocked(listFriends)
      .mockResolvedValueOnce({ ...none, incoming: [fromBob] })
      .mockResolvedValueOnce(none);
    jest
      .mocked(acceptFriendRequest)
      .mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    await render(<FriendsScreen />);

    await user.press(await screen.findByRole('button', { name: 'Accept friend request from Bob' }));

    expect(screen.getByRole('button', { name: 'Accept friend request from Bob' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decline friend request from Bob' })).toBeDisabled();
    finish();
    await waitFor(() => expect(screen.queryByText('Bob')).not.toBeOnTheScreen());
  });

  it('explains other failures when answering and still reloads', async () => {
    jest
      .mocked(listFriends)
      .mockResolvedValueOnce({ ...none, incoming: [fromBob] })
      .mockResolvedValueOnce({ ...none, incoming: [fromBob] });
    jest.mocked(declineFriendRequest).mockRejectedValue(new ApiError(500, ''));
    const user = userEvent.setup();
    await render(<FriendsScreen />);

    await user.press(
      await screen.findByRole('button', { name: 'Decline friend request from Bob' }),
    );

    expect(await screen.findByText(/went wrong on our side/)).toBeOnTheScreen();
    await waitFor(() => expect(listFriends).toHaveBeenCalledTimes(2));
    // The request is still there and can be answered again
    expect(screen.getByRole('button', { name: 'Decline friend request from Bob' })).toBeEnabled();
  });

  it('clears an earlier answer error on the next answer', async () => {
    jest.mocked(listFriends).mockResolvedValue({ ...none, incoming: [fromBob] });
    jest
      .mocked(acceptFriendRequest)
      .mockRejectedValueOnce(new ApiError(500, ''))
      .mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    await render(<FriendsScreen />);

    await user.press(await screen.findByRole('button', { name: 'Accept friend request from Bob' }));
    expect(await screen.findByText(/went wrong on our side/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Accept friend request from Bob' }));

    await waitFor(() => expect(acceptFriendRequest).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText(/went wrong on our side/)).not.toBeOnTheScreen());
  });

  it('stops loading when the screen is left, without showing an error', async () => {
    jest
      .mocked(listFriends)
      .mockImplementation(
        (_token, signal) =>
          new Promise((_resolve, reject) =>
            signal?.addEventListener('abort', () => reject(new Error('aborted'))),
          ),
      );
    await render(<FriendsScreen />);
    const signal = jest.mocked(listFriends).mock.calls[0][1];

    await screen.unmount();

    expect(signal?.aborted).toBe(true);
  });

  it('opens the add friends screen', async () => {
    jest.mocked(listFriends).mockResolvedValue(none);
    const user = userEvent.setup();
    await render(<FriendsScreen />);

    await user.press(screen.getByRole('button', { name: 'Add friends' }));

    expect(router.push).toHaveBeenCalledWith('/friends');
  });

  it('asks a guest to log in', async () => {
    mockAuth.accessToken = null;
    const user = userEvent.setup();
    await render(<FriendsScreen />);

    await user.press(screen.getByRole('button', { name: 'Log in' }));

    expect(router.push).toHaveBeenCalledWith('/login');
    expect(listFriends).not.toHaveBeenCalled();
  });
});
