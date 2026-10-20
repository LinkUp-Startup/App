import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSavedPlans, removePlan, savePlan } from '@/storage/saved-plans';
import type { Plan } from '@/types/api';

function plan(id: string): Plan {
  return {
    id,
    title: `Plan ${id}`,
    summary: '',
    items: [],
    estimatedCostPerPerson: 20,
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

  it('removes a plan', async () => {
    await savePlan(plan('a'));
    await savePlan(plan('b'));
    await removePlan('a');

    expect((await getSavedPlans()).map((p) => p.id)).toEqual(['b']);
  });

  it('treats corrupted storage as empty', async () => {
    await AsyncStorage.setItem('linkup.savedPlans.v1', '{not json');

    await expect(getSavedPlans()).resolves.toEqual([]);
  });
});
