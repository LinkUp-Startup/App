import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Alert, Linking, Share } from 'react-native';

import { listFriends } from '@/api/friends';
import { deleteSavedPlan, sharePlan, unsharePlan } from '@/api/saved-plans';
import SavedPlanScreen from '@/app/saved-plan/[id]';
import { swapOptions } from '@/api/plans';
import { addPlanToCalendar } from '@/features/plans/add-to-calendar';
import { remindersOn, turnOnReminders } from '@/features/tonight/reminders';
import * as storage from '@/storage/saved-plans';
import { getSavedPlan, getSavedPlans, savePlan } from '@/storage/saved-plans';
import type { Plan } from '@/types/api';

import { tapasPlan } from './fixtures/plans';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/api/saved-plans');
jest.mock('@/api/friends');
jest.mock('@/features/plans/add-to-calendar');
jest.mock('@/api/plans', () => ({ swapOptions: jest.fn() }));
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
    await turnOnReminders(tapasPlan, new Date('2026-10-30T12:00:00Z'));
    const alert = jest.spyOn(Alert, 'alert');
    const user = userEvent.setup();
    await render(<SavedPlanScreen />);

    await user.press(await screen.findByRole('button', { name: 'Delete plan' }));
    const buttons = alert.mock.calls[0][2]!;
    buttons.find((button) => button.text === 'Delete')!.onPress!();

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await getSavedPlans()).toEqual([]);
    await waitFor(async () => expect(await remindersOn('p1')).toBe(false));
  });

  it('still deletes the plan when its reminders cannot be cancelled', async () => {
    await savePlan(tapasPlan);
    const alert = jest.spyOn(Alert, 'alert');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<SavedPlanScreen />);
    await screen.findByRole('switch', { name: 'Remind me before each stop' }).catch(() => null);
    jest
      .mocked(Notifications.getAllScheduledNotificationsAsync)
      .mockRejectedValueOnce(new Error('boom'));

    await user.press(await screen.findByRole('button', { name: 'Delete plan' }));
    alert.mock.calls[0][2]!.find((button) => button.text === 'Delete')!.onPress!();

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith('Could not cancel reminders', expect.any(Error)),
    );
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

  describe('swap a stop', () => {
    const swapped: Plan = {
      ...tapasPlan,
      items: [
        {
          ...tapasPlan.items[0],
          venue: { ...tapasPlan.items[0].venue, id: '30', name: 'Casa Pepe' },
        },
        tapasPlan.items[1],
      ],
    };

    async function swapToCasaPepe() {
      jest.mocked(swapOptions).mockResolvedValue({ options: [swapped] });
      const user = userEvent.setup({ advanceTimers: (ms) => jest.advanceTimersByTime(ms) });
      await render(<SavedPlanScreen />);
      await user.press(await screen.findByRole('button', { name: 'Swap Teresa Carles' }));
      await user.press(await screen.findByRole('button', { name: 'Swap to Casa Pepe' }));
    }

    afterEach(() => jest.useRealTimers());

    it('saves the swapped plan and says so', async () => {
      await savePlan(tapasPlan);

      await swapToCasaPepe();

      expect(await screen.findByText('Swapped to Casa Pepe.')).toBeOnTheScreen();
      expect((await getSavedPlan('p1'))?.items[0].venue.name).toBe('Casa Pepe');
      expect(screen.getByLabelText(/^Stop 1: Casa Pepe,/)).toBeOnTheScreen();
    });

    it('moves the reminders to the swapped plan', async () => {
      jest.useFakeTimers({
        now: new Date('2026-10-30T12:00:00Z'),
        doNotFake: ['nextTick', 'setImmediate'],
      });
      await savePlan(tapasPlan);
      await turnOnReminders(tapasPlan, new Date('2026-10-30T12:00:00Z'));

      await swapToCasaPepe();

      await screen.findByText('Swapped to Casa Pepe.');
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      expect(scheduled.map((request) => request.content.title)).toContainEqual(
        expect.stringMatching(/^Casa Pepe at /),
      );
    });

    it('keeps the plan when the swap is closed', async () => {
      await savePlan(tapasPlan);
      jest.mocked(swapOptions).mockResolvedValue({ options: [] });
      const user = userEvent.setup();
      await render(<SavedPlanScreen />);

      await user.press(await screen.findByRole('button', { name: 'Swap Teresa Carles' }));
      await user.press(await screen.findByRole('button', { name: 'Keep this stop' }));

      expect(screen.queryByRole('button', { name: 'Keep this stop' })).not.toBeOnTheScreen();
      expect((await getSavedPlan('p1'))?.items[0].venue.name).toBe('Teresa Carles');
    });

    it('says so when the swapped plan cannot be saved', async () => {
      await savePlan(tapasPlan);
      jest.spyOn(storage, 'savePlan').mockRejectedValueOnce(new Error('disk full'));
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      await swapToCasaPepe();

      expect(
        await screen.findByText('Couldn\'t save the change to "Tapas and drinks". Try again.'),
      ).toBeOnTheScreen();
    });
  });

  describe('Tonight mode', () => {
    afterEach(() => jest.useRealTimers());

    it('opens Tonight mode on the night of the plan', async () => {
      jest.useFakeTimers({
        now: new Date('2026-10-30T20:00:00Z'),
        doNotFake: ['nextTick', 'setImmediate'],
      });
      await savePlan(tapasPlan);
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await render(<SavedPlanScreen />);

      await user.press(await screen.findByRole('button', { name: 'Open Tonight mode' }));

      expect(router.push).toHaveBeenCalledWith({ pathname: '/tonight/[id]', params: { id: 'p1' } });
    });

    it('does not offer it on another day', async () => {
      await savePlan(tapasPlan);
      await render(<SavedPlanScreen />);

      expect(await screen.findByRole('button', { name: 'Delete plan' })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Open Tonight mode' })).not.toBeOnTheScreen();
    });
  });

  describe('add to calendar', () => {
    async function pressAddToCalendar() {
      await savePlan(tapasPlan);
      const user = userEvent.setup();
      await render(<SavedPlanScreen />);
      await user.press(await screen.findByRole('button', { name: 'Add to calendar' }));
    }

    it('adds the stops and says how many', async () => {
      jest.mocked(addPlanToCalendar).mockResolvedValue({ status: 'added', count: 2 });

      await pressAddToCalendar();

      expect(await screen.findByText('Added 2 events to your calendar.')).toBeOnTheScreen();
      expect(jest.mocked(addPlanToCalendar).mock.calls[0][0].id).toBe(tapasPlan.id);
    });

    it('says "1 event" for one stop', async () => {
      jest.mocked(addPlanToCalendar).mockResolvedValue({ status: 'added', count: 1 });

      await pressAddToCalendar();

      expect(await screen.findByText('Added 1 event to your calendar.')).toBeOnTheScreen();
    });

    it('says so when no calendar can take events', async () => {
      jest.mocked(addPlanToCalendar).mockResolvedValue({ status: 'no-calendar' });

      await pressAddToCalendar();

      expect(
        await screen.findByText('No calendar on this phone can take new events.'),
      ).toBeOnTheScreen();
    });

    it('offers the settings when calendar access is off', async () => {
      jest.mocked(addPlanToCalendar).mockResolvedValue({ status: 'denied' });
      const alert = jest.spyOn(Alert, 'alert');
      const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();

      await pressAddToCalendar();

      await waitFor(() => expect(alert).toHaveBeenCalled());
      expect(alert.mock.calls[0][0]).toBe('Calendar access is off');
      alert.mock.calls[0][2]!.find((button) => button.text === 'Open Settings')!.onPress!();
      expect(openSettings).toHaveBeenCalled();
    });

    it('says so when adding fails', async () => {
      jest.mocked(addPlanToCalendar).mockRejectedValue(new Error('boom'));
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      await pressAddToCalendar();

      expect(
        await screen.findByText("Couldn't add the plan to your calendar. Try again."),
      ).toBeOnTheScreen();
    });
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

      beforeEach(() =>
        jest.mocked(listFriends).mockResolvedValue({ friends: [], incoming: [], outgoing: [] }),
      );

      it('renders the share popup next to the swap sheet without clashing keys', async () => {
        await savePlan(tapasPlan, { synced: true });
        const error = jest.spyOn(console, 'error');
        await render(<SavedPlanScreen />);

        expect(await screen.findByRole('button', { name: 'Share plan' })).toBeOnTheScreen();
        // React only logs a duplicate key, so check the log
        expect(error.mock.calls.flat().join(' ')).not.toMatch(/same key/);
        error.mockRestore();
      });

      it('opens the share popup with both ways to share', async () => {
        await savePlan(tapasPlan, { synced: true });
        const user = userEvent.setup();
        await render(<SavedPlanScreen />);

        await user.press(await screen.findByRole('button', { name: 'Share plan' }));

        expect(await screen.findByText('Send to a friend')).toBeOnTheScreen();
        expect(screen.getByRole('button', { name: 'Share a link' })).toBeOnTheScreen();
        expect(listFriends).toHaveBeenCalledWith('token-1', expect.any(AbortSignal));
        expect(sharePlan).not.toHaveBeenCalled();
      });

      it('gets a link, opens the share sheet and shows that the plan is shared', async () => {
        await savePlan(tapasPlan, { synced: true });
        jest.mocked(sharePlan).mockResolvedValue({ url });
        const share = jest
          .spyOn(Share, 'share')
          .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
        const user = userEvent.setup();
        await render(<SavedPlanScreen />);

        await user.press(await screen.findByRole('button', { name: 'Share plan' }));
        await user.press(await screen.findByRole('button', { name: 'Share a link' }));

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
        await user.press(await screen.findByRole('button', { name: 'Share a link' }));

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
