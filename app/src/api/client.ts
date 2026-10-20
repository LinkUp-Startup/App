import { Config } from '@/config';

/** The server answered with a non-2xx status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The server could not be reached: offline, wrong base URL, or timed out. */
export class NetworkError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'NetworkError';
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown; timeoutMs?: number };

export async function apiRequest<T>(
  path: string,
  { body, headers, signal, timeoutMs = Config.apiTimeoutMs, ...init }: RequestOptions = {},
): Promise<T> {
  const url = `${Config.apiUrl}${path}`;

  // Abort on timeout, or when the caller's signal aborts.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onCallerAbort = () => controller.abort();
  signal?.addEventListener('abort', onCallerAbort);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    const reason = controller.signal.aborted ? `timed out after ${timeoutMs} ms` : 'request failed';
    throw new NetworkError(`${init.method ?? 'GET'} ${url}: ${reason}`, { cause: error });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onCallerAbort);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ApiError(response.status, text || response.statusText);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
