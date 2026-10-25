import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import { deleteSavedPlan } from '@/api/saved-plans';
import SavedPlanScreen from '@/app/saved-plan/[id]';
import { getSavedPlans, savePlan } from '@/storage/saved-plans';

import { tapasPlan } from './fixtures/plans';

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/api/saved-plans');
// Guest by default; the signed-in tests set a token.
const mockAuth = { accessToken: null as string | null };
jest.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ accessToken: mockAuth.accessToken }),
}));

beforeEach(() => jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'p1' }));

afterEach(() => {
  jest.clearAllMocks();
  mockAuth.accessToken = null;
});

describe('SavedPlanScreen', () => {
  it('shows the saved plan', async () => {
    await savePlan(tapasPlan);
    await render(<SavedPlanScreen />);

    expect(await screen.findByRole('header', { name: 'Tapas and drinks' })).toBeOnTheScreen();
    expect(screen.getByText(/^Saved on /)).toBeOnTheScreen();
  });

  it('deletes the plan after confirming', async () => {
    await savePlan(tapasPlan);
    const alert = jest.spyOn(Alert, 'alert');
    const user = userEvent.setup();
    await render(<SavedPlanScreen />);

    await user.press(await screen.findByRole('button', { name: 'Delete plan' }));
    const buttons = alert.mock.calls[0][2]!;
    buttons.find((button) => button.text === 'Delete')!.onPress!();

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await getSavedPlans()).toEqual([]);
  });

  it('keeps the plan when deleting is cancelled', async () => {
    await savePlan(tapasPlan);
    const alert = jest.spyOn(Alert, 'alert');
    const user = userEvent.setup();
    await render(<SavedPlanScreen />);

    await user.press(await screen.findByRole('button', { name: 'Delete plan' }));

    expect(alert.mock.calls[0][2]!.find((button) => button.text === 'Cancel')?.style).toBe(
      'cancel',
    );
    expect(await getSavedPlans()).toHaveLength(1);
  });

  it('explains when the plan is no longer saved', async () => {
    const user = userEvent.setup();
    await render(<SavedPlanScreen />);

    expect(await screen.findByText('This plan is no longer saved.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Back to saved plans' }));
    expect(router.back).toHaveBeenCalled();
  });

  describe('when signed in', () => {
    beforeEach(() => {
      mockAuth.accessToken = 'token-1';
    });

    async function confirmDelete() {
      const alert = jest.spyOn(Alert, 'alert');
      const user = userEvent.setup();
      await render(<SavedPlanScreen />);
      await user.press(await screen.findByRole('button', { name: 'Delete plan' }));
      alert.mock.calls[0][2]!.find((button) => button.text === 'Delete')!.onPress!();
      return alert;
    }

    it('deletes the plan from the account and from the device', async () => {
      await savePlan(tapasPlan);
      jest.mocked(deleteSavedPlan).mockResolvedValue(undefined);

      const alert = await confirmDelete();

      await waitFor(() => expect(router.back).toHaveBeenCalled());
      expect(alert.mock.calls[0][1]).toMatch(/your account and this device/);
      expect(deleteSavedPlan).toHaveBeenCalledWith('token-1', 'p1');
      expect(await getSavedPlans()).toEqual([]);
    });

    it('keeps the plan and says so when the account cannot be reached', async () => {
      await savePlan(tapasPlan);
      jest.mocked(deleteSavedPlan).mockRejectedValue(new Error('offline'));
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      await confirmDelete();

      expect(await screen.findByText(/Couldn't delete this plan/)).toBeOnTheScreen();
      expect(router.back).not.toHaveBeenCalled();
      expect(await getSavedPlans()).toHaveLength(1);
    });
  });
});
