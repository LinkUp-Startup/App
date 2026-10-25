import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { clearSession, loadSession, saveSession, type StoredSession } from '@/storage/session';

const KEY = 'linkup.session.v1';

const session: StoredSession = {
  accessToken: 'token-1',
  expiresAt: '2026-10-30T20:00:00.000Z',
  user: { id: 'u1', email: 'ann@example.com', displayName: 'Ann' },
};

const secureStore = jest.mocked(SecureStore);
const secureValues = () => (SecureStore as unknown as { __store: Map<string, string> }).__store;

describe('session storage on a phone', () => {
  it('has nothing saved at first', async () => {
    await expect(loadSession()).resolves.toBeNull();
  });

  it('gives back what was saved', async () => {
    await saveSession(session);

    await expect(loadSession()).resolves.toEqual(session);
  });

  it('keeps the session in secure storage, tied to this device', async () => {
    await saveSession(session);

    expect(secureStore.setItemAsync).toHaveBeenCalledWith(KEY, JSON.stringify(session), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  });

  it('never writes the token to plain AsyncStorage', async () => {
    await saveSession(session);

    await expect(AsyncStorage.getAllKeys()).resolves.toEqual([]);
  });

  it('forgets the session when cleared', async () => {
    await saveSession(session);

    await clearSession();

    await expect(loadSession()).resolves.toBeNull();
    expect(secureValues().has(KEY)).toBe(false);
  });

  it('replaces an earlier session', async () => {
    await saveSession(session);
    const second = { ...session, accessToken: 'token-2' };

    await saveSession(second);

    await expect(loadSession()).resolves.toEqual(second);
  });

  describe('a saved value that is damaged', () => {
    it.each([
      ['not JSON', 'definitely not json'],
      ['JSON null', 'null'],
      ['an array', '[]'],
      ['no token', JSON.stringify({ ...session, accessToken: undefined })],
      ['an empty token', JSON.stringify({ ...session, accessToken: '' })],
      ['a token that is not text', JSON.stringify({ ...session, accessToken: 42 })],
      ['no expiry', JSON.stringify({ ...session, expiresAt: undefined })],
      ['an unreadable expiry', JSON.stringify({ ...session, expiresAt: 'tomorrow-ish' })],
      ['no account', JSON.stringify({ ...session, user: undefined })],
      [
        'an account without an id',
        JSON.stringify({ ...session, user: { ...session.user, id: undefined } }),
      ],
      [
        'an account without an email',
        JSON.stringify({ ...session, user: { ...session.user, email: 7 } }),
      ],
      [
        'an account without a name',
        JSON.stringify({ ...session, user: { id: 'u1', email: 'ann@example.com' } }),
      ],
    ])('is ignored and removed (%s)', async (_description, stored) => {
      secureValues().set(KEY, stored);

      await expect(loadSession()).resolves.toBeNull();

      expect(secureValues().has(KEY)).toBe(false);
    });
  });

  describe('when the device storage fails', () => {
    it('loading gives no session instead of failing', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      secureStore.getItemAsync.mockRejectedValueOnce(new Error('keychain locked'));

      await expect(loadSession()).resolves.toBeNull();

      expect(warn).toHaveBeenCalledWith('Could not read the saved session', expect.any(Error));
      warn.mockRestore();
    });

    it('saving reports the failure to the caller', async () => {
      secureStore.setItemAsync.mockRejectedValueOnce(new Error('disk full'));

      await expect(saveSession(session)).rejects.toThrow('disk full');
    });

    it('clearing never fails', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      secureStore.deleteItemAsync.mockRejectedValueOnce(new Error('keychain locked'));

      await expect(clearSession()).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledWith('Could not remove the saved session', expect.any(Error));
      warn.mockRestore();
    });
  });
});

describe('session storage on the web', () => {
  type FakeLocalStorage = {
    values: Map<string, string>;
    getItem: jest.Mock;
    setItem: jest.Mock;
    removeItem: jest.Mock;
  };

  function installLocalStorage(): FakeLocalStorage {
    const values = new Map<string, string>();
    const fake: FakeLocalStorage = {
      values,
      getItem: jest.fn((key: string) => values.get(key) ?? null),
      setItem: jest.fn((key: string, value: string) => void values.set(key, value)),
      removeItem: jest.fn((key: string) => void values.delete(key)),
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: fake,
      configurable: true,
      writable: true,
    });
    return fake;
  }

  let restores: { restore(): void }[] = [];

  beforeEach(() => {
    restores = [jest.replaceProperty(Platform, 'OS', 'web')];
  });

  afterEach(() => {
    restores.forEach((replaced) => replaced.restore());
    // @ts-expect-error: the property only exists while a test installs it.
    delete globalThis.localStorage;
  });

  it('in a development build, survives a reload through localStorage (browser preview only)', async () => {
    const local = installLocalStorage();

    await saveSession(session);

    expect(local.values.get(KEY)).toBe(JSON.stringify(session));
    await expect(loadSession()).resolves.toEqual(session);
    await clearSession();
    expect(local.values.has(KEY)).toBe(false);
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('in a production build, never touches localStorage, so the token is not exposed to page scripts', async () => {
    const local = installLocalStorage();
    restores.push(
      jest.replaceProperty(globalThis as unknown as { __DEV__: boolean }, '__DEV__', false),
    );
    await clearSession();

    await saveSession(session);

    await expect(loadSession()).resolves.toEqual(session); // still works for this visit
    expect(local.setItem).not.toHaveBeenCalled();
    expect(local.getItem).not.toHaveBeenCalled();
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
    await clearSession();
    await expect(loadSession()).resolves.toBeNull();
  });

  it('without localStorage at all, keeps the session in memory', async () => {
    await clearSession();

    await saveSession(session);

    await expect(loadSession()).resolves.toEqual(session);
    await clearSession();
  });
});
