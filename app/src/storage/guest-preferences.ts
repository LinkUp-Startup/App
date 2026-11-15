import AsyncStorage from '@react-native-async-storage/async-storage';

import { emptyDefaults, isUserPreferences } from '@/features/preferences/defaults-form';
import type { UserPreferences } from '@/types/api';

const KEY = 'linkup.guestPreferences.v1';

/** Guest-only data. Account login/logout never reads, writes, or synchronizes this key. */
export async function loadGuestPreferences(): Promise<UserPreferences> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return emptyDefaults();
  try {
    const stored: unknown = JSON.parse(raw);
    if (
      stored &&
      typeof stored === 'object' &&
      'version' in stored &&
      stored.version === 1 &&
      'preferences' in stored &&
      isUserPreferences(stored.preferences)
    )
      return stored.preferences;
  } catch {
    // Corrupted/old data is treated as unspecified. The next successful save replaces it.
  }
  return emptyDefaults();
}

export function saveGuestPreferences(preferences: UserPreferences): Promise<void> {
  return AsyncStorage.setItem(KEY, JSON.stringify({ version: 1, preferences }));
}
