import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import { listFriends } from '@/api/friends';
import { createGroup } from '@/api/groups';
import NewGroupScreen from '@/app/new-group';

import { bob, carla, crew } from './fixtures/groups';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('@/api/friends');
jest.mock('@/api/groups');
const mockAuth = { accessToken: 'token-1' as string | null };
jest.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ accessToken: mockAuth.accessToken }),
}));

const noFriends = { friends: [], incoming: [], outgoing: [] };

afterEach(() => {
  jest.clearAllMocks();
  mockAuth.accessToken = 'token-1';
});

describe('NewGroupScreen', () => {
  it('asks guests to log in', async () => {
    mockAuth.accessToken = null;
    const user = userEvent.setup();
    await render(<NewGroupScreen />);

    await user.press(screen.getByRole('button', { name: 'Log in' }));

    expect(router.push).toHaveBeenCalledWith('/login');
    expect(listFriends).not.toHaveBeenCalled();
  });

  it('creates a group with the picked friends and opens it in place of the form', async () => {
    jest.mocked(listFriends).mockResolvedValue({ ...noFriends, friends: [bob, carla] });
    jest.mocked(createGroup).mockResolvedValue(crew);
    const user = userEvent.setup();
    await render(<NewGroupScreen />);

    await user.type(screen.getByLabelText('Group name'), '  Friday crew ');
    await user.press(await screen.findByRole('checkbox', { name: 'Bob' }));
    await user.press(screen.getByRole('checkbox', { name: 'Carla' }));
    await user.press(screen.getByRole('checkbox', { name: 'Carla' })); // changed their mind
    await user.press(screen.getByRole('button', { name: 'Create group' }));

    expect(createGroup).toHaveBeenCalledWith('token-1', { name: 'Friday crew', memberIds: ['u2'] });
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/group/[id]', params: { id: 'g1' } });
  });

  it('shows loading while the friends load', async () => {
    jest.mocked(listFriends).mockReturnValue(new Promise(() => {}));

    await render(<NewGroupScreen />);

    expect(screen.getByText('Loading your friends…')).toBeOnTheScreen();
  });

  it('needs a name', async () => {
    jest.mocked(listFriends).mockResolvedValue(noFriends);
    const user = userEvent.setup();
    await render(<NewGroupScreen />);

    await user.type(screen.getByLabelText('Group name'), '   ');
    await user.press(screen.getByRole('button', { name: 'Create group' }));

    expect(screen.getByText('Give the group a name.')).toBeOnTheScreen();
    expect(createGroup).not.toHaveBeenCalled();
  });

  it('rejects names over the limit', async () => {
    jest.mocked(listFriends).mockResolvedValue(noFriends);
    const user = userEvent.setup();
    await render(<NewGroupScreen />);

    await user.type(screen.getByLabelText('Group name'), 'x'.repeat(61));
    await user.press(screen.getByRole('button', { name: 'Create group' }));

    expect(screen.getByText('A group name is at most 60 characters.')).toBeOnTheScreen();
    expect(createGroup).not.toHaveBeenCalled();
  });

  it('can create a group just for you, and suggests adding friends', async () => {
    jest.mocked(listFriends).mockResolvedValue(noFriends);
    jest.mocked(createGroup).mockResolvedValue(crew);
    const user = userEvent.setup();
    await render(<NewGroupScreen />);

    expect(await screen.findByText(/don.t have friends on LinkUp yet/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Add friends' }));
    expect(router.push).toHaveBeenCalledWith('/friends');

    await user.type(screen.getByLabelText('Group name'), 'Me');
    await user.press(screen.getByRole('button', { name: 'Create group' }));
    expect(createGroup).toHaveBeenCalledWith('token-1', { name: 'Me', memberIds: [] });
  });

  it('shows why the friends could not be loaded', async () => {
    jest.mocked(listFriends).mockRejectedValue(new ApiError(401, ''));

    await render(<NewGroupScreen />);

    expect(await screen.findByText(/session has expired/)).toBeOnTheScreen();
  });

  it('disables the button while creating', async () => {
    jest.mocked(listFriends).mockResolvedValue(noFriends);
    jest.mocked(createGroup).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    await render(<NewGroupScreen />);

    await user.type(screen.getByLabelText('Group name'), 'Crew');
    await user.press(screen.getByRole('button', { name: 'Create group' }));

    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
  });

  it('shows the server error and lets you try again', async () => {
    jest.mocked(listFriends).mockResolvedValue({ ...noFriends, friends: [bob] });
    jest
      .mocked(createGroup)
      .mockRejectedValue(
        new ApiError(409, JSON.stringify({ title: 'You can be in up to 50 groups.' })),
      );
    const user = userEvent.setup();
    await render(<NewGroupScreen />);

    await user.type(screen.getByLabelText('Group name'), 'Crew');
    await user.press(screen.getByRole('button', { name: 'Create group' }));

    expect(await screen.findByText('You can be in up to 50 groups.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Create group' })).toBeEnabled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
