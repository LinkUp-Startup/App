import { apiRequest } from '@/api/client';
import type { UserPreferences } from '@/types/api';

const path = '/api/users/me/preferences';

export function getUserPreferences(accessToken: string, signal?: AbortSignal) {
  return apiRequest<UserPreferences>(path, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
  });
}

/** PUT replaces every default; null clears a value. No user ID is accepted. */
export function putUserPreferences(
  accessToken: string,
  preferences: UserPreferences,
  signal?: AbortSignal,
) {
  return apiRequest<UserPreferences>(path, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: preferences,
    signal,
  });
}
