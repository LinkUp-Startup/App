import { ExpirySkewMs, isExpired, msUntilExpiry } from '@/features/auth/expiry';

const now = Date.parse('2026-10-30T20:00:00.000Z');
const at = (offsetMs: number) => new Date(now + offsetMs).toISOString();

describe('msUntilExpiry', () => {
  it('counts down to a little before the token really expires', () => {
    expect(msUntilExpiry(at(60 * 60_000), now)).toBe(60 * 60_000 - ExpirySkewMs);
  });

  it('is zero or negative once that moment has passed', () => {
    expect(msUntilExpiry(at(ExpirySkewMs), now)).toBe(0);
    expect(msUntilExpiry(at(-5_000), now)).toBeLessThan(0);
  });

  it('treats an unreadable date as already over', () => {
    expect(msUntilExpiry('not a date', now)).toBe(0);
  });
});

describe('isExpired', () => {
  it('is false while there is time left', () => {
    expect(isExpired(at(10 * 60_000), now)).toBe(false);
  });

  it('is true inside the safety margin before the real expiry', () => {
    expect(isExpired(at(ExpirySkewMs - 1), now)).toBe(true);
    expect(isExpired(at(ExpirySkewMs), now)).toBe(true);
    expect(isExpired(at(ExpirySkewMs + 1), now)).toBe(false);
  });

  it('is true after the expiry and for an unreadable date', () => {
    expect(isExpired(at(-1), now)).toBe(true);
    expect(isExpired('garbage', now)).toBe(true);
  });

  it('uses the current time by default', () => {
    expect(isExpired(new Date(Date.now() + 60 * 60_000).toISOString())).toBe(false);
    expect(isExpired(new Date(Date.now() - 60_000).toISOString())).toBe(true);
  });
});
