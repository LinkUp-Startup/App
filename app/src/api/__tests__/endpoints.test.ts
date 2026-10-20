import { apiRequest } from '@/api/client';
import { getHealth } from '@/api/health';
import { generatePlans } from '@/api/plans';
import type { NightPreferences } from '@/types/api';

jest.mock('@/api/client', () => ({ apiRequest: jest.fn() }));

const preferences: NightPreferences = {
  budgetPerPerson: 30,
  groupSize: 4,
  activities: ['dinner', 'drinks'],
  startTime: '2026-10-30T20:00:00Z',
  endTime: '2026-10-31T02:00:00Z',
  maxDistanceKm: 3,
  transport: ['walking'],
};

describe('endpoints', () => {
  it('getHealth calls GET /health with a short timeout', async () => {
    await getHealth();
    expect(apiRequest).toHaveBeenCalledWith('/health', { signal: undefined, timeoutMs: 5000 });
  });

  it('generatePlans posts the preferences', async () => {
    await generatePlans(preferences);
    expect(apiRequest).toHaveBeenCalledWith('/api/plans/generate', {
      method: 'POST',
      body: { preferences },
      signal: undefined,
    });
  });
});
