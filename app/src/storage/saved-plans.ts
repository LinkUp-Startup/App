import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Plan } from '@/types/api';

const KEY = 'linkup.savedPlans.v1';

export type SavedPlan = Plan & { savedAt: string };

export async function getSavedPlans(): Promise<SavedPlan[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SavedPlan[];
  } catch {
    return [];
  }
}

export async function savePlan(plan: Plan) {
  const plans = await getSavedPlans();
  const next = [{ ...plan, savedAt: new Date().toISOString() }, ...plans.filter((p) => p.id !== plan.id)];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function removePlan(id: string) {
  const plans = await getSavedPlans();
  await AsyncStorage.setItem(KEY, JSON.stringify(plans.filter((p) => p.id !== id)));
}
