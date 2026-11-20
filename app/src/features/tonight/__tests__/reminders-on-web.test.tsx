import { render, renderHook, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { tapasPlan } from '@/features/plans/__tests__/fixtures/plans';
import { ReminderSwitch } from '@/features/tonight/reminder-switch';
import { remindersOn, turnOffReminders, turnOnReminders } from '@/features/tonight/reminders';
import { useOpenReminders } from '@/features/tonight/use-open-reminders.web';

// The browser has no notifications. Asking the notifications module anything there throws, which used to leave the
// whole page blank, so on the web reminders do nothing and are not offered.
const before = new Date('2026-10-30T12:00:00Z');

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('useOpenReminders in the browser', () => {
  it('does nothing and never asks the notifications module', async () => {
    await renderHook(() => useOpenReminders());

    expect(Notifications.useLastNotificationResponse).not.toHaveBeenCalled();
    expect(Notifications.setNotificationHandler).not.toHaveBeenCalled();
  });
});

describe('reminders in the browser', () => {
  it('has none switched on, without reading a schedule that does not exist', async () => {
    await expect(remindersOn('p1')).resolves.toBe(false);

    expect(Notifications.getAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  });

  it('has nothing to turn off', async () => {
    await expect(turnOffReminders('p1')).resolves.toBeUndefined();

    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('cannot turn them on, and does not ask for permission', async () => {
    await expect(turnOnReminders(tapasPlan, before)).resolves.toBe('denied');

    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('ReminderSwitch in the browser', () => {
  it('is not offered', async () => {
    await render(<ReminderSwitch plan={tapasPlan} now={before} />);

    expect(screen.queryByLabelText('Remind me before each stop')).toBeNull();
    expect(screen.queryByText('Remind me before each stop')).toBeNull();
  });
});
