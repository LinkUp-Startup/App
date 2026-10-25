import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import type { ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { getMe } from '@/api/auth';
import { ApiError, NetworkError } from '@/api/client';
import { AuthProvider, RestoreTimeoutMs, useAuth } from '@/features/auth/auth-context';
import { ExpirySkewMs } from '@/features/auth/expiry';
import { saveSession } from '@/storage/session';
import type { AuthResponse } from '@/types/api';

jest.mock('@/api/auth', () => ({ getMe: jest.fn() }));

const KEY = 'linkup.session.v1';
const MaxTimerMs = 2 ** 31 - 1;
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const inMs = (ms: number) => new Date(Date.now() + ms).toISOString();

function sessionFor(overrides: Partial<AuthResponse> = {}): AuthResponse {
  return {
    accessToken: 'token-1',
    expiresAt: inMs(60 * MINUTE),
    user: { id: 'u1', email: 'ann@example.com', displayName: 'Ann' },
    ...overrides,
  };
}

const secureStore = jest.mocked(SecureStore);
const savedValue = () =>
  (SecureStore as unknown as { __store: Map<string, string> }).__store.get(KEY);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

const renderAuth = () => renderHook(() => useAuth(), { wrapper });
type Auth = Awaited<ReturnType<typeof renderAuth>>['result'];

const untilReady = (result: Auth) => waitFor(() => expect(result.current.status).toBe('ready'));

/** Lets the pending promises (storage reads, the server check) finish. */
const flush = () => act(async () => {});

/** Captures the app's foreground/background listener so a test can fire it. */
function captureAppState() {
  const listeners: ((state: AppStateStatus) => void)[] = [];
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.push(listener as (state: AppStateStatus) => void);
    return { remove };
  });
  return {
    remove,
    emit: (state: AppStateStatus) =>
      act(async () => listeners.forEach((listener) => listener(state))),
  };
}

beforeEach(() => {
  jest.mocked(getMe).mockResolvedValue(sessionFor().user);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.mocked(getMe).mockReset();
});

describe('starting up', () => {
  it('stays "loading" until the saved session has been read', async () => {
    const read = deferred<string | null>();
    secureStore.getItemAsync.mockReturnValueOnce(read.promise);

    const { result } = await renderAuth();

    expect(result.current.status).toBe('loading');
    read.resolve(null);
    await untilReady(result);
  });

  it('starts as a guest when nothing is saved', async () => {
    const { result } = await renderAuth();
    await untilReady(result);

    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
    expect(getMe).not.toHaveBeenCalled();
  });

  it('restores a saved session and confirms it with the server', async () => {
    await saveSession(sessionFor());

    const { result } = await renderAuth();
    await untilReady(result);

    expect(result.current.user).toEqual(sessionFor().user);
    expect(result.current.accessToken).toBe('token-1');
    await waitFor(() => expect(getMe).toHaveBeenCalledWith('token-1', expect.any(AbortSignal)));
  });

  it('signs out and forgets a session the server no longer accepts (401)', async () => {
    await saveSession(sessionFor());
    jest.mocked(getMe).mockRejectedValue(new ApiError(401, 'Unauthorized'));

    const { result } = await renderAuth();

    await waitFor(() => expect(savedValue()).toBeUndefined());
    expect(getMe).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
  });

  it('keeps the session when the server cannot be reached', async () => {
    await saveSession(sessionFor());
    jest.mocked(getMe).mockRejectedValue(new NetworkError('offline'));

    const { result } = await renderAuth();
    await untilReady(result);
    await waitFor(() => expect(getMe).toHaveBeenCalled());
    await flush();

    expect(result.current.user).toEqual(sessionFor().user);
    expect(savedValue()).toBeDefined();
  });

  it('keeps the session when the server has an error (5xx)', async () => {
    await saveSession(sessionFor());
    jest.mocked(getMe).mockRejectedValue(new ApiError(503, 'Unavailable'));

    const { result } = await renderAuth();
    await untilReady(result);
    await waitFor(() => expect(getMe).toHaveBeenCalled());
    await flush();

    expect(result.current.user).toEqual(sessionFor().user);
    expect(savedValue()).toBeDefined();
  });

  it('ignores and removes a saved session that has expired', async () => {
    await saveSession(sessionFor({ expiresAt: inMs(-MINUTE) }));

    const { result } = await renderAuth();
    await untilReady(result);

    expect(result.current.user).toBeNull();
    expect(savedValue()).toBeUndefined();
    expect(getMe).not.toHaveBeenCalled();
  });

  it('ignores a saved session that is about to expire (inside the safety margin)', async () => {
    await saveSession(sessionFor({ expiresAt: inMs(ExpirySkewMs / 2) }));

    const { result } = await renderAuth();
    await untilReady(result);

    expect(result.current.user).toBeNull();
    expect(getMe).not.toHaveBeenCalled();
  });

  it('ignores and removes a saved value that is damaged', async () => {
    (SecureStore as unknown as { __store: Map<string, string> }).__store.set(KEY, '{broken');

    const { result } = await renderAuth();
    await untilReady(result);

    expect(result.current.user).toBeNull();
    expect(savedValue()).toBeUndefined();
  });

  it('starts as a guest when the device storage cannot be read', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    secureStore.getItemAsync.mockRejectedValueOnce(new Error('keychain locked'));

    const { result } = await renderAuth();
    await untilReady(result);

    expect(result.current.user).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it('starts as a guest instead of hanging if reading the session never finishes', async () => {
    jest.useFakeTimers();
    const read = deferred<string | null>();
    secureStore.getItemAsync.mockReturnValueOnce(read.promise);

    const { result } = await renderAuth();
    expect(result.current.status).toBe('loading');

    await act(async () => {
      jest.advanceTimersByTime(RestoreTimeoutMs);
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.user).toBeNull();

    // The read finally finishes: too late to matter, the user already started as a guest.
    read.resolve(JSON.stringify(sessionFor()));
    await flush();
    expect(result.current.user).toBeNull();
  });
});

describe('signing in and out', () => {
  it('signIn sets the account and token, and saves them on the device', async () => {
    const { result } = await renderAuth();
    await untilReady(result);
    const session = sessionFor();

    await act(async () => result.current.signIn(session));

    expect(result.current.user).toEqual(session.user);
    expect(result.current.accessToken).toBe('token-1');
    expect(JSON.parse(savedValue() ?? 'null')).toEqual(session);
  });

  it('signIn still works when the session cannot be saved', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    secureStore.setItemAsync.mockRejectedValueOnce(new Error('disk full'));
    const { result } = await renderAuth();
    await untilReady(result);

    await act(async () => result.current.signIn(sessionFor()));

    expect(result.current.user).toEqual(sessionFor().user);
    expect(warn).toHaveBeenCalledWith('Could not save the session', expect.any(Error));
  });

  it('signOut goes back to being a guest and removes the saved session', async () => {
    const { result } = await renderAuth();
    await untilReady(result);
    await act(async () => result.current.signIn(sessionFor()));
    expect(savedValue()).toBeDefined();

    await act(async () => result.current.signOut());

    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
    expect(savedValue()).toBeUndefined();
  });

  it('a second sign in replaces the first, in memory and on the device', async () => {
    const { result } = await renderAuth();
    await untilReady(result);
    await act(async () => result.current.signIn(sessionFor()));
    const second = sessionFor({
      accessToken: 'token-2',
      user: { id: 'u2', email: 'bea@example.com', displayName: 'Bea' },
    });

    await act(async () => result.current.signIn(second));

    expect(result.current.accessToken).toBe('token-2');
    expect(result.current.user?.displayName).toBe('Bea');
    expect(JSON.parse(savedValue() ?? 'null')).toEqual(second);
  });

  it('a login made while the saved session is still loading is not overwritten by it', async () => {
    const old = sessionFor({ accessToken: 'old-token' });
    const read = deferred<string | null>();
    secureStore.getItemAsync.mockReturnValueOnce(read.promise);
    const { result } = await renderAuth();
    const fresh = sessionFor({ accessToken: 'fresh-token' });

    await act(async () => result.current.signIn(fresh));
    read.resolve(JSON.stringify(old));
    await flush();

    expect(result.current.accessToken).toBe('fresh-token');
    expect(JSON.parse(savedValue() ?? 'null')).toEqual(fresh);
    expect(getMe).not.toHaveBeenCalled();
  });

  it('a late "401" for an old session does not sign out a newer login', async () => {
    await saveSession(sessionFor({ accessToken: 'old-token' }));
    const check = deferred<never>();
    jest.mocked(getMe).mockReturnValueOnce(check.promise);
    const { result } = await renderAuth();
    await untilReady(result);
    const fresh = sessionFor({ accessToken: 'fresh-token' });
    await act(async () => result.current.signIn(fresh));

    check.reject(new ApiError(401, 'Unauthorized'));
    await flush();

    expect(result.current.accessToken).toBe('fresh-token');
    expect(JSON.parse(savedValue() ?? 'null')).toEqual(fresh);
  });
});

describe('expiry', () => {
  it('signs the user out when the token expires, a little early', async () => {
    jest.useFakeTimers();
    const { result } = await renderAuth();
    await flush();
    await act(async () => result.current.signIn(sessionFor({ expiresAt: inMs(2 * MINUTE) })));

    await act(async () => {
      jest.advanceTimersByTime(2 * MINUTE - ExpirySkewMs - 1_000);
    });
    expect(result.current.user).not.toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(2_000);
    });
    expect(result.current.user).toBeNull();
    expect(savedValue()).toBeUndefined();
  });

  it('is not tripped by timers overflowing when the token lasts longer than 24 days', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout');
    const { result } = await renderAuth();
    await flush();
    setTimeoutSpy.mockClear();

    await act(async () => result.current.signIn(sessionFor({ expiresAt: inMs(30 * DAY) })));

    // setTimeout fires at once for delays above 2^31-1 ms. Checked on the delays asked for, so a
    // regression fails here instead of looping through billions of timer ticks.
    const delays = setTimeoutSpy.mock.calls.map(([, delay]) => Number(delay ?? 0));
    expect(delays.length).toBeGreaterThan(0);
    expect(Math.max(...delays)).toBeLessThanOrEqual(MaxTimerMs);
    expect(result.current.user).not.toBeNull();

    // After the longest allowed wait the timer sets itself again instead of signing the user out.
    await act(async () => {
      jest.advanceTimersByTime(MaxTimerMs);
    });
    expect(result.current.user).not.toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(6 * DAY);
    });
    expect(result.current.user).toBeNull();
  });

  it('checks again when the app comes back to the foreground, since timers pause in the background', async () => {
    jest.useFakeTimers();
    const appState = captureAppState();
    const { result } = await renderAuth();
    await flush();
    await act(async () => result.current.signIn(sessionFor({ expiresAt: inMs(10 * MINUTE) })));

    // The phone slept for 20 minutes: no timer ran, but the clock moved on.
    jest.setSystemTime(Date.now() + 20 * MINUTE);
    await appState.emit('background');
    expect(result.current.user).not.toBeNull();

    await appState.emit('active');
    expect(result.current.user).toBeNull();
    expect(savedValue()).toBeUndefined();
  });

  it('stays signed in when the app returns to the foreground before the token expires', async () => {
    const appState = captureAppState();
    const { result } = await renderAuth();
    await flush();
    await act(async () => result.current.signIn(sessionFor()));

    await appState.emit('active');

    expect(result.current.user).not.toBeNull();
  });

  it('stops watching when the app closes or the user signs out', async () => {
    jest.useFakeTimers();
    const appState = captureAppState();
    const { result, unmount } = await renderAuth();
    await flush();
    await act(async () => result.current.signIn(sessionFor({ expiresAt: inMs(2 * MINUTE) })));
    secureStore.deleteItemAsync.mockClear();

    await act(async () => result.current.signOut());
    expect(appState.remove).toHaveBeenCalled();
    secureStore.deleteItemAsync.mockClear();

    await unmount();
    await act(async () => {
      jest.advanceTimersByTime(5 * MINUTE);
    });
    expect(secureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});

describe('useAuth', () => {
  it('outside the provider is a clear error', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(renderHook(() => useAuth())).rejects.toThrow(/inside <AuthProvider>/);

    consoleError.mockRestore();
  });
});
