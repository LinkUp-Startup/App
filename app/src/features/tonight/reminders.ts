import * as Notifications from 'expo-notifications';

import { formatTime } from '@/components/form/format-time';
import { formatDistance } from '@/features/plans/format';
import type { Plan } from '@/types/api';

// Reminders before each stop (#249): local notifications scheduled on the phone, so they also come when the app
// is closed and need no server. Which reminders are on is read back from the phone's own schedule.

/** Time to get ready, before the walk to the stop. */
export const LEAD_MINUTES = 15;
/** About 5 km/h. */
const WALK_MINUTES_PER_KM = 12;
const MINUTE = 60_000;

const prefix = (planId: string) => `linkup-reminder:${planId}:`;

export function walkingMinutes(km: number): number {
  return km > 0 ? Math.ceil(km * WALK_MINUTES_PER_KM) : 0;
}

export type Reminder = { identifier: string; at: Date; title: string; body: string };

/** One reminder per stop that is still to come: 15 minutes plus the walk from the previous stop before it starts. */
export function planReminders(plan: Plan, now: Date): Reminder[] {
  return plan.items.flatMap((item, index) => {
    const start = new Date(item.startTime);
    const walk = walkingMinutes(item.distanceKm);
    const at = new Date(start.getTime() - (LEAD_MINUTES + walk) * MINUTE);
    if (at <= now) return [];
    const body =
      walk > 0
        ? `Head out in ${LEAD_MINUTES} min: it's ${walk} min on foot (${formatDistance(item.distanceKm)}).`
        : `It starts in ${LEAD_MINUTES} min.`;
    return [
      {
        identifier: `${prefix(plan.id)}${index}`,
        at,
        title: `${item.venue.name} at ${formatTime(start)}`,
        body,
      },
    ];
  });
}

async function scheduledFor(planId: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.filter((request) => request.identifier.startsWith(prefix(planId)));
}

export async function remindersOn(planId: string): Promise<boolean> {
  return (await scheduledFor(planId)).length > 0;
}

export async function turnOffReminders(planId: string): Promise<void> {
  for (const request of await scheduledFor(planId))
    await Notifications.cancelScheduledNotificationAsync(request.identifier);
}

export type TurnOnResult = 'on' | 'denied' | 'nothing-left';

export async function turnOnReminders(plan: Plan, now = new Date()): Promise<TurnOnResult> {
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain)
    permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return 'denied';

  await turnOffReminders(plan.id);
  const reminders = planReminders(plan, now);
  if (reminders.length === 0) return 'nothing-left';
  for (const reminder of reminders)
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.identifier,
      content: { title: reminder.title, body: reminder.body, data: { planId: plan.id } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at },
    });
  return 'on';
}

/** The plan a tapped reminder belongs to, if it is one of ours. */
export function reminderPlanId(response: Notifications.NotificationResponse | null | undefined) {
  const planId = response?.notification.request.content.data?.planId;
  return typeof planId === 'string' ? planId : null;
}
