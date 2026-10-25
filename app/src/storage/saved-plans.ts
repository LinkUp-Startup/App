import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Plan } from '@/types/api';

const KEY = 'linkup.savedPlans.v1';

/**
 * A plan kept on this device. `synced` means it is also saved to the signed-in account; plans without it
 * were saved as a guest (or while offline) and are uploaded the next time the account syncs.
 */
export type SavedPlan = Plan & { savedAt: string; synced?: boolean };

export async function getSavedPlans(): Promise<SavedPlan[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SavedPlan[];
  } catch {
    return [];
  }
}

export async function getSavedPlan(id: string): Promise<SavedPlan | undefined> {
  return (await getSavedPlans()).find((plan) => plan.id === id);
}

export async function savePlan(
  plan: Plan,
  { savedAt = new Date().toISOString(), synced }: { savedAt?: string; synced?: boolean } = {},
) {
  const plans = await getSavedPlans();
  const next: SavedPlan[] = [
    { ...plan, savedAt, ...(synced && { synced }) },
    ...plans.filter((p) => p.id !== plan.id),
  ];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function removePlan(id: string) {
  const plans = await getSavedPlans();
  await AsyncStorage.setItem(KEY, JSON.stringify(plans.filter((p) => p.id !== id)));
}

/** Replaces everything kept on this device, e.g. with the result of syncing with the account. */
export async function replaceSavedPlans(plans: SavedPlan[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(plans));
}

/** Removes every plan from this device. The account's own copies are not touched. */
export async function clearSavedPlans() {
  await AsyncStorage.removeItem(KEY);
}
