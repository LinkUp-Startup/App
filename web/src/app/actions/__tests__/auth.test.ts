import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ startSession: vi.fn(), endSession: vi.fn() }));
vi.mock('@/lib/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/session')>()),
  ...session,
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));

import { login, logout } from '../auth';

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const respond = (status: number, body?: unknown) =>
  vi
    .fn()
    .mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('login', () => {
  const credentials = {
    email: ' ann@example.com ',
    password: 'secret-password',
    next: '/plan/abc',
  };

  it('logs in through the API, keeps the session and goes back to the page', async () => {
    const fetchMock = respond(200, {
      accessToken: 'jwt',
      expiresAt: '2026-11-08T12:00:00Z',
      user: { id: 'u1', email: 'ann@example.com', displayName: 'Ann' },
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(login({}, form(credentials))).rejects.toThrow('REDIRECT /plan/abc');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://linkup-api.th7bo.dev/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'ann@example.com', password: 'secret-password' }),
      }),
    );
    expect(session.startSession).toHaveBeenCalledWith(
      { accessToken: 'jwt', displayName: 'Ann' },
      '2026-11-08T12:00:00Z',
    );
  });

  it('never redirects to another site', async () => {
    vi.stubGlobal(
      'fetch',
      respond(200, {
        accessToken: 'jwt',
        expiresAt: '2026-11-08T12:00:00Z',
        user: { displayName: 'Ann' },
      }),
    );

    await expect(login({}, form({ ...credentials, next: '//evil.example' }))).rejects.toThrow(
      'REDIRECT /',
    );
  });

  it('asks for both fields without calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(login({}, form({ email: 'ann@example.com', password: '' }))).resolves.toEqual({
      error: 'Enter your email and password.',
      email: 'ann@example.com',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats missing fields as empty', async () => {
    await expect(login({}, new FormData())).resolves.toEqual({
      error: 'Enter your email and password.',
      email: '',
    });
  });

  it.each([
    [401, 'That email and password don’t match a LinkUp account.'],
    [400, 'That email and password don’t match a LinkUp account.'],
    [429, 'Too many attempts. Wait a minute and try again.'],
    [500, 'Couldn’t log in right now. Try again in a moment.'],
  ])('explains a %i and keeps the email', async (status, error) => {
    vi.stubGlobal('fetch', respond(status));

    await expect(login({}, form(credentials))).resolves.toEqual({
      error,
      email: 'ann@example.com',
    });
    expect(session.startSession).not.toHaveBeenCalled();
  });

  it('explains when the API cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(login({}, form(credentials))).resolves.toMatchObject({
      error: 'Couldn’t reach LinkUp. Try again in a moment.',
    });
  });
});

describe('logout', () => {
  it('ends the session and stays on the page', async () => {
    await expect(logout(form({ next: '/plan/abc' }))).rejects.toThrow('REDIRECT /plan/abc');
    expect(session.endSession).toHaveBeenCalled();
  });
});
