/**
 * Per-environment settings, read from `.env` files at bundle time (see `.env.example`).
 * Expo loads `.env`, then `.env.local` overrides it — use `.env.local` for your machine's IP.
 */
const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) {
  console.warn('EXPO_PUBLIC_API_URL is not set — copy .env.example to .env');
}

export const Config = {
  apiUrl: (apiUrl ?? 'http://10.0.2.2:5000').replace(/\/$/, ''),
  /** Requests that take longer than this are aborted. */
  apiTimeoutMs: 15_000,
} as const;
