import { act, renderHook } from '@testing-library/react-native';

import { defaultForm } from '@/features/preferences/form';
import { toggle, usePreferencesForm } from '@/features/preferences/use-preferences-form';

const initial = defaultForm(new Date(2026, 9, 30, 12));

describe('usePreferencesForm', () => {
  it('hides errors until the first submit', async () => {
    const { result } = await renderHook(() => usePreferencesForm(initial));

    expect(result.current.errors).toEqual({});

    const onValid = jest.fn();
    await act(() => {
      result.current.submit(onValid);
    });

    expect(onValid).not.toHaveBeenCalled();
    expect(result.current.errors.activities).toBeDefined();
  });

  it('updates errors live after a failed submit and submits once fixed', async () => {
    const { result } = await renderHook(() => usePreferencesForm(initial));
    await act(() => {
      result.current.submit(jest.fn());
    });

    await act(() => {
      result.current.setField('activities', ['drinks']);
    });
    expect(result.current.errors).toEqual({});

    const onValid = jest.fn();
    let valid = false;
    await act(() => {
      valid = result.current.submit(onValid);
    });

    expect(valid).toBe(true);
    expect(onValid).toHaveBeenCalledWith(
      expect.objectContaining({ activities: ['drinks'], budgetPerPerson: 30, groupSize: 2 }),
    );
  });
});

describe('toggle', () => {
  it('adds a missing item and removes a present one', () => {
    expect(toggle(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggle(['a', 'b'], 'a')).toEqual(['b']);
  });
});
