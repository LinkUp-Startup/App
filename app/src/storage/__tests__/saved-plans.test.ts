import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearSavedPlans,
  getSavedPlan,
  getSavedPlans,
  removePlan,
  replaceSavedPlans,
  savePlan,
} from '@/storage/saved-plans';
import type { Plan } from '@/types/api';

function plan(id: string): Plan {
  return {
    id,
    title: `Plan ${id}`,
    summary: '',
    items: [],
    estimatedCostPerPerson: 20,
    estimatedTotalCost: 80,
    totalDistanceKm: 1,
  };
}

beforeEach(() => AsyncStorage.clear());

describe('saved plans', () => {
  it('starts empty', async () => {
    await expect(getSavedPlans()).resolves.toEqual([]);
  });

  it('saves newest first with a savedAt timestamp', async () => {
    await savePlan(plan('a'));
    await savePlan(plan('b'));

    const saved = await getSavedPlans();
    expect(saved.map((p) => p.id)).toEqual(['b', 'a']);
    expect(Date.parse(saved[0].savedAt)).not.toBeNaN();
  });

  it('replaces a plan that is saved again instead of duplicating it', async () => {
    await savePlan(plan('a'));
    await savePlan(plan('b'));
    await savePlan(plan('a'));

    expect((await getSavedPlans()).map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('finds one saved plan by id', async () => {
    await savePlan(plan('a'));

    expect((await getSavedPlan('a'))?.title).toBe('Plan a');
    await expect(getSavedPlan('missing')).resolves.toBeUndefined();
  });

  it('removes a plan', async () => {
    await savePlan(plan('a'));
    await savePlan(plan('b'));
    await removePlan('a');

    expect((await getSavedPlans()).map((p) => p.id)).toEqual(['b']);
  });

  it('keeps the time and the synced mark it is given, for plans that come from the account', async () => {
    await savePlan(plan('a'), { savedAt: '2026-10-01T10:00:00.000Z', synced: true });

    expect(await getSavedPlans()).toEqual([
      { ...plan('a'), savedAt: '2026-10-01T10:00:00.000Z', synced: true },
    ]);
  });

  it('does not mark a plan as synced unless told to', async () => {
    await savePlan(plan('a'));

    expect('synced' in (await getSavedPlans())[0]).toBe(false);
  });

  it('replaces everything on the device', async () => {
    await savePlan(plan('a'));

    await replaceSavedPlans([{ ...plan('b'), savedAt: '2026-10-01T10:00:00.000Z' }]);

    expect((await getSavedPlans()).map((p) => p.id)).toEqual(['b']);
  });

  it('clears everything on the device', async () => {
    await savePlan(plan('a'));
    await savePlan(plan('b'));

    await clearSavedPlans();

    await expect(getSavedPlans()).resolves.toEqual([]);
  });

  it('treats corrupted storage as empty', async () => {
    await AsyncStorage.setItem('linkup.savedPlans.v1', '{not json');

    await expect(getSavedPlans()).resolves.toEqual([]);
  });
});
