import { act, renderHook } from '@testing-library/react-native';

import { emptyDefaults } from '@/features/preferences/defaults-form';
import { defaultForm } from '@/features/preferences/form';
import { savedPlanFields } from '@/features/preferences/plan-prefill';
import { usePreferencesForm } from '@/features/preferences/use-preferences-form';
import type { UserPreferences } from '@/types/api';

const initial = defaultForm(new Date(2026, 10, 20, 12));
const saved: UserPreferences = {
  budgetPerPerson: 0,
  groupSize: 5,
  maxDistanceKm: 5.25,
  activities: ['dinner', 'drinks'],
  transport: ['bike', 'car'],
};

it('maps all five fields, preserving zero and kilometres without sharing arrays', () => {
  const fields = savedPlanFields(saved, initial);
  expect(fields).toEqual({
    budget: '0',
    groupSize: 5,
    maxDistanceKm: 5.25,
    activities: ['dinner', 'drinks'],
    transport: ['bike', 'car'],
  });
  expect(fields.activities).not.toBe(saved.activities);
  expect(fields.transport).not.toBe(saved.transport);
});

it.each([emptyDefaults(), { ...emptyDefaults(), activities: [], transport: [] }])(
  'keeps application defaults for unspecified and empty selections',
  (values) => {
    expect(savedPlanFields(values, initial)).toEqual({
      budget: initial.budget,
      groupSize: initial.groupSize,
      maxDistanceKm: initial.maxDistanceKm,
      activities: initial.activities,
      transport: initial.transport,
    });
  },
);

it('keeps dates, notes and location outside of saved defaults', async () => {
  const draft = {
    ...initial,
    notes: 'vegetarian',
    startLocation: { latitude: 41.6, longitude: 0.6 },
  };
  const { result } = await renderHook(() => usePreferencesForm(draft));
  await act(() => result.current.applyDefaults(saved));
  expect(result.current.form).toEqual({ ...draft, ...savedPlanFields(saved, initial) });
  expect(result.current.hasDraft()).toBe(false);
});

it('protects each edited field while still prefilling untouched fields', async () => {
  const { result } = await renderHook(() => usePreferencesForm(initial));
  await act(() => {
    result.current.setField('budget', '100');
    result.current.setField('notes', 'quiet');
  });
  await act(() => result.current.applyDefaults(saved));
  expect(result.current.form).toMatchObject({
    budget: '100',
    groupSize: 5,
    maxDistanceKm: 5.25,
    notes: 'quiet',
    activities: ['dinner', 'drinks'],
  });
  expect(result.current.hasDraft()).toBe(true);
  await act(() => {
    result.current.setField('groupSize', 2);
    result.current.setField('maxDistanceKm', 3);
    result.current.setField('activities', []);
    result.current.setField('transport', ['walking']);
  });
  await act(() => result.current.applyDefaults(saved));
  expect(result.current.form).toMatchObject({
    budget: '100',
    groupSize: 2,
    maxDistanceKm: 3,
    activities: [],
    transport: ['walking'],
  });
});

it('cleared saved defaults restore the original application defaults, not earlier saved values', async () => {
  const { result } = await renderHook(() => usePreferencesForm(initial));
  await act(() => result.current.applyDefaults(saved));
  await act(() => result.current.applyDefaults(emptyDefaults()));
  expect(result.current.form).toEqual(initial);
});

it('freezes initialization after even an invalid submission and preserves validation', async () => {
  const { result } = await renderHook(() => usePreferencesForm(initial));
  await act(() => result.current.submit(jest.fn()));
  await act(() => result.current.applyDefaults(saved));
  expect(result.current.form).toEqual(initial);
  expect(result.current.hasDraft()).toBe(true);
  expect(result.current.errors.activities).toBeDefined();
});
