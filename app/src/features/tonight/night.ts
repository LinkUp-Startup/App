import type { Plan, PlanItem } from '@/types/api';

// Tonight mode (#228): where you are in a plan's night at a given moment. Pure, so it can be tested with any clock.

const MINUTE = 60_000;
/** A plan counts as "tonight" from this long before its first stop until its last stop ends. */
const OFFER_BEFORE = 12 * 60 * MINUTE;

export type Stop = { item: PlanItem; index: number };

export type NightMoment =
  /** Before the first stop. */
  | { phase: 'before'; next: Stop; startsInMs: number }
  /** At a stop; `next` is null at the last one. */
  | { phase: 'at'; current: Stop; endsInMs: number; next: Stop | null }
  /** On the way from one stop to the next. */
  | { phase: 'between'; next: Stop; startsInMs: number }
  /** After the last stop. */
  | { phase: 'over' };

const time = (iso: string) => new Date(iso).getTime();

export function nightMoment(plan: Plan, now: Date): NightMoment {
  const at = now.getTime();
  const stops = plan.items.map((item, index) => ({ item, index }));
  const current = stops.find(({ item }) => time(item.startTime) <= at && at < time(item.endTime));
  if (current)
    return {
      phase: 'at',
      current,
      endsInMs: time(current.item.endTime) - at,
      next: stops[current.index + 1] ?? null,
    };
  const next = stops.find(({ item }) => at < time(item.startTime));
  if (!next) return { phase: 'over' };
  return {
    phase: next.index === 0 ? 'before' : 'between',
    next,
    startsInMs: time(next.item.startTime) - at,
  };
}

/** True from 12 hours before the first stop until the last stop ends: when Tonight mode is worth offering. */
export function isTonight(plan: Plan, now: Date): boolean {
  const first = plan.items[0];
  const last = plan.items.at(-1);
  if (!first || !last) return false;
  const at = now.getTime();
  return at < time(last.endTime) && time(first.startTime) - at <= OFFER_BEFORE;
}

/** "now", "5 min", "1 h", "1 h 20 min": rounded up, so a countdown never says "now" too early. */
export function formatCountdown(ms: number): string {
  const minutes = Math.ceil(ms / MINUTE);
  if (minutes <= 0) return 'now';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
