import { useCallback, useMemo, useState } from 'react';

import { login, register } from '@/api/auth';
import { useAuth } from '@/features/auth/auth-context';
import { describeAuthError, type AuthMode } from '@/features/auth/errors';
import {
  emptyAuthForm,
  toLoginRequest,
  toRegisterRequest,
  validateLogin,
  validateRegister,
  type AuthErrors,
  type AuthForm,
} from '@/features/auth/form';

/**
 * State for the login and register forms. Field errors stay hidden until the first submit attempt,
 * then update live as the user fixes them. `submit` resolves to true once the user is signed in.
 */
export function useAuthForm(mode: AuthMode) {
  const { signIn } = useAuth();
  const [form, setForm] = useState<AuthForm>(emptyAuthForm);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const errors = useMemo(
    () => (mode === 'login' ? validateLogin(form) : validateRegister(form)),
    [mode, form],
  );
  const visibleErrors: AuthErrors = submitted ? errors : {};

  const setField = useCallback(<K extends keyof AuthForm>(key: K, value: AuthForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setServerError(null);
  }, []);

  const submit = useCallback(async (): Promise<boolean> => {
    if (submitting) return false;
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return false;

    setSubmitting(true);
    setServerError(null);
    try {
      const response =
        mode === 'login'
          ? await login(toLoginRequest(form))
          : await register(toRegisterRequest(form));
      signIn(response);
      return true;
    } catch (error: unknown) {
      setServerError(describeAuthError(error, mode));
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [errors, form, mode, signIn, submitting]);

  return { form, errors: visibleErrors, serverError, submitting, setField, submit };
}
