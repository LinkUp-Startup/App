import { tapasPlan } from '@/features/plans/__tests__/fixtures/plans';
import { formatCountdown, isTonight, nightMoment } from '@/features/tonight/night';

// tapasPlan: Teresa Carles 19:30-21:00 UTC, Pub Legend 21:15-22:45 UTC.
const at = (iso: string) => new Date(iso);
const MIN = 60_000;

describe('nightMoment', () => {
  it('counts down to the first stop before the night starts', () => {
    const moment = nightMoment(tapasPlan, at('2026-10-30T18:00:00Z'));

    expect(moment).toMatchObject({ phase: 'before', next: { index: 0 }, startsInMs: 90 * MIN });
  });

  it('is at a stop from its start until just before its end', () => {
    expect(nightMoment(tapasPlan, at('2026-10-30T19:30:00Z'))).toMatchObject({
      phase: 'at',
      current: { index: 0 },
      endsInMs: 90 * MIN,
      next: { index: 1 },
    });
    expect(nightMoment(tapasPlan, at('2026-10-30T20:59:00Z'))).toMatchObject({
      phase: 'at',
      current: { index: 0 },
      endsInMs: MIN,
    });
  });

  it('is on the way between two stops', () => {
    expect(nightMoment(tapasPlan, at('2026-10-30T21:00:00Z'))).toMatchObject({
      phase: 'between',
      next: { index: 1 },
      startsInMs: 15 * MIN,
    });
  });

  it('has no next stop at the last one', () => {
    expect(nightMoment(tapasPlan, at('2026-10-30T22:00:00Z'))).toMatchObject({
      phase: 'at',
      current: { index: 1 },
      next: null,
    });
  });

  it('is over after the last stop', () => {
    expect(nightMoment(tapasPlan, at('2026-10-30T22:45:00Z'))).toEqual({ phase: 'over' });
  });

  it('is over for a plan without stops', () => {
    expect(nightMoment({ ...tapasPlan, items: [] }, at('2026-10-30T20:00:00Z'))).toEqual({
      phase: 'over',
    });
  });
});

describe('isTonight', () => {
  it('is tonight from 12 hours before the first stop until the last one ends', () => {
    expect(isTonight(tapasPlan, at('2026-10-30T07:29:00Z'))).toBe(false);
    expect(isTonight(tapasPlan, at('2026-10-30T07:30:00Z'))).toBe(true);
    expect(isTonight(tapasPlan, at('2026-10-30T22:44:00Z'))).toBe(true);
    expect(isTonight(tapasPlan, at('2026-10-30T22:45:00Z'))).toBe(false);
  });

  it('is never tonight for a plan without stops', () => {
    expect(isTonight({ ...tapasPlan, items: [] }, at('2026-10-30T20:00:00Z'))).toBe(false);
  });
});

describe('formatCountdown', () => {
  it.each([
    [0, 'now'],
    [-5 * MIN, 'now'],
    [1, '1 min'],
    [5 * MIN, '5 min'],
    [60 * MIN, '1 h'],
    [80 * MIN, '1 h 20 min'],
    [80 * MIN + 1, '1 h 21 min'],
  ])('%d ms is "%s"', (ms, text) => {
    expect(formatCountdown(ms)).toBe(text);
  });
});
