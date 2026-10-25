/**
 * Sessions are treated as over this long before the token really expires, so a request never goes out with
 * a token that lapses on the way (the server also allows a little clock difference, see the API's ClockSkew).
 */
export const ExpirySkewMs = 30_000;

/** Whether the session should no longer be used. An unreadable date counts as expired. */
export function isExpired(expiresAt: string, now: number = Date.now()): boolean {
  return msUntilExpiry(expiresAt, now) <= 0;
}

/** Milliseconds until the session should be ended; zero or less when that time has passed. */
export function msUntilExpiry(expiresAt: string, now: number = Date.now()): number {
  const expires = Date.parse(expiresAt);
  return Number.isNaN(expires) ? 0 : expires - ExpirySkewMs - now;
}
