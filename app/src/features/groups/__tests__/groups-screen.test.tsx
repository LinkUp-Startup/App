import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import { listGroups } from '@/api/groups';
import GroupsScreen from '@/app/groups';

import { crewSummary } from './fixtures/groups';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  // Run the focus effect once on mount, like a screen that has just been shown
  useFocusEffect: (effect: () => void | (() => void)) =>
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));
jest.mock('@/api/groups');
const mockAuth = { accessToken: 'token-1' as string | null };
jest.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ accessToken: mockAuth.accessToken }),
}));

afterEach(() => {
  jest.clearAllMocks();
  mockAuth.accessToken = 'token-1';
});

describe('GroupsScreen', () => {
  it('asks guests to log in', async () => {
    mockAuth.accessToken = null;
    const user = userEvent.setup();
    await render(<GroupsScreen />);

    await user.press(screen.getByRole('button', { name: 'Log in' }));

    expect(router.push).toHaveBeenCalledWith('/login');
    expect(listGroups).not.toHaveBeenCalled();
  });

  it('shows an empty state', async () => {
    jest.mocked(listGroups).mockResolvedValue({ groups: [] });

    await render(<GroupsScreen />);

    expect(await screen.findByText(/aren.t in any group yet/)).toBeOnTheScreen();
    expect(listGroups).toHaveBeenCalledWith('token-1', expect.any(AbortSignal));
  });

  it('shows loading until the groups arrive', async () => {
    jest.mocked(listGroups).mockReturnValue(new Promise(() => {}));

    await render(<GroupsScreen />);

    expect(screen.getByText('Loading…')).toBeOnTheScreen();
  });

  it('lists groups and opens one', async () => {
    jest.mocked(listGroups).mockResolvedValue({ groups: [crewSummary] });
    const user = userEvent.setup();
    await render(<GroupsScreen />);

    expect(await screen.findByText('Friday crew')).toBeOnTheScreen();
    expect(screen.getByText('2 members · You own it')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Open Friday crew' }));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/group/[id]', params: { id: 'g1' } });
  });

  it('opens the create screen', async () => {
    jest.mocked(listGroups).mockResolvedValue({ groups: [] });
    const user = userEvent.setup();
    await render(<GroupsScreen />);

    await user.press(screen.getByRole('button', { name: 'Create a group' }));

    expect(router.push).toHaveBeenCalledWith('/new-group');
  });

  it('shows an error and loads again', async () => {
    jest
      .mocked(listGroups)
      .mockRejectedValueOnce(new ApiError(500, ''))
      .mockResolvedValueOnce({ groups: [crewSummary] });
    const user = userEvent.setup();
    await render(<GroupsScreen />);

    expect(await screen.findByText(/went wrong on our side/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Friday crew')).toBeOnTheScreen();
    expect(screen.queryByText(/went wrong on our side/)).not.toBeOnTheScreen();
  });
});
