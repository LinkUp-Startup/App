import { act, render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import { listFriends } from '@/api/friends';
import { sendToFriend } from '@/features/plans/share-plan';
import { IosDismissMs, ShareSheet } from '@/features/plans/share-sheet';
import type { SavedPlan } from '@/storage/saved-plans';

import { tapasPlan } from './fixtures/plans';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/api/friends');
jest.mock('@/features/plans/share-plan', () => ({ sendToFriend: jest.fn() }));

const plan: SavedPlan = { ...tapasPlan, savedAt: '2026-11-01T10:00:00.000Z', synced: true };
const bob = { userId: 'u2', displayName: 'Bob', since: '2026-11-01T18:00:00Z' };
const carla = { userId: 'u3', displayName: 'Carla', since: '2026-11-02T18:00:00Z' };
const none = { friends: [], incoming: [], outgoing: [] };

async function open(props: { onShareLink?: () => void; onClose?: () => void } = {}) {
  const onShareLink = props.onShareLink ?? jest.fn();
  const onClose = props.onClose ?? jest.fn();
  await render(
    <ShareSheet
      plan={plan}
      accessToken="token-1"
      visible
      onShareLink={onShareLink}
      onClose={onClose}
    />,
  );
  return { onShareLink, onClose };
}

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe('ShareSheet', () => {
  it('lists only your friends, each with a send button', async () => {
    jest.mocked(listFriends).mockResolvedValue({ ...none, friends: [bob, carla] });

    await open();

    expect(screen.getByText('Share Tapas and drinks')).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Send to Bob' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Send to Carla' })).toBeOnTheScreen();
    expect(listFriends).toHaveBeenCalledWith('token-1', expect.any(AbortSignal));
  });

  it('does not load friends while closed', async () => {
    await render(
      <ShareSheet
        plan={plan}
        accessToken="token-1"
        visible={false}
        onShareLink={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(listFriends).not.toHaveBeenCalled();
  });

  it('sends the plan to the friend picked and says so', async () => {
    jest.mocked(listFriends).mockResolvedValue({ ...none, friends: [bob, carla] });
    jest.mocked(sendToFriend).mockResolvedValue(undefined);
    const user = userEvent.setup();
    await open();

    await user.press(await screen.findByRole('button', { name: 'Send to Bob' }));

    expect(sendToFriend).toHaveBeenCalledWith(plan, 'u2', 'token-1');
    expect(await screen.findByRole('button', { name: 'Sent to Bob' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send to Carla' })).toBeEnabled();
  });

  it('shows that it is sending', async () => {
    jest.mocked(listFriends).mockResolvedValue({ ...none, friends: [bob] });
    jest.mocked(sendToFriend).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    await open();

    await user.press(await screen.findByRole('button', { name: 'Send to Bob' }));

    expect(screen.getByText('Sending…')).toBeOnTheScreen();
  });

  it('explains when you are no longer friends', async () => {
    jest.mocked(listFriends).mockResolvedValue({ ...none, friends: [bob] });
    jest.mocked(sendToFriend).mockRejectedValue(new ApiError(403, ''));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    await open();

    await user.press(await screen.findByRole('button', { name: 'Send to Bob' }));

    expect(await screen.findByText('You and Bob are no longer friends.')).toBeOnTheScreen();
  });

  it('lets you try again when sending fails', async () => {
    jest.mocked(listFriends).mockResolvedValue({ ...none, friends: [bob] });
    jest
      .mocked(sendToFriend)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    await open();

    await user.press(await screen.findByRole('button', { name: 'Send to Bob' }));
    expect(await screen.findByText(/Couldn't send it to Bob/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Send to Bob' }));

    expect(await screen.findByRole('button', { name: 'Sent to Bob' })).toBeOnTheScreen();
  });

  it('suggests adding friends when you have none', async () => {
    jest.mocked(listFriends).mockResolvedValue(none);
    const user = userEvent.setup();
    const { onClose } = await open();

    expect(await screen.findByText(/haven.t added any friends yet/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Add friends' }));

    expect(onClose).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/friends');
  });

  it('shows why the friends could not be loaded, and loads them again', async () => {
    jest
      .mocked(listFriends)
      .mockRejectedValueOnce(new ApiError(401, ''))
      .mockResolvedValueOnce({ ...none, friends: [bob] });
    const user = userEvent.setup();
    await open();

    expect(await screen.findByText(/session has expired/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('button', { name: 'Send to Bob' })).toBeOnTheScreen();
  });

  it('closes, then shares the link once the popup is gone', async () => {
    jest.mocked(listFriends).mockResolvedValue(none);
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { onShareLink, onClose } = await open();

    await user.press(screen.getByRole('button', { name: 'Share a link' }));

    expect(onClose).toHaveBeenCalled();
    expect(onShareLink).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(IosDismissMs);
    });
    expect(onShareLink).toHaveBeenCalled();
  });

  it('closes with Done', async () => {
    jest.mocked(listFriends).mockResolvedValue(none);
    const user = userEvent.setup();
    const { onClose, onShareLink } = await open();

    await user.press(screen.getByRole('button', { name: 'Done' }));

    expect(onClose).toHaveBeenCalled();
    expect(onShareLink).not.toHaveBeenCalled();
  });
});
