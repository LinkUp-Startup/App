import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cookieJar } from './cookie-jar';

const state = vi.hoisted(() => ({ jar: undefined as unknown }));
vi.mock('next/headers', () => ({ cookies: async () => state.jar }));

import { endSession, getSession, safeNext, startSession } from '../session';

let values: ReturnType<typeof cookieJar>['values'];
beforeEach(() => {
  const made = cookieJar();
  state.jar = made.jar;
  values = made.values;
});

describe('session cookies', () => {
  it('has no session without the token cookie', async () => {
    await expect(getSession()).resolves.toBeNull();
  });

  it('keeps the token and name in HttpOnly, SameSite cookies that expire with the token', async () => {
    await startSession({ accessToken: 'jwt', displayName: 'Ann' }, '2026-11-08T12:00:00Z');

    await expect(getSession()).resolves.toEqual({ accessToken: 'jwt', displayName: 'Ann' });
    expect(values.get('linkup_token')?.options).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: new Date('2026-11-08T12:00:00Z'),
    });
  });

  it('marks the cookies Secure in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await startSession({ accessToken: 'jwt', displayName: 'Ann' }, '2026-11-08T12:00:00Z');
    vi.unstubAllEnvs();

    expect(values.get('linkup_token')?.options).toMatchObject({ secure: true });
  });

  it('logs out by removing both cookies', async () => {
    await startSession({ accessToken: 'jwt', displayName: 'Ann' }, '2026-11-08T12:00:00Z');
    await endSession();

    await expect(getSession()).resolves.toBeNull();
    expect(values.size).toBe(0);
  });

  it('survives a missing name cookie', async () => {
    values.set('linkup_token', { value: 'jwt' });

    await expect(getSession()).resolves.toEqual({ accessToken: 'jwt', displayName: '' });
  });
});

describe('safeNext', () => {
  it.each(['/plan/abc', '/'])('keeps a path on this site: %s', (path) => {
    expect(safeNext(path)).toBe(path);
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'plan/abc',
    undefined,
    null,
    3,
  ])('goes home instead of %s', (path) => {
    expect(safeNext(path)).toBe('/');
  });
});
