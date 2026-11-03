import { describe, expect, it } from 'vitest';
import { describeWhen, toRouteStops } from '../plan';
import { samplePlan } from './sample-plan';

describe('plan helpers', () => {
  it('describes the night from the first stop to the last, in Lleida time', () => {
    expect(describeWhen(samplePlan)).toBe('Friday 6 November, 20:30 to 04:00');
  });

  it('describes nothing for a plan without stops', () => {
    expect(describeWhen({ ...samplePlan, items: [] })).toBe('');
  });

  it('turns plan items into route stops', () => {
    expect(toRouteStops(samplePlan)[1]).toEqual({
      name: 'Traganits',
      activity: 'club',
      address: 'Carrer Darrera Sant Martí, 57, 25004 Lleida',
      latitude: 41.6135,
      longitude: 0.6159,
      startTime: '2026-11-06T23:30:00Z',
      endTime: '2026-11-07T03:00:00Z',
      costPerPerson: 20,
      distanceKm: 3.5,
    });
  });
});
