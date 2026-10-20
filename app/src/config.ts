/**
 * Per-environment settings, read from `.env` files at bundle time (see `.env.example`).
 * Expo loads `.env`, then `.env.local` overrides it — use `.env.local` for your machine's IP.
 */
const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error(
    'EXPO_PUBLIC_API_URL is not set. Copy app/.env.example to app/.env and restart Metro.',
  );
}

export const Config = {
  apiUrl: apiUrl.replace(/\/$/, ''),
  /** Requests that take longer than this are aborted. */
  apiTimeoutMs: 15_000,
} as const;
