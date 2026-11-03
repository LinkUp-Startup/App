import { describe, expect, it } from 'vitest';
import {
  activityLabel,
  directionsUrl,
  formatDay,
  formatEuros,
  formatKm,
  formatTime,
} from '../format';

describe('format', () => {
  it('shows times in Lleida time, whatever the viewer’s time zone', () => {
    // 19:30 UTC in November is 20:30 in Lleida (CET), and 21:30 UTC in July is 23:30 (CEST).
    expect(formatTime('2026-11-06T19:30:00Z')).toBe('20:30');
    expect(formatTime('2026-07-10T21:30:00Z')).toBe('23:30');
  });

  it('names the day of the night in Lleida time', () => {
    expect(formatDay('2026-11-06T23:30:00Z')).toBe('Saturday 7 November');
  });

  it('shows euros without cents when the amount is whole', () => {
    expect(formatEuros(18)).toBe('€18');
    expect(formatEuros(7.5)).toBe('€7.50');
  });

  it('shows short distances in metres and longer ones in kilometres', () => {
    expect(formatKm(0.45)).toBe('450 m');
    expect(formatKm(1)).toBe('1 km');
    expect(formatKm(1.64)).toBe('1.6 km');
  });

  it('labels known activities and passes unknown ones through', () => {
    expect(activityLabel('outdoor')).toBe('Outside');
    expect(activityLabel('karaoke')).toBe('karaoke');
  });

  it('links to Google Maps at the venue', () => {
    expect(directionsUrl(41.61, 0.62)).toBe(
      'https://www.google.com/maps/search/?api=1&query=41.61,0.62',
    );
  });
});
