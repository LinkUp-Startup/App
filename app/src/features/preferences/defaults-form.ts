import { ActivityLabels, Limits, parseAmount, TransportLabels } from '@/features/preferences/form';
import type { Activity, Transport, UserPreferences } from '@/types/api';

export type DefaultsForm = {
  budget: string;
  groupSize: string;
  maxDistanceKm: string;
  activities: Activity[];
  transport: Transport[];
};
export type DefaultsErrors = Partial<Record<keyof DefaultsForm, string>>;

export function emptyDefaults(): UserPreferences {
  return {
    budgetPerPerson: null,
    groupSize: null,
    maxDistanceKm: null,
    activities: null,
    transport: null,
  };
}

export function defaultsToForm(values: UserPreferences): DefaultsForm {
  return {
    budget: values.budgetPerPerson == null ? '' : String(values.budgetPerPerson),
    groupSize: values.groupSize == null ? '' : String(values.groupSize),
    maxDistanceKm: values.maxDistanceKm == null ? '' : String(values.maxDistanceKm),
    activities: [...(values.activities ?? [])],
    transport: [...(values.transport ?? [])],
  };
}

function parseDistance(value: string): number {
  const normalized = value.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

function validSelection<T extends string>(values: readonly T[], labels: Record<T, string>) {
  return (
    new Set(values).size === values.length && values.every((value) => Object.hasOwn(labels, value))
  );
}

export function validateDefaults(form: DefaultsForm): DefaultsErrors {
  const errors: DefaultsErrors = {};
  if (form.budget.trim() !== '') {
    const budget = parseAmount(form.budget);
    if (budget === undefined || !Number.isFinite(budget) || budget > Limits.budget.max)
      errors.budget = `Enter a budget from €0 to €${Limits.budget.max}, with up to two decimal places.`;
  }
  if (form.groupSize.trim() !== '') {
    const size = Number(form.groupSize);
    if (
      !/^\d+$/.test(form.groupSize.trim()) ||
      !Number.isInteger(size) ||
      size < Limits.groupSize.min ||
      size > Limits.groupSize.max
    )
      errors.groupSize = `Enter a whole number from ${Limits.groupSize.min} to ${Limits.groupSize.max}.`;
  }
  if (form.maxDistanceKm.trim() !== '') {
    const radius = parseDistance(form.maxDistanceKm);
    if (
      !Number.isFinite(radius) ||
      radius < Limits.maxDistanceKm.min ||
      radius > Limits.maxDistanceKm.max
    )
      errors.maxDistanceKm = `Enter a distance from ${Limits.maxDistanceKm.min} to ${Limits.maxDistanceKm.max} km.`;
  }
  if (!validSelection(form.activities, ActivityLabels))
    errors.activities = 'Choose supported activities without duplicates.';
  if (!validSelection(form.transport, TransportLabels))
    errors.transport = 'Choose supported transport without duplicates.';
  return errors;
}

/** Call validation first. No selected options means an unspecified default, sent as null for PUT. */
export function formToDefaults(form: DefaultsForm): UserPreferences {
  return {
    budgetPerPerson: form.budget.trim() === '' ? null : parseAmount(form.budget)!,
    groupSize: form.groupSize.trim() === '' ? null : Number(form.groupSize),
    maxDistanceKm: form.maxDistanceKm.trim() === '' ? null : parseDistance(form.maxDistanceKm),
    activities: form.activities.length ? [...form.activities] : null,
    transport: form.transport.length ? [...form.transport] : null,
  };
}

/** Runtime check for untrusted device data. Missing/outdated fields never become invented defaults. */
export function isUserPreferences(value: unknown): value is UserPreferences {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  if (
    !['budgetPerPerson', 'groupSize', 'maxDistanceKm'].every(
      (key) => data[key] === null || (typeof data[key] === 'number' && Number.isFinite(data[key])),
    )
  )
    return false;
  if (
    !['activities', 'transport'].every(
      (key) =>
        data[key] === null ||
        (Array.isArray(data[key]) && data[key].every((item: unknown) => typeof item === 'string')),
    )
  )
    return false;
  return Object.keys(validateDefaults(defaultsToForm(value as UserPreferences))).length === 0;
}
