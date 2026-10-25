import type { Activity, GeoPoint, NightPreferences, Transport } from '@/types/api';

/**
 * Limits for the preference form. The API enforces the same limits (backend/src/LinkUp.Api/Dtos/NightPreferencesDto.cs),
 * so keep both in sync.
 */
export const Limits = {
  budget: { min: 0, max: 500 },
  groupSize: { min: 1, max: 20 },
  maxDistanceKm: { min: 0.5, max: 30, step: 0.5 },
  durationHours: { min: 1, max: 12 },
  notesMaxLength: 500,
} as const;

/** Labels per option. Typed against the generated API enums, so a new backend value fails to compile here. */
export const ActivityLabels: Record<Activity, string> = {
  dinner: 'Dinner',
  drinks: 'Drinks',
  club: 'Club',
  concert: 'Concert',
  cinema: 'Cinema',
  games: 'Games',
  outdoor: 'Outdoors',
};

export const TransportLabels: Record<Transport, string> = {
  walking: 'Walking',
  bike: 'Bike',
  car: 'Car',
  publicTransport: 'Public transport',
  taxi: 'Taxi',
};

/** Form state. Budget stays a string while typing so partial input like "12." isn't lost. */
export type PreferencesForm = {
  budget: string;
  groupSize: number;
  activities: Activity[];
  startTime: Date;
  endTime: Date;
  maxDistanceKm: number;
  transport: Transport[];
  notes: string;
  /** Where the group starts, picked on the map. Unset means distance isn't used. */
  startLocation?: GeoPoint;
};

export type FormErrors = Partial<Record<keyof PreferencesForm, string>>;

const HOUR = 60 * 60 * 1000;

/** Tonight 20:00 to 00:00, or the next full hour if it's already later than 20:00. */
export function defaultForm(now: Date = new Date()): PreferencesForm {
  const start = new Date(now);
  start.setHours(20, 0, 0, 0);
  if (start.getTime() < now.getTime()) {
    start.setTime(now.getTime());
    start.setMinutes(0, 0, 0);
    start.setTime(start.getTime() + HOUR);
  }

  return {
    budget: '30',
    groupSize: 2,
    activities: [],
    startTime: start,
    endTime: new Date(start.getTime() + 4 * HOUR),
    maxDistanceKm: 3,
    transport: ['walking'],
    notes: '',
  };
}

/** The end time is picked as a time of day: if it is not after the start, it means the next day. */
export function resolveEndTime(startTime: Date, endTime: Date): Date {
  const end = new Date(startTime);
  end.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
  if (end.getTime() <= startTime.getTime()) end.setDate(end.getDate() + 1);
  return end;
}

/** Parses "30", "12.5" or "12,5" (comma decimal, common in Spain). */
export function parseAmount(value: string): number | undefined {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return undefined;
  return Number(normalized);
}

export function validate(form: PreferencesForm): FormErrors {
  const errors: FormErrors = {};

  const budget = parseAmount(form.budget);
  if (form.budget.trim() === '') {
    errors.budget = 'Enter a budget per person.';
  } else if (budget === undefined) {
    errors.budget = 'Enter an amount in euros, e.g. 25 or 12.50.';
  } else if (budget > Limits.budget.max) {
    errors.budget = `Budget can be at most €${Limits.budget.max} per person.`;
  }

  if (form.groupSize < Limits.groupSize.min || form.groupSize > Limits.groupSize.max) {
    errors.groupSize = `Group size must be between ${Limits.groupSize.min} and ${Limits.groupSize.max}.`;
  }

  if (form.activities.length === 0) {
    errors.activities = 'Pick at least one activity.';
  }

  const end = resolveEndTime(form.startTime, form.endTime);
  const hours = (end.getTime() - form.startTime.getTime()) / HOUR;
  if (hours < Limits.durationHours.min) {
    errors.endTime = `Plan at least ${Limits.durationHours.min} hour.`;
  } else if (hours > Limits.durationHours.max) {
    errors.endTime = `A night can be at most ${Limits.durationHours.max} hours.`;
  }

  if (
    form.maxDistanceKm < Limits.maxDistanceKm.min ||
    form.maxDistanceKm > Limits.maxDistanceKm.max
  ) {
    errors.maxDistanceKm = `Distance must be between ${Limits.maxDistanceKm.min} and ${Limits.maxDistanceKm.max} km.`;
  }

  if (form.transport.length === 0) {
    errors.transport = 'Pick at least one way to get around.';
  }

  if (form.notes.length > Limits.notesMaxLength) {
    errors.notes = `Keep notes under ${Limits.notesMaxLength} characters.`;
  }

  return errors;
}

/** Converts a valid form into the API request. Call `validate` first. */
export function toNightPreferences(form: PreferencesForm): NightPreferences {
  const notes = form.notes.trim();
  return {
    budgetPerPerson: parseAmount(form.budget) ?? 0,
    groupSize: form.groupSize,
    activities: form.activities,
    startTime: form.startTime.toISOString(),
    endTime: resolveEndTime(form.startTime, form.endTime).toISOString(),
    maxDistanceKm: form.maxDistanceKm,
    transport: form.transport,
    ...(notes && { notes }),
    ...(form.startLocation && { startLocation: form.startLocation }),
  };
}
