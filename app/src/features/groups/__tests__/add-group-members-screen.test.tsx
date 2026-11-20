import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import { listFriends } from '@/api/friends';
import { addGroupMember, getGroup } from '@/api/groups';
import AddGroupMembersScreen from '@/app/add-group-members';
import type { Friend } from '@/types/api';

import { bob, carla, crew } from './fixtures/groups';

const mockParams: { groupId?: string } = { groupId: 'g1' };
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => mockParams,
  // Run the focus effect once on mount, like a screen that has just been shown
  useFocusEffect: (effect: () => void | (() => void)) =>
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));
jest.mock('@/api/groups');
jest.mock('@/api/friends');
const mockAuth = { accessToken: 'token-1' as string | null };
jest.mock('@/features/auth/auth-context', () => ({ useAuth: () => mockAuth }));

const dani: Friend = { userId: 'u4', displayName: 'Dani', since: '2026-11-03T18:00:00Z' };

// Ann (u1) owns the group with Bob (u2); Carla and Dani are her friends who are not in it
function show(friends: Friend[] = [bob, carla, dani]) {
  jest.mocked(getGroup).mockResolvedValue(crew);
  jest.mocked(listFriends).mockResolvedValue({ friends, incoming: [], outgoing: [] });
}

const add = (name: string) => ({ name: `Add ${name} to the group` });

afterEach(() => {
  jest.resetAllMocks();
  mockAuth.accessToken = 'token-1';
  mockParams.groupId = 'g1';
});

describe('AddGroupMembersScreen', () => {
  it('asks to log in without an account', async () => {
    mockAuth.accessToken = null;
    const user = userEvent.setup();
    await render(<AddGroupMembersScreen />);

    await user.press(screen.getByRole('button', { name: 'Log in' }));

    expect(router.push).toHaveBeenCalledWith('/login');
    expect(getGroup).not.toHaveBeenCalled();
  });

  it('sends you to your groups when no group is open', async () => {
    mockParams.groupId = undefined;
    const user = userEvent.setup();
    await render(<AddGroupMembersScreen />);

    await user.press(screen.getByRole('button', { name: 'Go to your groups' }));

    expect(router.replace).toHaveBeenCalledWith('/groups');
  });

  it('says so, and lets you try again, when the group cannot be loaded', async () => {
    jest.mocked(listFriends).mockResolvedValue({ friends: [carla], incoming: [], outgoing: [] });
    jest.mocked(getGroup).mockRejectedValueOnce(new ApiError(404, ''));
    jest.mocked(getGroup).mockResolvedValue(crew);
    const user = userEvent.setup();
    await render(<AddGroupMembersScreen />);

    expect(await screen.findByText(/no longer exists/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Carla')).toBeOnTheScreen();
    expect(screen.queryByText(/no longer exists/)).toBeNull();
  });

  it('lists only the friends who are not in the group yet', async () => {
    show();
    await render(<AddGroupMembersScreen />);

    expect(await screen.findByText('Carla')).toBeOnTheScreen();
    expect(screen.getByText('Dani')).toBeOnTheScreen();
    // Bob is a friend, but already a member
    expect(screen.queryByText('Bob')).toBeNull();
    expect(screen.getByText('Friday crew')).toBeOnTheScreen();
    expect(screen.getByText('2 members. Any member can add their own friends.')).toBeOnTheScreen();
    expect(getGroup).toHaveBeenCalledWith('token-1', 'g1', expect.any(AbortSignal));
    expect(listFriends).toHaveBeenCalledWith('token-1', expect.any(AbortSignal));
  });

  it('adds a friend and shows them as added, with the new member count', async () => {
    show();
    jest.mocked(addGroupMember).mockResolvedValue(undefined);
    const user = userEvent.setup();
    await render(<AddGroupMembersScreen />);

    await user.press(await screen.findByRole('button', add('Carla')));

    expect(addGroupMember).toHaveBeenCalledWith('token-1', 'g1', 'u3');
    expect(await screen.findByText('Added')).toBeOnTheScreen();
    expect(screen.getByText('3 members. Any member can add their own friends.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', add('Carla'))).toBeNull();
    // The others can still be added, and each one only once
    expect(screen.getByRole('button', add('Dani'))).toBeEnabled();
  });

  it('keeps the other buttons from being pressed while a friend is being added', async () => {
    show();
    let finish!: () => void;
    jest.mocked(addGroupMember).mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const user = userEvent.setup();
    await render(<AddGroupMembersScreen />);

    await user.press(await screen.findByRole('button', add('Carla')));

    expect(screen.getByText('Adding…')).toBeOnTheScreen();
    expect(screen.getByRole('button', add('Dani'))).toBeDisabled();
    finish();
    expect(await screen.findByText('Added')).toBeOnTheScreen();
    expect(screen.getByRole('button', add('Dani'))).toBeEnabled();
  });

  it.each([
    [409, 'A group can have up to 8 members.'],
    [403, 'You can only add your friends to a group.'],
  ])('shows why adding failed (%s) and keeps the friend to try again', async (status, title) => {
    show();
    jest.mocked(addGroupMember).mockRejectedValue(new ApiError(status, JSON.stringify({ title })));
    const user = userEvent.setup();
    await render(<AddGroupMembersScreen />);

    await user.press(await screen.findByRole('button', add('Carla')));

    expect(await screen.findByText(title)).toBeOnTheScreen();
    expect(screen.queryByText('Added')).toBeNull();
    expect(screen.getByRole('button', add('Carla'))).toBeEnabled();
    expect(screen.getByText('2 members. Any member can add their own friends.')).toBeOnTheScreen();
  });

  it('clears the error of a failed add when the next one works', async () => {
    show();
    jest
      .mocked(addGroupMember)
      .mockRejectedValueOnce(new ApiError(409, JSON.stringify({ title: 'Group is full.' })))
      .mockResolvedValue(undefined);
    const user = userEvent.setup();
    await render(<AddGroupMembersScreen />);

    await user.press(await screen.findByRole('button', add('Carla')));
    expect(await screen.findByText('Group is full.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', add('Carla')));

    expect(await screen.findByText('Added')).toBeOnTheScreen();
    expect(screen.queryByText('Group is full.')).toBeNull();
  });

  it('offers to find friends when you have none', async () => {
    show([]);
    const user = userEvent.setup();
    await render(<AddGroupMembersScreen />);

    expect(await screen.findByText(/don.t have friends on LinkUp yet/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Find friends' }));

    expect(router.push).toHaveBeenCalledWith('/friends');
  });

  it('says when all your friends are already in the group', async () => {
    show([bob]);
    await render(<AddGroupMembersScreen />);

    expect(
      await screen.findByText('All your friends are already in this group.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Add .* to the group$/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Find friends' })).toBeOnTheScreen();
  });

  it('goes back to the group when you are done', async () => {
    show();
    const user = userEvent.setup();
    await render(<AddGroupMembersScreen />);
    await screen.findByText('Carla');

    await user.press(screen.getByRole('button', { name: 'Done' }));

    expect(router.back).toHaveBeenCalled();
  });
});
