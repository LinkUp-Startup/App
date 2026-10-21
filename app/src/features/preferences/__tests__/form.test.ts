import {
  defaultForm,
  parseAmount,
  resolveEndTime,
  toNightPreferences,
  validate,
  type PreferencesForm,
} from '@/features/preferences/form';

function at(hours: number, minutes = 0, day = 30) {
  return new Date(2026, 9, day, hours, minutes);
}

function validForm(overrides: Partial<PreferencesForm> = {}): PreferencesForm {
  return {
    budget: '30',
    groupSize: 4,
    activities: ['dinner'],
    startTime: at(20),
    endTime: at(23),
    maxDistanceKm: 3,
    transport: ['walking'],
    notes: '',
    ...overrides,
  };
}

describe('defaultForm', () => {
  it('starts tonight at 20:00 for four hours', () => {
    const form = defaultForm(at(15, 30));
    expect(form.startTime).toEqual(at(20));
    expect(form.endTime).toEqual(at(24));
  });

  it('starts at the next full hour when it is already past 20:00', () => {
    const form = defaultForm(at(21, 10));
    expect(form.startTime).toEqual(at(22));
  });

  it('is invalid until an activity is picked', () => {
    expect(Object.keys(validate(defaultForm(at(12))))).toEqual(['activities']);
  });
});

describe('parseAmount', () => {
  it.each([
    ['30', 30],
    ['12.5', 12.5],
    ['12,50', 12.5],
    [' 7 ', 7],
    ['0', 0],
  ])('parses %p', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(['', 'abc', '-5', '1.234', '1e3', '12.'])('rejects %p', (input) => {
    expect(parseAmount(input)).toBeUndefined();
  });
});

describe('resolveEndTime', () => {
  it('keeps an end time later the same evening', () => {
    expect(resolveEndTime(at(20), at(23, 30))).toEqual(at(23, 30));
  });

  it('moves an end time after midnight to the next day', () => {
    expect(resolveEndTime(at(22), at(2))).toEqual(at(2, 0, 31));
  });

  it('treats an end time equal to the start as the next day', () => {
    expect(resolveEndTime(at(20), at(20))).toEqual(at(20, 0, 31));
  });
});

describe('validate', () => {
  it('accepts a valid form', () => {
    expect(validate(validForm())).toEqual({});
  });

  it.each([
    [{ budget: '' }, 'budget', 'Enter a budget'],
    [{ budget: 'ten' }, 'budget', 'amount in euros'],
    [{ budget: '501' }, 'budget', 'at most €500'],
    [{ groupSize: 0 }, 'groupSize', 'between 1 and 20'],
    [{ groupSize: 21 }, 'groupSize', 'between 1 and 20'],
    [{ activities: [] }, 'activities', 'at least one activity'],
    [{ endTime: at(20, 30) }, 'endTime', 'at least 1 hour'],
    [{ startTime: at(8), endTime: at(21) }, 'endTime', 'at most 12 hours'],
    [{ maxDistanceKm: 0 }, 'maxDistanceKm', 'between 0.5 and 30'],
    [{ maxDistanceKm: 31 }, 'maxDistanceKm', 'between 0.5 and 30'],
    [{ transport: [] }, 'transport', 'at least one way'],
    [{ notes: 'x'.repeat(501) }, 'notes', 'under 500'],
  ] as const)('rejects %p', (overrides, field, message) => {
    const errors = validate(validForm(overrides as Partial<PreferencesForm>));
    expect(Object.keys(errors)).toEqual([field]);
    expect(errors[field]).toContain(message);
  });

  it('accepts a budget of 0 and a night across midnight', () => {
    expect(validate(validForm({ budget: '0', startTime: at(22), endTime: at(3) }))).toEqual({});
  });
});

describe('toNightPreferences', () => {
  it('builds the API request', () => {
    const preferences = toNightPreferences(
      validForm({ budget: '12,50', startTime: at(22), endTime: at(2), notes: '  vegetarian ' }),
    );

    expect(preferences).toEqual({
      budgetPerPerson: 12.5,
      groupSize: 4,
      activities: ['dinner'],
      startTime: at(22).toISOString(),
      endTime: at(2, 0, 31).toISOString(),
      maxDistanceKm: 3,
      transport: ['walking'],
      notes: 'vegetarian',
    });
  });

  it('leaves out empty notes', () => {
    expect(toNightPreferences(validForm({ notes: '   ' }))).not.toHaveProperty('notes');
  });
});
