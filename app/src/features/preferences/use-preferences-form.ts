import { useCallback, useMemo, useRef, useState } from 'react';

import {
  defaultForm,
  toNightPreferences,
  validate,
  type FormErrors,
  type PreferencesForm,
} from '@/features/preferences/form';
import { savedPlanFields } from '@/features/preferences/plan-prefill';
import type { NightPreferences, UserPreferences } from '@/types/api';

/**
 * State for the preference form. Errors stay hidden until the first submit attempt,
 * then update live as the user fixes them.
 */
export function usePreferencesForm(initial: PreferencesForm = defaultForm()) {
  const [form, setForm] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const initialForm = useRef(initial);
  const edited = useRef(new Set<keyof PreferencesForm>());
  const attemptedSubmit = useRef(false);

  const errors = useMemo(() => validate(form), [form]);
  const visibleErrors: FormErrors = submitted ? errors : {};

  const setField = useCallback(
    <K extends keyof PreferencesForm>(key: K, value: PreferencesForm[K]) => {
      edited.current.add(key);
      setForm((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  // Called only by the loader. Per-field edits always win, including while its request is in flight.
  const applyDefaults = useCallback((saved: UserPreferences) => {
    const fields = savedPlanFields(saved, initialForm.current);
    setForm((current) => {
      if (attemptedSubmit.current) return current;
      return {
        ...current,
        ...Object.fromEntries(
          Object.entries(fields).filter(
            ([key]) => !edited.current.has(key as keyof PreferencesForm),
          ),
        ),
      };
    });
  }, []);

  const hasDraft = useCallback(() => edited.current.size > 0 || attemptedSubmit.current, []);

  /** Validates and, when valid, calls `onValid` with the API request. Returns whether it was valid. */
  const submit = useCallback(
    (onValid: (preferences: NightPreferences) => void) => {
      attemptedSubmit.current = true;
      setSubmitted(true);
      if (Object.keys(errors).length > 0) return false;
      onValid(toNightPreferences(form));
      return true;
    },
    [errors, form],
  );

  return { form, errors: visibleErrors, setField, submit, applyDefaults, hasDraft };
}

/** Adds the item if missing, removes it if present. */
export function toggle<T>(items: readonly T[], item: T): T[] {
  return items.includes(item) ? items.filter((i) => i !== item) : [...items, item];
}
