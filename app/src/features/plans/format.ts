import { formatTime } from '@/components/form/time-field';
import type { Activity, Plan } from '@/types/api';

const ActivityNames: Record<Activity, string> = {
  dinner: 'Dinner',
  drinks: 'Drinks',
  club: 'Club',
  concert: 'Concert',
  cinema: 'Cinema',
  games: 'Games',
  outdoor: 'Outdoor',
};

export function activityName(activity: Activity) {
  return ActivityNames[activity];
}

/** "20:30–22:00" in the device's time zone. */
export function formatTimeRange(start: string, end: string) {
  return `${formatTime(new Date(start))}–${formatTime(new Date(end))}`;
}

/** EUR with cents; missing amounts are unknown, never free. */
export function formatEuros(amount: number | null | undefined) {
  return amount == null ? 'price unknown' : `€${amount.toFixed(2)}`;
}

/** "850 m" below a kilometre, "1.3 km" above. */
export function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/** "Fri 30 Oct": the night a plan is for. */
export function formatNightDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** Stop count, estimated per-person cost and distance. */
export function planSummaryLine(plan: Plan) {
  const stops = `${plan.items.length} ${plan.items.length === 1 ? 'stop' : 'stops'}`;
  const cost =
    plan.estimatedCostPerPerson == null
      ? 'price unknown'
      : `estimated ${formatEuros(plan.estimatedCostPerPerson)} per person`;
  return `${stops} · ${cost} · ${formatDistance(plan.totalDistanceKm)}`;
}
