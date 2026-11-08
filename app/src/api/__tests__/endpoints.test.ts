import { apiRequest } from '@/api/client';
import { getHealth } from '@/api/health';
import { generatePlans } from '@/api/plans';
import {
  deleteSavedPlan,
  listSavedPlans,
  putSavedPlan,
  sharePlan,
  unsharePlan,
} from '@/api/saved-plans';
import { getSharedPlan } from '@/api/shared-plans';
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
      timeoutMs: 60000,
    });
  });

  describe('saved plans', () => {
    const plan = {
      id: 'a b/c',
      title: 'Tapas',
      summary: '',
      items: [],
      estimatedCostPerPerson: 20,
      estimatedTotalCost: 40,
      totalDistanceKm: 1,
    };
    const headers = { Authorization: 'Bearer token-1' };

    it('listSavedPlans sends the account token', async () => {
      await listSavedPlans('token-1');
      expect(apiRequest).toHaveBeenCalledWith('/api/saved-plans', { headers, signal: undefined });
    });

    it('putSavedPlan puts the plan under its id, escaped for the URL', async () => {
      await putSavedPlan('token-1', plan);
      expect(apiRequest).toHaveBeenCalledWith('/api/saved-plans/a%20b%2Fc', {
        method: 'PUT',
        headers,
        body: plan,
        signal: undefined,
      });
    });

    it('deleteSavedPlan deletes by id, escaped for the URL', async () => {
      await deleteSavedPlan('token-1', 'a b/c');
      expect(apiRequest).toHaveBeenCalledWith('/api/saved-plans/a%20b%2Fc', {
        method: 'DELETE',
        headers,
        signal: undefined,
      });
    });

    it("sharePlan posts to the plan's share link", async () => {
      await sharePlan('token-1', 'a b/c');
      expect(apiRequest).toHaveBeenCalledWith('/api/saved-plans/a%20b%2Fc/share', {
        method: 'POST',
        headers,
        signal: undefined,
      });
    });

    it("unsharePlan deletes the plan's share link", async () => {
      await unsharePlan('token-1', 'a b/c');
      expect(apiRequest).toHaveBeenCalledWith('/api/saved-plans/a%20b%2Fc/share', {
        method: 'DELETE',
        headers,
        signal: undefined,
      });
    });
  });

  it('getSharedPlan opens a shared plan without an account, token escaped for the URL', async () => {
    await getSharedPlan('a/b');
    expect(apiRequest).toHaveBeenCalledWith('/api/shared-plans/a%2Fb', { signal: undefined });
  });
});
