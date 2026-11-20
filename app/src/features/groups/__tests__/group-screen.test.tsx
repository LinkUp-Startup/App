import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import { getGroup, listGroupPlans, removeGroupMember } from '@/api/groups';
import GroupScreen from '@/app/group/[id]';
import { GroupRefreshIntervalMs } from '@/features/groups/use-group';
import type { Group } from '@/types/api';

import { crew, roundByBob } from './fixtures/groups';

const mockParams: { id?: string } = { id: 'g1' };
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void | (() => void)) =>
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));
jest.mock('@/api/groups');
const mockAuth = {
  accessToken: 'token-1' as string | null,
  user: { id: 'u1' } as { id: string } | null,
};
jest.mock('@/features/auth/auth-context', () => ({ useAuth: () => mockAuth }));

beforeEach(() => {
  jest.mocked(getGroup).mockResolvedValue(crew);
  jest.mocked(listGroupPlans).mockResolvedValue({ rounds: [] });
});

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockParams.id = 'g1';
  mockAuth.accessToken = 'token-1';
  mockAuth.user = { id: 'u1' };
});

describe('GroupScreen', () => {
  it('asks guests to log in', async () => {
    mockAuth.accessToken = null;
    const user = userEvent.setup();
    await render(<GroupScreen />);

    await user.press(screen.getByRole('button', { name: 'Log in' }));

    expect(router.push).toHaveBeenCalledWith('/login');
    expect(getGroup).not.toHaveBeenCalled();
  });

  it('shows loading until the group arrives', async () => {
    jest.mocked(getGroup).mockReturnValue(new Promise(() => {}));

    await render(<GroupScreen />);

    expect(screen.getByText('Loading…')).toBeOnTheScreen();
  });

  it('does nothing without a group id', async () => {
    mockParams.id = undefined;

    await render(<GroupScreen />);

    expect(screen.getByText('Loading…')).toBeOnTheScreen();
    expect(getGroup).not.toHaveBeenCalled();
  });

  it('shows the members with the owner and you marked', async () => {
    await render(<GroupScreen />);

    expect(await screen.findByText('Friday crew')).toBeOnTheScreen();
    expect(screen.getByText('2 members · You own this group')).toBeOnTheScreen();
    expect(screen.getByText('Ann (you)')).toBeOnTheScreen();
    expect(screen.getByText('Bob')).toBeOnTheScreen();
    expect(screen.getByText('Owner')).toBeOnTheScreen();
    expect(getGroup).toHaveBeenCalledWith('token-1', 'g1', expect.any(AbortSignal));
  });

  it('does not say a member owns the group', async () => {
    mockAuth.user = { id: 'u2' };
    jest.mocked(getGroup).mockResolvedValue({ ...crew, myRole: 'member' });

    await render(<GroupScreen />);

    expect(await screen.findByText('2 members')).toBeOnTheScreen();
    expect(screen.getByText('Bob (you)')).toBeOnTheScreen();
  });

  it.each([
    ['the owner', 'u1', 'owner'],
    ['a member', 'u2', 'member'],
  ] as const)('lets %s add friends to the group', async (_who, userId, myRole) => {
    mockAuth.user = { id: userId };
    jest.mocked(getGroup).mockResolvedValue({ ...crew, myRole });
    const user = userEvent.setup();
    await render(<GroupScreen />);

    await user.press(await screen.findByRole('button', { name: 'Add friends to the group' }));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/add-group-members',
      params: { groupId: 'g1' },
    });
  });

  it('says when there are no plans yet', async () => {
    await render(<GroupScreen />);

    expect(await screen.findByText(/No plans yet/)).toBeOnTheScreen();
    expect(listGroupPlans).toHaveBeenCalledWith('token-1', 'g1', expect.any(AbortSignal));
  });

  it('shows every plan of the group with who generated it', async () => {
    jest.mocked(listGroupPlans).mockResolvedValue({ rounds: [roundByBob] });

    await render(<GroupScreen />);

    expect(await screen.findByText('Tapas and drinks')).toBeOnTheScreen();
    expect(screen.getByText('Second plan')).toBeOnTheScreen();
    expect(screen.getByText(/^By Bob · .* · for 2 people$/)).toBeOnTheScreen();
  });

  it('shows plans another member generates while the group is open', async () => {
    jest.useFakeTimers();
    jest
      .mocked(listGroupPlans)
      .mockResolvedValueOnce({ rounds: [] })
      .mockResolvedValue({ rounds: [roundByBob] });
    await render(<GroupScreen />);
    expect(await screen.findByText(/No plans yet/)).toBeOnTheScreen();

    await act(async () => {
      jest.advanceTimersByTime(GroupRefreshIntervalMs);
    });

    expect(await screen.findByText('Tapas and drinks')).toBeOnTheScreen();
  });

  it('stops checking for plans when the screen is left', async () => {
    jest.useFakeTimers();
    const { unmount } = await render(<GroupScreen />);
    expect(await screen.findByText('Friday crew')).toBeOnTheScreen();
    await unmount();

    await act(async () => {
      jest.advanceTimersByTime(GroupRefreshIntervalMs * 3);
    });

    expect(listGroupPlans).toHaveBeenCalledTimes(1);
  });

  it('keeps what is on screen when a background refresh fails', async () => {
    jest.useFakeTimers();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await render(<GroupScreen />);
    expect(await screen.findByText('Friday crew')).toBeOnTheScreen();
    jest.mocked(listGroupPlans).mockRejectedValue(new ApiError(500, ''));

    await act(async () => {
      jest.advanceTimersByTime(GroupRefreshIntervalMs);
    });

    expect(screen.getByText('Friday crew')).toBeOnTheScreen();
    expect(warn).toHaveBeenCalledWith('Could not refresh the group', expect.any(ApiError));
    warn.mockRestore();
  });

  it('explains when the group is gone and loads again', async () => {
    jest.mocked(getGroup).mockRejectedValueOnce(new ApiError(404, ''));
    const user = userEvent.setup();
    await render(<GroupScreen />);

    expect(await screen.findByText(/no longer exists/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Friday crew')).toBeOnTheScreen();
  });

  it('opens the group plan form with the member count', async () => {
    const user = userEvent.setup();
    await render(<GroupScreen />);

    await user.press(await screen.findByRole('button', { name: 'Plan a night together' }));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/group-plan',
      params: { groupId: 'g1', groupSize: '2' },
    });
  });
});

describe('removing members', () => {
  const carlaMember = {
    userId: 'u3',
    displayName: 'Carla',
    role: 'member' as const,
    joinedAt: '2026-11-10T18:00:00Z',
  };
  const threeOfThem: Group = { ...crew, members: [...crew.members, carlaMember] };
  const remove = (name: string) => ({ name: `Remove ${name} from the group` });

  it('lets the owner remove others, but not themselves', async () => {
    await render(<GroupScreen />);

    expect(await screen.findByRole('button', remove('Bob'))).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Remove Ann/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Remove .* from the group$/ })).toHaveLength(1);
  });

  it('shows no remove button to a member who is not the owner', async () => {
    mockAuth.user = { id: 'u2' };
    jest.mocked(getGroup).mockResolvedValue({ ...crew, myRole: 'member' });
    await render(<GroupScreen />);

    await screen.findByText('Bob (you)');

    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull();
  });

  it('asks to confirm first and removes nobody until it is confirmed', async () => {
    const user = userEvent.setup();
    await render(<GroupScreen />);

    await user.press(await screen.findByRole('button', remove('Bob')));

    expect(screen.getByText('Remove Bob from the group?')).toBeOnTheScreen();
    expect(screen.getByText(/You can add them back later/)).toBeOnTheScreen();
    expect(removeGroupMember).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', remove('Bob'))).toBeNull();
  });

  it('keeps the member when the owner changes their mind', async () => {
    const user = userEvent.setup();
    await render(<GroupScreen />);

    await user.press(await screen.findByRole('button', remove('Bob')));
    await user.press(screen.getByRole('button', { name: 'Keep Bob in the group' }));

    expect(removeGroupMember).not.toHaveBeenCalled();
    expect(screen.queryByText('Remove Bob from the group?')).toBeNull();
    expect(screen.getByRole('button', remove('Bob'))).toBeOnTheScreen();
  });

  it('removes the member once confirmed and shows the group without them', async () => {
    jest
      .mocked(getGroup)
      .mockResolvedValueOnce(crew)
      .mockResolvedValue({
        ...crew,
        members: [crew.members[0]],
      });
    jest.mocked(removeGroupMember).mockResolvedValue(undefined);
    const user = userEvent.setup();
    await render(<GroupScreen />);

    await user.press(await screen.findByRole('button', remove('Bob')));
    await user.press(screen.getByRole('button', { name: 'Yes, remove Bob' }));

    expect(removeGroupMember).toHaveBeenCalledWith('token-1', 'g1', 'u2');
    expect(await screen.findByText('1 member · You own this group')).toBeOnTheScreen();
    expect(screen.queryByText('Bob')).toBeNull();
    expect(screen.queryByText('Remove Bob from the group?')).toBeNull();
    // The group is still shown while it reloads: no flash of "Loading…" in between
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('shows that the removal is on its way and does not remove twice', async () => {
    let finish!: () => void;
    jest.mocked(removeGroupMember).mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const user = userEvent.setup();
    await render(<GroupScreen />);
    await user.press(await screen.findByRole('button', remove('Bob')));

    await user.press(screen.getByRole('button', { name: 'Yes, remove Bob' }));

    expect(screen.getByText('Removing…')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Yes, remove Bob' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep Bob in the group' })).toBeDisabled();
    finish();
    await waitFor(() => expect(screen.queryByText('Removing…')).toBeNull());
    expect(removeGroupMember).toHaveBeenCalledTimes(1);
  });

  it('only asks about one member at a time', async () => {
    jest.mocked(getGroup).mockResolvedValue(threeOfThem);
    const user = userEvent.setup();
    await render(<GroupScreen />);

    await user.press(await screen.findByRole('button', remove('Bob')));
    await user.press(screen.getByRole('button', remove('Carla')));

    expect(screen.getByText('Remove Carla from the group?')).toBeOnTheScreen();
    expect(screen.queryByText('Remove Bob from the group?')).toBeNull();
    expect(screen.getByRole('button', remove('Bob'))).toBeOnTheScreen();
  });

  it('shows why a removal failed and leaves the member in the group', async () => {
    jest
      .mocked(removeGroupMember)
      .mockRejectedValue(
        new ApiError(403, JSON.stringify({ title: "Only the group's owner can remove members." })),
      );
    const user = userEvent.setup();
    await render(<GroupScreen />);

    await user.press(await screen.findByRole('button', remove('Bob')));
    await user.press(screen.getByRole('button', { name: 'Yes, remove Bob' }));

    expect(await screen.findByText("Only the group's owner can remove members.")).toBeOnTheScreen();
    expect(screen.queryByText('Remove Bob from the group?')).toBeNull();
    expect(screen.getByText('Bob')).toBeOnTheScreen();
    expect(screen.getByRole('button', remove('Bob'))).toBeEnabled();
  });

  it('explains when the group is gone, and clears that when the next removal starts', async () => {
    jest.mocked(removeGroupMember).mockRejectedValue(new ApiError(404, ''));
    const user = userEvent.setup();
    await render(<GroupScreen />);

    await user.press(await screen.findByRole('button', remove('Bob')));
    await user.press(screen.getByRole('button', { name: 'Yes, remove Bob' }));
    expect(await screen.findByText(/no longer exists/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', remove('Bob')));

    expect(screen.queryByText(/no longer exists/)).toBeNull();
    expect(screen.getByText('Remove Bob from the group?')).toBeOnTheScreen();
  });
});
