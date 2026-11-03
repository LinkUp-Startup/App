import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiUrl, getSharedPlan } from '../api';
import { samplePlan } from './sample-plan';

const respond = (status: number, body?: unknown) =>
  vi
    .fn()
    .mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }));

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
