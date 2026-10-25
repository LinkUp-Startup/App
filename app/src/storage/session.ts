import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { AuthResponse } from '@/types/api';

const KEY = 'linkup.session.v1';

/** What is kept between launches: the access token, when it expires, and the account to show. */
export type StoredSession = AuthResponse;

type Backend = {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  remove(): Promise<void>;
};

/** iOS Keychain / Android Keystore. Not backed up or moved to another device. */
const secureBackend: Backend = {
  get: () => SecureStore.getItemAsync(KEY),
  set: (value) =>
    SecureStore.setItemAsync(KEY, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  remove: () => SecureStore.deleteItemAsync(KEY),
};

let memoryValue: string | null = null;

/** Lost when the app closes. */
const memoryBackend: Backend = {
  get: async () => memoryValue,
  set: async (value) => {
    memoryValue = value;
  },
  remove: async () => {
    memoryValue = null;
  },
};

/** Only for previewing the app in a browser during development; see `backend()`. */
const webDevBackend: Backend = {
  get: async () => localStorage.getItem(KEY),
  set: async (value) => localStorage.setItem(KEY, value),
  remove: async () => localStorage.removeItem(KEY),
};

/**
 * Where the session lives. Phones have secure storage. The web has none: anything in `localStorage` can be
 * read by any script on the page, so a production web build keeps the session in memory only (the user logs
 * in again after a reload). `localStorage` is used only in development builds, so the browser preview used
 * for development survives a reload like the real app does.
 */
function backend(): Backend {
  if (Platform.OS !== 'web') return secureBackend;
  return __DEV__ && typeof localStorage !== 'undefined' ? webDevBackend : memoryBackend;
}

function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) return false;
  const { accessToken, expiresAt, user } = value as Record<string, unknown>;
  if (typeof accessToken !== 'string' || accessToken.length === 0) return false;
  if (typeof expiresAt !== 'string' || Number.isNaN(Date.parse(expiresAt))) return false;
  if (typeof user !== 'object' || user === null) return false;
  const { id, email, displayName } = user as Record<string, unknown>;
  return typeof id === 'string' && typeof email === 'string' && typeof displayName === 'string';
}

/**
 * The saved session, or null when there is none, it can't be read, or it is damaged (a damaged one is
 * removed so it isn't tried again). Never rejects: not being able to read it just means logging in again.
 */
export async function loadSession(): Promise<StoredSession | null> {
  let raw: string | null;
  try {
    raw = await backend().get();
  } catch (error) {
    console.warn('Could not read the saved session', error);
    return null;
  }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isStoredSession(parsed)) return parsed;
  } catch {
    // Not JSON: treated like any other damaged value below.
  }
  await clearSession();
  return null;
}

/** Rejects if it can't be stored; the caller decides whether that matters. */
export async function saveSession(session: StoredSession): Promise<void> {
  await backend().set(JSON.stringify(session));
}

/** Never rejects; a failure is logged. */
export async function clearSession(): Promise<void> {
  try {
    await backend().remove();
  } catch (error) {
    console.warn('Could not remove the saved session', error);
  }
}
