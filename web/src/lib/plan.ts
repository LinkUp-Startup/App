import type { RouteStop } from '@/components/route';
import type { Plan } from './api';
import { formatDay, formatTime } from './format';

export const toRouteStops = (plan: Plan): RouteStop[] =>
  plan.items.map((item) => ({
    name: item.venue.name,
    activity: item.venue.category,
    address: item.venue.address,
    latitude: item.venue.latitude,
    longitude: item.venue.longitude,
    startTime: item.startTime,
    endTime: item.endTime,
    costPerPerson: item.estimatedCostPerPerson,
    distanceKm: item.distanceKm,
  }));

/** "Friday 6 November, 20:30 to 04:00": the night the plan is for, from its first and last stop. */
export function describeWhen(plan: Plan): string {
  const first = plan.items[0];
  const last = plan.items.at(-1);
  if (!first || !last) return '';
  return `${formatDay(first.startTime)}, ${formatTime(first.startTime)} to ${formatTime(last.endTime)}`;
}
