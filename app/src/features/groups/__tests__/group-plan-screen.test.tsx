import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import { generateGroupPlans } from '@/api/groups';
import GroupPlanScreen from '@/app/group-plan';

import { roundByBob } from './fixtures/groups';

const mockParams: { groupId?: string; groupSize?: string } = { groupId: 'g1', groupSize: '3' };
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void | (() => void)) =>
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));
jest.mock('@/api/groups');
const mockAuth = { accessToken: 'token-1' as string | null, user: { id: 'u1' } };
jest.mock('@/features/auth/auth-context', () => ({ useAuth: () => mockAuth }));
// Loading the saved defaults is covered by the prefill tests; here it never answers.
jest.mock('@/api/user-preferences', () => ({
  getUserPreferences: jest.fn(() => new Promise(() => {})),
}));
jest.mock('expo-location', () => ({ reverseGeocodeAsync: jest.fn().mockResolvedValue([]) }));

afterEach(() => {
  jest.clearAllMocks();
  mockParams.groupId = 'g1';
  mockParams.groupSize = '3';
  mockAuth.accessToken = 'token-1';
});

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.press(screen.getByRole('checkbox', { name: /Drinks/ }));
  await user.press(screen.getByRole('button', { name: 'Generate group plans' }));
  return user;
}

describe('GroupPlanScreen', () => {
  it('shows the member count instead of the group size stepper', async () => {
    await render(<GroupPlanScreen />);

    expect(screen.getByText('Plan a night together')).toBeOnTheScreen();
    expect(screen.getByText('3 people')).toBeOnTheScreen();
    expect(screen.getByText('Everyone in the group')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Increase group size' })).not.toBeOnTheScreen();
  });

  it('checks the form before generating', async () => {
    const user = userEvent.setup();
    await render(<GroupPlanScreen />);

    await user.press(screen.getByRole('button', { name: 'Generate group plans' }));

    expect(screen.getByText('Pick at least one activity.')).toBeOnTheScreen();
    expect(generateGroupPlans).not.toHaveBeenCalled();
  });

  it('generates plans with the member count as the group size and shows them', async () => {
    jest.mocked(generateGroupPlans).mockResolvedValue(roundByBob);
    await render(<GroupPlanScreen />);

    const user = await fillAndSubmit();

    expect(generateGroupPlans).toHaveBeenCalledWith(
      'token-1',
      'g1',
      expect.objectContaining({ groupSize: 3, activities: ['drinks'] }),
      expect.any(AbortSignal),
    );
    expect(await screen.findByText('2 plans for 3 people saved to the group.')).toBeOnTheScreen();
    expect(screen.getByText('Tapas and drinks')).toBeOnTheScreen();
    expect(screen.getByText('Second plan')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Back to the group' }));
    expect(router.back).toHaveBeenCalled();
  });

  it('says "1 person" for a group of one', async () => {
    mockParams.groupSize = '1';
    jest.mocked(generateGroupPlans).mockResolvedValue({ ...roundByBob, groupSize: 1 });
    await render(<GroupPlanScreen />);

    await fillAndSubmit();

    expect(await screen.findByText('2 plans for 1 person saved to the group.')).toBeOnTheScreen();
  });

  it('can plan another night after the plans are saved', async () => {
    jest.mocked(generateGroupPlans).mockResolvedValue(roundByBob);
    await render(<GroupPlanScreen />);

    const user = await fillAndSubmit();
    await user.press(await screen.findByRole('button', { name: 'Plan another night' }));

    expect(screen.getByRole('button', { name: 'Generate group plans' })).toBeOnTheScreen();
  });

  it('shows progress while generating', async () => {
    jest.mocked(generateGroupPlans).mockReturnValue(new Promise(() => {}));
    await render(<GroupPlanScreen />);

    await fillAndSubmit();

    expect(screen.getByText(/Putting your group.s night together/)).toBeOnTheScreen();
  });

  it('cancels the request when the screen is left', async () => {
    jest.mocked(generateGroupPlans).mockReturnValue(new Promise(() => {}));
    const { unmount } = await render(<GroupPlanScreen />);
    await fillAndSubmit();
    const signal = jest.mocked(generateGroupPlans).mock.calls[0][3];

    await unmount();

    expect(signal?.aborted).toBe(true);
  });

  it('shows the error and tries again with the same preferences', async () => {
    jest
      .mocked(generateGroupPlans)
      .mockRejectedValueOnce(new ApiError(502, ''))
      .mockResolvedValueOnce(roundByBob);
    await render(<GroupPlanScreen />);

    const user = await fillAndSubmit();
    expect(await screen.findByText("Couldn't generate plans")).toBeOnTheScreen();
    expect(screen.getByText(/went wrong on our side/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText(/saved to the group/)).toBeOnTheScreen();
    const [first, second] = jest.mocked(generateGroupPlans).mock.calls;
    expect(second[2]).toEqual(first[2]);
  });

  it('can change the preferences after an error', async () => {
    jest.mocked(generateGroupPlans).mockRejectedValue(new ApiError(404, ''));
    await render(<GroupPlanScreen />);

    const user = await fillAndSubmit();
    expect(await screen.findByText(/no longer exists/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Change preferences' }));

    expect(screen.getByRole('button', { name: 'Generate group plans' })).toBeOnTheScreen();
  });

  it.each([
    { groupId: undefined },
    { groupSize: undefined },
    { groupSize: 'abc' },
    { groupSize: '0' },
    { groupSize: '2.5' },
  ])('sends you to your groups without a valid group (%o)', async (params) => {
    Object.assign(mockParams, params);
    const user = userEvent.setup();
    await render(<GroupPlanScreen />);

    await user.press(screen.getByRole('button', { name: 'Go to your groups' }));

    expect(router.replace).toHaveBeenCalledWith('/groups');
  });

  it('needs an account', async () => {
    mockAuth.accessToken = null;

    await render(<GroupPlanScreen />);

    expect(screen.getByText('Open a group to plan a night for it.')).toBeOnTheScreen();
  });
});
