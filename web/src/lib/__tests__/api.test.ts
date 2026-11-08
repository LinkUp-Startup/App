import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiUrl, getSharedPlan, hasSavedPlan, savePlan, SessionExpiredError } from '../api';
import { samplePlan } from './sample-plan';

// A fresh Response per call: a body can only be read once.
const respond = (status: number, body?: unknown) =>
  vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
    async () => new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('apiUrl', () => {
  it('uses the live API unless LINKUP_API_URL says otherwise', () => {
    expect(apiUrl()).toBe('https://linkup-api.th7bo.dev');
    vi.stubEnv('LINKUP_API_URL', 'http://localhost:5000/');
    expect(apiUrl()).toBe('http://localhost:5000');
  });
});

describe('getSharedPlan', () => {
  it('returns the shared plan, fetched fresh every time', async () => {
    const fetchMock = respond(200, { plan: samplePlan });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getSharedPlan('abc_DEF-123')).resolves.toEqual(samplePlan);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://linkup-api.th7bo.dev/api/shared-plans/abc_DEF-123',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('escapes the token so it stays one path segment', async () => {
    const fetchMock = respond(404);
    vi.stubGlobal('fetch', fetchMock);

    await getSharedPlan('../venues');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://linkup-api.th7bo.dev/api/shared-plans/..%2Fvenues',
    );
  });

  it('returns null for a link that is unknown or no longer shared', async () => {
    vi.stubGlobal('fetch', respond(404));

    await expect(getSharedPlan('gone')).resolves.toBeNull();
  });

  it('throws when the API fails, so the page shows "try again" instead of "not shared"', async () => {
    vi.stubGlobal('fetch', respond(503));

    await expect(getSharedPlan('abc')).rejects.toThrow('503');
  });
});

describe('hasSavedPlan', () => {
  it('checks the account’s saved plans with its token', async () => {
    const fetchMock = respond(200, { plans: [{ plan: samplePlan, savedAt: 'x', shareUrl: null }] });
    vi.stubGlobal('fetch', fetchMock);

    await expect(hasSavedPlan('jwt', samplePlan.id)).resolves.toBe(true);
    await expect(hasSavedPlan('jwt', 'other')).resolves.toBe(false);
    expect(fetchMock.mock.calls[0][0]).toBe('https://linkup-api.th7bo.dev/api/saved-plans');
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer jwt' });
  });

  it('reports an expired session', async () => {
    vi.stubGlobal('fetch', respond(401));
    await expect(hasSavedPlan('jwt', 'x')).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it('throws on other failures', async () => {
    vi.stubGlobal('fetch', respond(500));
    await expect(hasSavedPlan('jwt', 'x')).rejects.toThrow('500');
  });
});

describe('savePlan', () => {
  it('puts the plan under its id with the account’s token', async () => {
    const fetchMock = respond(200, {});
    vi.stubGlobal('fetch', fetchMock);

    await expect(savePlan('jwt', samplePlan)).resolves.toBe('saved');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://linkup-api.th7bo.dev/api/saved-plans/${samplePlan.id}`);
    expect(init).toMatchObject({ method: 'PUT', body: JSON.stringify(samplePlan) });
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer jwt',
      'Content-Type': 'application/json',
    });
  });

  it('reports a full account, an expired session and other failures', async () => {
    vi.stubGlobal('fetch', respond(409));
    await expect(savePlan('jwt', samplePlan)).resolves.toBe('limit');
    vi.stubGlobal('fetch', respond(401));
    await expect(savePlan('jwt', samplePlan)).rejects.toBeInstanceOf(SessionExpiredError);
    vi.stubGlobal('fetch', respond(500));
    await expect(savePlan('jwt', samplePlan)).rejects.toThrow('500');
  });
});
