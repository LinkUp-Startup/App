import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { listSavedPlans } from '@/api/saved-plans';
import SavedPlansScreen from '@/app/(tabs)/saved';
import { getSavedPlans, savePlan } from '@/storage/saved-plans';

import { tapasPlan } from './fixtures/plans';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    router: { navigate: jest.fn(), push: jest.fn() },
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});

jest.mock('@/api/saved-plans');
// Guest by default; the signed-in tests set a token.
const mockAuth = { accessToken: null as string | null };
jest.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ accessToken: mockAuth.accessToken }),
}));

afterEach(() => {
  jest.clearAllMocks();
  mockAuth.accessToken = null;
});

describe('SavedPlansScreen', () => {
  it('explains how to save a plan when there are none', async () => {
    const user = userEvent.setup();
    await render(<SavedPlansScreen />);

    expect(await screen.findByText(/No saved plans yet/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Plan a night' }));
    expect(router.navigate).toHaveBeenCalledWith('/');
  });

  it('lists saved plans and opens one', async () => {
    await savePlan(tapasPlan);
    const user = userEvent.setup();
    await render(<SavedPlansScreen />);

    await user.press(await screen.findByRole('button', { name: 'Open Tapas and drinks' }));

    expect(
      screen.getByText('Fri 30 Oct · 2 stops · estimated €25.50 per person · 910 m'),
    ).toBeOnTheScreen();
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/saved-plan/[id]',
      params: { id: 'p1' },
    });
  });

  it('offers guests to log in so their plans are kept on the account', async () => {
    const user = userEvent.setup();
    await render(<SavedPlansScreen />);

    expect(await screen.findByText(/Log in to keep your saved plans/)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Log in' }));
    expect(router.push).toHaveBeenCalledWith('/login');
    expect(listSavedPlans).not.toHaveBeenCalled();
  });

  describe('when signed in', () => {
    beforeEach(() => {
      mockAuth.accessToken = 'token-1';
    });

    it('adds the plans saved on other devices and stores them for offline use', async () => {
      jest.mocked(listSavedPlans).mockResolvedValue({
        plans: [{ plan: tapasPlan, savedAt: '2026-10-30T12:00:00.000Z' }],
      });
      await render(<SavedPlansScreen />);

      expect(
        await screen.findByRole('button', { name: 'Open Tapas and drinks' }),
      ).toBeOnTheScreen();
      expect(listSavedPlans).toHaveBeenCalledWith('token-1', expect.any(AbortSignal));
      expect(screen.queryByText(/Log in to keep your saved plans/)).toBeNull();
      expect((await getSavedPlans()).map((p) => p.id)).toEqual(['p1']);
    });

    it('shows the plans on the device and says so when the account cannot be reached', async () => {
      await savePlan(tapasPlan);
      jest.mocked(listSavedPlans).mockRejectedValue(new Error('offline'));
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      await render(<SavedPlansScreen />);

      expect(await screen.findByText(/Couldn't reach your account/)).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Open Tapas and drinks' })).toBeOnTheScreen();
    });
  });
});
