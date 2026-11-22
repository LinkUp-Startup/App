import { act, render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { listReceivedPlans } from '@/api/received-plans';
import { listSavedPlans } from '@/api/saved-plans';
import SavedPlansScreen from '@/app/(tabs)/saved';
import { getSavedPlans, removePlan, savePlan } from '@/storage/saved-plans';

import { tapasPlan } from './fixtures/plans';

// useFocusEffect runs on mount, and again when a test calls `refocus()` (the tab being shown again).
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  type MockEffect = () => void | (() => void);
  const focused = new Set<MockEffect>();
  return {
    router: { navigate: jest.fn(), push: jest.fn() },
    useFocusEffect: (effect: MockEffect) =>
      useEffect(() => {
        focused.add(effect);
        const cleanup = effect();
        return () => {
          focused.delete(effect);
          if (typeof cleanup === 'function') cleanup();
        };
      }, [effect]),
    __refocus: () => focused.forEach((effect) => effect()),
  };
});
const refocus = () => jest.requireMock<{ __refocus: () => void }>('expo-router').__refocus();

jest.mock('@/api/saved-plans');
jest.mock('@/api/received-plans');
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
  describe('Tonight mode', () => {
    afterEach(() => jest.useRealTimers());

    it('offers Tonight mode for a plan that is on tonight', async () => {
      jest.useFakeTimers({
        now: new Date('2026-10-30T18:00:00Z'),
        doNotFake: ['nextTick', 'setImmediate'],
      });
      await savePlan(tapasPlan);
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await render(<SavedPlansScreen />);

      await user.press(await screen.findByRole('button', { name: 'Tonight: Tapas and drinks' }));

      expect(router.push).toHaveBeenCalledWith({ pathname: '/tonight/[id]', params: { id: 'p1' } });
    });

    it('does not offer it on another day', async () => {
      jest.useFakeTimers({
        now: new Date('2026-11-05T18:00:00Z'),
        doNotFake: ['nextTick', 'setImmediate'],
      });
      await savePlan(tapasPlan);
      await render(<SavedPlansScreen />);

      expect(
        await screen.findByRole('button', { name: 'Open Tapas and drinks' }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: /^Tonight:/ })).not.toBeOnTheScreen();
    });
  });

  it('explains how to save a plan when there are none', async () => {
    const user = userEvent.setup();
    await render(<SavedPlansScreen />);

    expect(await screen.findByText(/No saved plans yet/)).toBeOnTheScreen();
    expect(screen.getByText('Nothing saved yet')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Plan a night' }));
    expect(router.navigate).toHaveBeenCalledWith('/');
  });

  it('lists saved plans and opens one', async () => {
    await savePlan(tapasPlan);
    const user = userEvent.setup();
    await render(<SavedPlansScreen />);

    await user.press(await screen.findByRole('button', { name: 'Open Tapas and drinks' }));

    // The card shows when the night is, the route, how big it is and what it costs.
    expect(screen.getByText('Fri 30 Oct')).toBeOnTheScreen();
    expect(screen.getByText('Teresa Carles  →  Pub Legend')).toBeOnTheScreen();
    expect(screen.getByText('2 stops')).toBeOnTheScreen();
    expect(screen.getByText('910 m total')).toBeOnTheScreen();
    expect(screen.getByText('Estimated €25.50 per person')).toBeOnTheScreen();
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/saved-plan/[id]',
      params: { id: 'p1' },
    });
  });

  it('opens a shared link from the saved plans', async () => {
    const user = userEvent.setup();
    await render(<SavedPlansScreen />);

    await user.press(await screen.findByRole('button', { name: 'Open a shared link' }));
    expect(router.push).toHaveBeenCalledWith('/shared-plan');
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
      jest.mocked(listSavedPlans).mockResolvedValue({ plans: [] });
      jest.mocked(listReceivedPlans).mockResolvedValue({ plans: [] });
    });

    it('links to the plans friends sent, with how many there are', async () => {
      jest.mocked(listReceivedPlans).mockResolvedValue({
        plans: [
          { id: 'r1', plan: tapasPlan, from: null, sentAt: '2026-11-06T18:00:00Z' },
          { id: 'r2', plan: tapasPlan, from: null, sentAt: '2026-11-05T18:00:00Z' },
        ],
      });
      const user = userEvent.setup();
      await render(<SavedPlansScreen />);

      await user.press(await screen.findByRole('button', { name: 'Sent to you (2)' }));

      expect(listReceivedPlans).toHaveBeenCalledWith('token-1', expect.any(AbortSignal));
      expect(router.push).toHaveBeenCalledWith('/received-plans');
    });

    it('shows no link when no friend has sent a plan', async () => {
      await render(<SavedPlansScreen />);

      expect(await screen.findByText(/Nothing saved yet/)).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: /^Sent to you/ })).not.toBeOnTheScreen();
    });

    it('still shows the saved plans when the plans from friends cannot be loaded', async () => {
      await savePlan(tapasPlan);
      jest.mocked(listReceivedPlans).mockRejectedValue(new Error('offline'));
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      await render(<SavedPlansScreen />);

      expect(
        await screen.findByRole('button', { name: 'Open Tapas and drinks' }),
      ).toBeOnTheScreen();
      expect(warn).toHaveBeenCalledWith('Could not load the plans friends sent', expect.any(Error));
      expect(screen.queryByRole('button', { name: /^Sent to you/ })).not.toBeOnTheScreen();
    });

    it('adds the plans saved on other devices and stores them for offline use', async () => {
      jest.mocked(listSavedPlans).mockResolvedValue({
        plans: [{ plan: tapasPlan, savedAt: '2026-10-30T12:00:00.000Z', shareUrl: null }],
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

  it('shows the current plans every time the tab is shown again', async () => {
    await savePlan(tapasPlan);
    await render(<SavedPlansScreen />);
    expect(await screen.findByRole('button', { name: 'Open Tapas and drinks' })).toBeOnTheScreen();

    await removePlan(tapasPlan.id); // deleted on the detail screen
    await act(async () => refocus());

    expect(await screen.findByText(/No saved plans yet/)).toBeOnTheScreen();
  });
});
