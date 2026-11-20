import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { generateGroupPlans, getGroup } from '@/api/groups';
import GroupPlanScreen from '@/app/group-plan';
import GroupScreen from '@/app/group/[id]';
import { tapasPlan } from '@/features/plans/__tests__/fixtures/plans';
import type { Group, NightPreferences } from '@/types/api';

const mockParams: { id?: string; groupId?: string; groupSize?: string } = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
  // Run the focus effect once on mount, like a screen that has just been shown
  useFocusEffect: (effect: () => void | (() => void)) =>
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));
jest.mock('@/api/groups');
jest.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ accessToken: 'token-1', user: { id: 'u1' } }),
}));
// The preferences form is its own screen; here it only has to hand over some preferences.
jest.mock('@/features/preferences/plan-form', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    PlanForm: ({ onSubmit }: { onSubmit: (preferences: unknown) => void }) => (
      <Pressable accessibilityRole="button" onPress={() => onSubmit({ groupSize: 3 })}>
        <Text>Generate</Text>
      </Pressable>
    ),
  };
});

const group: Group = {
  id: 'g1',
  name: 'Friday crew',
  createdAt: '2026-11-01T10:00:00Z',
  myRole: 'owner',
  members: [
    { userId: 'u1', displayName: 'Ann', role: 'owner', joinedAt: '2026-11-01T10:00:00Z' },
    { userId: 'u2', displayName: 'Bob', role: 'member', joinedAt: '2026-11-01T10:00:00Z' },
  ],
};

afterEach(() => {
  jest.resetAllMocks();
  for (const key of Object.keys(mockParams)) delete mockParams[key as keyof typeof mockParams];
});

describe('the way to the vote', () => {
  it('opens the vote from the group', async () => {
    mockParams.id = 'g1';
    jest.mocked(getGroup).mockResolvedValue(group);
    const user = userEvent.setup();
    await render(<GroupScreen />);

    await user.press(await screen.findByRole('button', { name: 'Vote on the plans' }));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/group-vote',
      params: { groupId: 'g1' },
    });
  });

  it('opens the vote from the plans that were just made', async () => {
    Object.assign(mockParams, { groupId: 'g1', groupSize: '2' });
    jest.mocked(generateGroupPlans).mockResolvedValue({
      id: 'r1',
      createdAt: '2026-11-20T18:00:00Z',
      createdBy: null,
      groupSize: 2,
      plans: [tapasPlan],
    });
    const user = userEvent.setup();
    await render(<GroupPlanScreen />);

    await user.press(screen.getByRole('button', { name: 'Generate' }));
    expect(generateGroupPlans).toHaveBeenCalledWith(
      'token-1',
      'g1',
      { groupSize: 3 } as unknown as NightPreferences,
      expect.any(AbortSignal),
    );
    await user.press(await screen.findByRole('button', { name: 'Vote on these plans' }));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/group-vote',
      params: { groupId: 'g1' },
    });
  });
});
