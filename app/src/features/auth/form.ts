import type { LoginRequest, RegisterRequest } from '@/types/api';

/**
 * Limits for the account forms. The API enforces the same limits (`AuthLimits` in
 * backend/src/LinkUp.Api/Dtos/AuthDtos.cs), so keep both in sync.
 */
export const AuthLimits = {
  emailMaxLength: 254,
  passwordMinLength: 8,
  passwordMaxLength: 128,
  displayNameMaxLength: 50,
} as const;

export type AuthForm = {
  email: string;
  password: string;
  /** Only used when registering. */
  displayName: string;
};

export type AuthErrors = Partial<Record<keyof AuthForm, string>>;

export const emptyAuthForm: AuthForm = { email: '', password: '', displayName: '' };

// Deliberately as lenient as the server's check: something@something. Real validation is the server's.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (!value) return 'Enter your email.';
  if (value.length > AuthLimits.emailMaxLength || !EMAIL_PATTERN.test(value)) {
    return 'Enter a valid email address.';
  }
}

export function validateLogin(form: AuthForm): AuthErrors {
  const errors: AuthErrors = {};

  const email = validateEmail(form.email);
  if (email) errors.email = email;

  if (!form.password) errors.password = 'Enter your password.';
  else if (form.password.length > AuthLimits.passwordMaxLength) {
    errors.password = `Passwords are at most ${AuthLimits.passwordMaxLength} characters.`;
  }

  return errors;
}

export function validateRegister(form: AuthForm): AuthErrors {
  const errors: AuthErrors = {};

  const email = validateEmail(form.email);
  if (email) errors.email = email;

  if (form.password.length < AuthLimits.passwordMinLength) {
    errors.password = `Use at least ${AuthLimits.passwordMinLength} characters.`;
  } else if (form.password.length > AuthLimits.passwordMaxLength) {
    errors.password = `Use at most ${AuthLimits.passwordMaxLength} characters.`;
  }

  const displayName = form.displayName.trim();
  if (!displayName) errors.displayName = 'Enter a name.';
  else if (displayName.length > AuthLimits.displayNameMaxLength) {
    errors.displayName = `Use at most ${AuthLimits.displayNameMaxLength} characters.`;
  }

  return errors;
}

/** Passwords are sent exactly as typed: spaces can be part of one. */
export function toLoginRequest(form: AuthForm): LoginRequest {
  return { email: form.email.trim(), password: form.password };
}

export function toRegisterRequest(form: AuthForm): RegisterRequest {
  return { ...toLoginRequest(form), displayName: form.displayName.trim() };
}
