import * as Notifications from 'expo-notifications';

import { tapasPlan } from '@/features/plans/__tests__/fixtures/plans';
import {
  planReminders,
  reminderPlanId,
  remindersOn,
  turnOffReminders,
  turnOnReminders,
  walkingMinutes,
} from '@/features/tonight/reminders';

// tapasPlan: Teresa Carles 19:30 UTC (no walk), Pub Legend 21:15 UTC, 0.91 km from the first stop.
const before = new Date('2026-10-30T12:00:00Z');
const otherPlan = { ...tapasPlan, id: 'p2' };

afterEach(() => jest.clearAllMocks());

describe('walkingMinutes', () => {
  it.each([
    [0, 0],
    [-1, 0],
    [0.91, 11],
    [1, 12],
    [2.5, 30],
  ])('%d km is %d min', (km, minutes) => {
    expect(walkingMinutes(km)).toBe(minutes);
  });
});

describe('planReminders', () => {
  it('reminds 15 minutes plus the walk before each stop', () => {
    const [first, second] = planReminders(tapasPlan, before);

    expect(first).toMatchObject({
      identifier: 'linkup-reminder:p1:0',
      at: new Date('2026-10-30T19:15:00Z'),
      title: expect.stringMatching(/^Teresa Carles at /),
      body: 'It starts in 15 min.',
    });
    expect(second).toMatchObject({
      identifier: 'linkup-reminder:p1:1',
      at: new Date('2026-10-30T20:49:00Z'),
      body: "Head out in 15 min: it's 11 min on foot (910 m).",
    });
  });

  it('leaves out reminders whose time has passed', () => {
    const reminders = planReminders(tapasPlan, new Date('2026-10-30T19:15:00Z'));

    expect(reminders.map((reminder) => reminder.identifier)).toEqual(['linkup-reminder:p1:1']);
  });
});

describe('turnOnReminders', () => {
  it('schedules a reminder per stop that opens the plan', async () => {
    await expect(turnOnReminders(tapasPlan, before)).resolves.toBe('on');

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'linkup-reminder:p1:1',
      content: {
        title: expect.stringMatching(/^Pub Legend at /),
        body: "Head out in 15 min: it's 11 min on foot (910 m).",
        data: { planId: 'p1' },
      },
      trigger: { type: 'date', date: new Date('2026-10-30T20:49:00Z') },
    });
    await expect(remindersOn('p1')).resolves.toBe(true);
  });

  it('replaces the reminders of the plan instead of adding them twice', async () => {
    await turnOnReminders(tapasPlan, before);
    await turnOnReminders(tapasPlan, new Date('2026-10-30T20:00:00Z'));

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    expect(scheduled.map((request) => request.identifier)).toEqual(['linkup-reminder:p1:1']);
  });

  it('asks for permission when it may', async () => {
    jest
      .mocked(Notifications.getPermissionsAsync)
      .mockResolvedValue({ granted: false, canAskAgain: true } as never);

    await expect(turnOnReminders(tapasPlan, before)).resolves.toBe('on');
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  it('schedules nothing without permission', async () => {
    jest
      .mocked(Notifications.getPermissionsAsync)
      .mockResolvedValue({ granted: false, canAskAgain: false } as never);

    await expect(turnOnReminders(tapasPlan, before)).resolves.toBe('denied');
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('says so when every stop has started', async () => {
    await expect(turnOnReminders(tapasPlan, new Date('2026-10-30T22:00:00Z'))).resolves.toBe(
      'nothing-left',
    );
    await expect(remindersOn('p1')).resolves.toBe(false);
  });

  it('uses the time now by default', async () => {
    await expect(turnOnReminders(tapasPlan)).resolves.toBe('nothing-left');
  });
});

describe('turnOffReminders', () => {
  it('cancels only the reminders of that plan', async () => {
    await turnOnReminders(tapasPlan, before);
    await turnOnReminders(otherPlan, before);

    await turnOffReminders('p1');

    await expect(remindersOn('p1')).resolves.toBe(false);
    await expect(remindersOn('p2')).resolves.toBe(true);
  });
});

describe('reminderPlanId', () => {
  const response = (data: object) =>
    ({ notification: { request: { content: { data } } } }) as Notifications.NotificationResponse;

  it('reads the plan of one of our reminders', () => {
    expect(reminderPlanId(response({ planId: 'p1' }))).toBe('p1');
  });

  it('ignores other notifications and no notification', () => {
    expect(reminderPlanId(response({}))).toBeNull();
    expect(reminderPlanId(null)).toBeNull();
    expect(reminderPlanId(undefined)).toBeNull();
  });
});
