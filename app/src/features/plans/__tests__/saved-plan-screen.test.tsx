import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Share } from 'react-native';

import { deleteSavedPlan, sharePlan, unsharePlan } from '@/api/saved-plans';
import SavedPlanScreen from '@/app/saved-plan/[id]';
import { getSavedPlan, getSavedPlans, savePlan } from '@/storage/saved-plans';

import { tapasPlan } from './fixtures/plans';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
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

  it('asks a guest to log in before sharing', async () => {
    await savePlan(tapasPlan);
    const alert = jest.spyOn(Alert, 'alert');
    const user = userEvent.setup();
    await render(<SavedPlanScreen />);

    await user.press(await screen.findByRole('button', { name: 'Share plan' }));

    expect(alert.mock.calls[0][0]).toBe('Log in to share');
    expect(sharePlan).not.toHaveBeenCalled();
    expect(screen.queryByText(/Shared: anyone/)).not.toBeOnTheScreen();
    alert.mock.calls[0][2]!.find((button) => button.text === 'Log in')!.onPress!();
    expect(router.push).toHaveBeenCalledWith('/login');
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

    describe('sharing', () => {
      const url = 'https://linkup.th7bo.dev/plan/tok';

      it('gets a link, opens the share sheet and shows that the plan is shared', async () => {
        await savePlan(tapasPlan, { synced: true });
        jest.mocked(sharePlan).mockResolvedValue({ url });
        const share = jest
          .spyOn(Share, 'share')
          .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
        const user = userEvent.setup();
        await render(<SavedPlanScreen />);

        await user.press(await screen.findByRole('button', { name: 'Share plan' }));

        await waitFor(() => expect(share).toHaveBeenCalled());
        expect(JSON.stringify(share.mock.calls[0][0])).toContain(url);
        expect(sharePlan).toHaveBeenCalledWith('token-1', 'p1');
        expect(
          await screen.findByText('Shared: anyone with the link can see this plan.'),
        ).toBeOnTheScreen();
      });

      it('says so when no link can be made', async () => {
        await savePlan(tapasPlan, { synced: true });
        jest.mocked(sharePlan).mockRejectedValue(new Error('offline'));
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        const share = jest.spyOn(Share, 'share');
        const user = userEvent.setup();
        await render(<SavedPlanScreen />);

        await user.press(await screen.findByRole('button', { name: 'Share plan' }));

        expect(await screen.findByText(/Couldn't create a share link/)).toBeOnTheScreen();
        expect(share).not.toHaveBeenCalled();
      });

      it('stops sharing after confirming', async () => {
        await savePlan(tapasPlan, { synced: true, shareUrl: url });
        jest.mocked(unsharePlan).mockResolvedValue(undefined);
        const alert = jest.spyOn(Alert, 'alert');
        const user = userEvent.setup();
        await render(<SavedPlanScreen />);

        await user.press(await screen.findByRole('button', { name: 'Stop sharing' }));
        alert.mock.calls[0][2]!.find((button) => button.text === 'Stop sharing')!.onPress!();

        await waitFor(() =>
          expect(screen.queryByRole('button', { name: 'Stop sharing' })).not.toBeOnTheScreen(),
        );
        expect(unsharePlan).toHaveBeenCalledWith('token-1', 'p1');
        expect(await getSavedPlan('p1')).not.toHaveProperty('shareUrl');
      });

      it('keeps the link and says so when stopping fails', async () => {
        await savePlan(tapasPlan, { synced: true, shareUrl: url });
        jest.mocked(unsharePlan).mockRejectedValue(new Error('offline'));
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        const alert = jest.spyOn(Alert, 'alert');
        const user = userEvent.setup();
        await render(<SavedPlanScreen />);

        await user.press(await screen.findByRole('button', { name: 'Stop sharing' }));
        alert.mock.calls[0][2]!.find((button) => button.text === 'Stop sharing')!.onPress!();

        expect(await screen.findByText(/Couldn't stop sharing/)).toBeOnTheScreen();
        expect((await getSavedPlan('p1'))?.shareUrl).toBe(url);
      });
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
