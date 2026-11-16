import {
  defaultsToForm,
  emptyDefaults,
  formToDefaults,
  isUserPreferences,
  validateDefaults,
} from '@/features/preferences/defaults-form';
import { Limits } from '@/features/preferences/form';
import type { Activity, Transport } from '@/types/api';

const blank = () => defaultsToForm(emptyDefaults());

it('keeps missing values distinct from zero and maps deselected options to null', () => {
  expect(validateDefaults(blank())).toEqual({});
  expect(formToDefaults(blank())).toEqual(emptyDefaults());
  const form = { ...blank(), budget: '0', groupSize: '1', maxDistanceKm: '0,5' };
  expect(validateDefaults(form)).toEqual({});
  expect(formToDefaults(form)).toEqual({
    ...emptyDefaults(),
    budgetPerPerson: 0,
    groupSize: 1,
    maxDistanceKm: 0.5,
  });
});

it('round trips all fields, including multiple selections and decimal commas', () => {
  const form = {
    ...blank(),
    budget: '25,75',
    groupSize: '4',
    maxDistanceKm: '5.25',
    activities: ['dinner', 'outdoor'] as Activity[],
    transport: ['walking', 'bike'] as Transport[],
  };
  expect(validateDefaults(form)).toEqual({});
  expect(defaultsToForm(formToDefaults(form))).toEqual({ ...form, budget: '25.75' });
});

it.each(['-1', '-0.01', '500.01', '501', 'NaN', 'Infinity', '1e2', 'abc', '12.345', '.'])(
  'rejects invalid budget %s',
  (budget) => {
    expect(validateDefaults({ ...blank(), budget }).budget).toBeDefined();
  },
);
it.each(['-1', '0', '21', '1.5', 'NaN', 'Infinity', '1e1'])(
  'rejects invalid group size %s',
  (groupSize) => {
    expect(validateDefaults({ ...blank(), groupSize }).groupSize).toBeDefined();
  },
);
it.each(['-1', '0', '0.49', '30.01', 'NaN', 'Infinity', '1e999', '.'])(
  'rejects invalid radius %s',
  (maxDistanceKm) => {
    expect(validateDefaults({ ...blank(), maxDistanceKm }).maxDistanceKm).toBeDefined();
  },
);
it('rejects unknown and duplicate selections', () => {
  expect(
    validateDefaults({
      ...blank(),
      activities: ['unknown'] as unknown as Activity[],
      transport: ['spaceship'] as unknown as Transport[],
    }),
  ).toHaveProperty('activities');
  expect(
    validateDefaults({ ...blank(), activities: ['dinner', 'dinner'], transport: ['bike', 'bike'] }),
  ).toEqual({ activities: expect.any(String), transport: expect.any(String) });
});
it.each([0, 500])('accepts valid budget boundaries %s', (budget) => {
  expect(
    validateDefaults({ ...blank(), budget: String(budget), groupSize: '20', maxDistanceKm: '30' }),
  ).toEqual({});
});
it('treats whitespace-only numeric fields as unspecified', () => {
  expect(formToDefaults({ ...blank(), budget: ' ', groupSize: ' ', maxDistanceKm: ' ' })).toEqual(
    emptyDefaults(),
  );
});

it.each([
  null,
  [],
  'bad',
  42,
  {},
  { ...emptyDefaults(), groupSize: '2' },
  { ...emptyDefaults(), budgetPerPerson: NaN },
  { ...emptyDefaults(), maxDistanceKm: Infinity },
  { ...emptyDefaults(), activities: [null] },
  { ...emptyDefaults(), transport: ['unknown'] },
  { ...emptyDefaults(), activities: 'dinner' },
  { ...emptyDefaults(), groupSize: 0 },
  { ...emptyDefaults(), transport: ['bike', 'bike'] },
])('rejects unsafe stored data %#', (value) => {
  expect(isUserPreferences(value)).toBe(false);
});
it('accepts nullable defaults and legacy empty selections without inventing choices', () => {
  expect(isUserPreferences(emptyDefaults())).toBe(true);
  expect(isUserPreferences({ ...emptyDefaults(), activities: [], transport: [] })).toBe(true);
});
it('uses existing numeric form limits', () => {
  expect(Limits.budget).toEqual({ min: 0, max: 500 });
  expect(Limits.groupSize).toEqual({ min: 1, max: 20 });
  expect(Limits.maxDistanceKm).toMatchObject({ min: 0.5, max: 30 });
});

declare const __dirname: string;
it('keeps frontend bounds synchronized with the shared API validator', () => {
  const fs = jest.requireActual<{ readFileSync(path: string, encoding: 'utf8'): string }>(
    'node:fs',
  );
  const path = jest.requireActual<{ resolve(...parts: string[]): string }>('node:path');
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../../../../backend/src/LinkUp.Api/Dtos/PreferenceRules.cs'),
    'utf8',
  );
  for (const [name, value] of [
    ['MinBudget', Limits.budget.min],
    ['MaxBudget', Limits.budget.max],
    ['MinGroupSize', Limits.groupSize.min],
    ['MaxGroupSize', Limits.groupSize.max],
    ['MinDistanceKm', Limits.maxDistanceKm.min],
    ['MaxDistanceKm', Limits.maxDistanceKm.max],
  ] as const) {
    const match = new RegExp(`const (?:int|double|string) ${name}\\s*=\\s*"?([\\d.]+)`).exec(
      source,
    );
    expect(Number(match?.[1])).toBe(value);
  }
});
