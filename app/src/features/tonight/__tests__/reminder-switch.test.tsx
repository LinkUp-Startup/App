import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { Alert, Linking } from 'react-native';

import { tapasPlan } from '@/features/plans/__tests__/fixtures/plans';
import { ReminderSwitch } from '@/features/tonight/reminder-switch';
import { remindersOn, turnOnReminders } from '@/features/tonight/reminders';

const before = new Date('2026-10-30T12:00:00Z');
const label = 'Remind me before each stop';

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// Turning reminders on uses the real clock; pretend it's the afternoon of the plan.
function atAfternoon() {
  jest.useFakeTimers({ now: before, doNotFake: ['nextTick', 'setImmediate'] });
}

// Pressing a Switch in tests doesn't change it; this is what flipping it does.
async function flip(value: boolean) {
  const toggle = await screen.findByRole('switch', { name: label });
  await act(async () => fireEvent(toggle, 'valueChange', value));
}

describe('ReminderSwitch', () => {
  it('turns reminders on and says when they come', async () => {
    atAfternoon();
    await render(<ReminderSwitch plan={tapasPlan} now={before} />);

    await flip(true);

    expect(
      await screen.findByText(
        "You'll get a reminder 15 minutes before you need to leave for each stop.",
      ),
    ).toBeOnTheScreen();
    await expect(remindersOn('p1')).resolves.toBe(true);
    expect(screen.getByRole('switch', { name: label })).toBeChecked();
  });

  it('shows reminders that are already on and turns them off', async () => {
    atAfternoon();
    await turnOnReminders(tapasPlan, before);
    await render(<ReminderSwitch plan={tapasPlan} now={before} />);

    expect(await screen.findByRole('switch', { name: label })).toBeChecked();
    await flip(false);

    await waitFor(() => expect(screen.getByRole('switch', { name: label })).not.toBeChecked());
    await expect(remindersOn('p1')).resolves.toBe(false);
  });

  it('offers the settings when notifications are off', async () => {
    atAfternoon();
    jest
      .mocked(Notifications.getPermissionsAsync)
      .mockResolvedValue({ granted: false, canAskAgain: false } as never);
    const alert = jest.spyOn(Alert, 'alert');
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await render(<ReminderSwitch plan={tapasPlan} now={before} />);

    await flip(true);

    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(alert.mock.calls[0][0]).toBe('Notifications are off');
    alert.mock.calls[0][2]!.find((button) => button.text === 'Open Settings')!.onPress!();
    expect(openSettings).toHaveBeenCalled();
    expect(screen.getByRole('switch', { name: label })).not.toBeChecked();
  });

  it('says so when every stop has already started', async () => {
    jest.useFakeTimers({
      now: new Date('2026-10-30T21:30:00Z'),
      doNotFake: ['nextTick', 'setImmediate'],
    });
    await render(<ReminderSwitch plan={tapasPlan} now={new Date('2026-10-30T21:30:00Z')} />);

    await flip(true);

    expect(
      await screen.findByText('Every stop of this plan has already started.'),
    ).toBeOnTheScreen();
  });

  it('says so when the reminders cannot be changed', async () => {
    atAfternoon();
    jest.mocked(Notifications.scheduleNotificationAsync).mockRejectedValueOnce(new Error('boom'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await render(<ReminderSwitch plan={tapasPlan} now={before} />);

    await flip(true);

    expect(await screen.findByText("Couldn't change the reminders. Try again.")).toBeOnTheScreen();
  });

  it('treats unreadable reminders as off', async () => {
    jest
      .mocked(Notifications.getAllScheduledNotificationsAsync)
      .mockRejectedValueOnce(new Error('boom'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await render(<ReminderSwitch plan={tapasPlan} now={before} />);

    expect(await screen.findByRole('switch', { name: label })).not.toBeChecked();
  });

  it('is hidden once the night is over', async () => {
    await render(<ReminderSwitch plan={tapasPlan} now={new Date('2026-10-31T00:00:00Z')} />);

    await waitFor(() => expect(Notifications.getAllScheduledNotificationsAsync).toHaveBeenCalled());
    expect(screen.queryByRole('switch')).not.toBeOnTheScreen();
  });
});
