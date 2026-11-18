import * as Calendar from 'expo-calendar/legacy';
import { Platform } from 'react-native';

import { activityName, directionsUrl, formatEuros } from '@/features/plans/format';
import type { Plan } from '@/types/api';

// Add to calendar (#227): every stop of a plan becomes an event in the phone's own calendar.
// expo-calendar's legacy API, because the new one doesn't run in Expo Go.

export type AddToCalendarResult =
  { status: 'added'; count: number } | { status: 'denied' } | { status: 'no-calendar' };

/** The calendar new events go to: the default one on iOS, the primary writable one on Android. */
async function pickCalendar(): Promise<string | null> {
  if (Platform.OS === 'ios') return (await Calendar.getDefaultCalendarAsync()).id;
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.filter((calendar) => calendar.allowsModifications);
  return (writable.find((calendar) => calendar.isPrimary) ?? writable[0])?.id ?? null;
}

export async function addPlanToCalendar(plan: Plan): Promise<AddToCalendarResult> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') return { status: 'denied' };

  const calendarId = await pickCalendar();
  if (!calendarId) return { status: 'no-calendar' };

  for (const item of plan.items) {
    const { venue } = item;
    const price =
      item.estimatedCostPerPerson == null
        ? 'Price unknown'
        : `About ${formatEuros(item.estimatedCostPerPerson)} per person`;
    await Calendar.createEventAsync(calendarId, {
      title: venue.name,
      startDate: new Date(item.startTime),
      endDate: new Date(item.endTime),
      location: venue.address,
      notes: [
        `${activityName(venue.category)}. ${price}.`,
        `Directions: ${directionsUrl(venue.latitude, venue.longitude)}`,
        `Part of "${plan.title}", planned with LinkUp.`,
      ].join('\n'),
      timeZone: 'Europe/Madrid',
    });
  }
  return { status: 'added', count: plan.items.length };
}
