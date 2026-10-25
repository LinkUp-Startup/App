import { ApiError, NetworkError } from '@/api/client';
import { parseValidationErrors } from '@/api/errors';

export type AuthMode = 'login' | 'register';

/** A message for the user explaining why logging in or registering failed. */
export function describeAuthError(error: unknown, mode: AuthMode): string {
  if (error instanceof NetworkError) {
    return "Can't reach LinkUp right now. Check your internet connection and try again.";
  }

  if (error instanceof ApiError) {
    // One message for both "no such account" and "wrong password": the server doesn't say which.
    if (error.status === 401 && mode === 'login') return 'Wrong email or password.';
    if (error.status === 409) {
      return 'An account with this email already exists. Try logging in instead.';
    }
    if (error.status === 400) {
      const details = parseValidationErrors(error.message);
      return details.length > 0
        ? `Some details weren't accepted: ${details.join(' ')}`
        : "Some details weren't accepted. Check the form and try again.";
    }
    if (error.status >= 500) {
      return 'Something went wrong on our side. Try again in a moment.';
    }
  }

  return 'Something unexpected went wrong. Try again.';
}
