import { useCallback, useMemo, useState } from 'react';

import {
  defaultForm,
  toNightPreferences,
  validate,
  type FormErrors,
  type PreferencesForm,
} from '@/features/preferences/form';
import type { NightPreferences } from '@/types/api';

/**
 * State for the preference form. Errors stay hidden until the first submit attempt,
 * then update live as the user fixes them.
 */
export function usePreferencesForm(initial: PreferencesForm = defaultForm()) {
  const [form, setForm] = useState(initial);
  const [submitted, setSubmitted] = useState(false);

  const errors = useMemo(() => validate(form), [form]);
  const visibleErrors: FormErrors = submitted ? errors : {};

  const setField = useCallback(
    <K extends keyof PreferencesForm>(key: K, value: PreferencesForm[K]) =>
      setForm((current) => ({ ...current, [key]: value })),
    [],
  );

  /** Validates and, when valid, calls `onValid` with the API request. Returns whether it was valid. */
  const submit = useCallback(
    (onValid: (preferences: NightPreferences) => void) => {
      setSubmitted(true);
      if (Object.keys(errors).length > 0) return false;
      onValid(toNightPreferences(form));
      return true;
    },
    [errors, form],
  );

  return { form, errors: visibleErrors, setField, submit };
}

/** Adds the item if missing, removes it if present. */
export function toggle<T>(items: readonly T[], item: T): T[] {
  return items.includes(item) ? items.filter((i) => i !== item) : [...items, item];
}
