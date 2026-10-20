import { ApiError, apiRequest, NetworkError } from '@/api/client';

const fetchMock = jest.spyOn(globalThis, 'fetch');

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  fetchMock.mockReset();
  jest.useRealTimers();
});

describe('apiRequest', () => {
  it('prefixes the base URL and parses JSON', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await expect(apiRequest('/health')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/health',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('serialises the body as JSON with a Content-Type header', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await apiRequest('/things', { method: 'POST', body: { a: 1 } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.body).toBe('{"a":1}');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('returns undefined for 204 No Content', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiRequest('/empty')).resolves.toBeUndefined();
  });

  it('throws ApiError with the status and body for non-2xx responses', async () => {
    fetchMock.mockResolvedValue(new Response('Bad input', { status: 400 }));

    const error = await apiRequest('/bad').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, message: 'Bad input' });
  });

  it('throws NetworkError when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(apiRequest('/health')).rejects.toThrow(NetworkError);
  });

  it('throws NetworkError after the timeout', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );

    const request = apiRequest('/slow', { timeoutMs: 1000 });
    jest.advanceTimersByTime(1000);

    await expect(request).rejects.toThrow('timed out after 1000 ms');
  });

  it('rethrows the original error when the caller aborts', async () => {
    const controller = new AbortController();
    const abortError = new Error('aborted by caller');
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(abortError));
        }),
    );

    const request = apiRequest('/slow', { signal: controller.signal });
    controller.abort();

    await expect(request).rejects.toBe(abortError);
  });
});
