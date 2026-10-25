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

/** "20:30-22:00" in the device's time zone. */
export function formatTimeRange(start: string, end: string) {
  return `${formatTime(new Date(start))}-${formatTime(new Date(end))}`;
}

/** Prices are estimates, so whole euros. Null means the API doesn't know the price (never shown as €0). */
export function formatEuros(amount: number | null) {
  return amount === null ? 'price unknown' : `~€${Math.round(amount)}`;
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

/** "2 stops · ~€26 per person · 900 m" */
export function planSummaryLine(plan: Plan) {
  const stops = `${plan.items.length} ${plan.items.length === 1 ? 'stop' : 'stops'}`;
  const cost =
    plan.estimatedCostPerPerson === null
      ? 'price unknown'
      : `${formatEuros(plan.estimatedCostPerPerson)} per person`;
  return `${stops} · ${cost} · ${formatDistance(plan.totalDistanceKm)}`;
}
