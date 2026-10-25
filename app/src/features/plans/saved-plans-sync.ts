import { deleteSavedPlan, listSavedPlans, putSavedPlan } from '@/api/saved-plans';
import {
  getSavedPlans,
  removePlan,
  replaceSavedPlans,
  savePlan,
  type SavedPlan,
} from '@/storage/saved-plans';
import type { Plan } from '@/types/api';

/**
 * Keeps the plans on this device and the signed-in account's plans together (#88).
 *
 * Plans are always kept on the device first, so the Saved tab works offline. A guest has only the device
 * copy. When signed in, a save also goes to the account, and syncing:
 *  - uploads plans that are only on this device (saved as a guest, or while offline), which is how a
 *    guest's plans move to the account on login;
 *  - downloads the account's plans saved on other devices;
 *  - drops device copies that are marked as synced but are gone from the account, because they were
 *    deleted on another device (without the mark they would be uploaded again).
 */

/** Where a save ended up: also in the account, or on this device only (guest, or the account was unreachable). */
export type SaveOutcome = 'account' | 'device';

export async function savePlanFor(plan: Plan, accessToken: string | null): Promise<SaveOutcome> {
  if (accessToken) {
    try {
      const saved = await putSavedPlan(accessToken, plan);
      await savePlan(plan, { savedAt: saved.savedAt, synced: true });
      return 'account';
    } catch (error) {
      // Offline, signed out meanwhile, or a server problem: keep it here, the next sync uploads it.
      console.warn('Could not save the plan to the account', error);
    }
  }
  await savePlan(plan);
  return 'device';
}

/** Deletes from the account first, so a failure leaves the plan in both places and nothing comes back later. */
export async function removePlanFor(id: string, accessToken: string | null): Promise<void> {
  if (accessToken) await deleteSavedPlan(accessToken, id);
  await removePlan(id);
}

/** Rejects when the account can't be reached; the plans on the device are then left as they were. */
export async function syncSavedPlans(
  accessToken: string,
  signal?: AbortSignal,
): Promise<SavedPlan[]> {
  const { plans: remote } = await listSavedPlans(accessToken, signal);
  const remoteIds = new Set(remote.map(({ plan }) => plan.id));

  const snapshot = await getSavedPlans();
  const uploaded: SavedPlan[] = [];
  const pending: SavedPlan[] = [];
  for (const local of snapshot) {
    if (remoteIds.has(local.id)) continue;
    if (local.synced) continue; // deleted on another device
    try {
      const saved = await putSavedPlan(accessToken, local, signal);
      uploaded.push({ ...saved.plan, savedAt: saved.savedAt, synced: true });
    } catch (error) {
      if (signal?.aborted) throw error;
      console.warn('Could not upload a saved plan', error);
      pending.push(local);
    }
  }

  // A plan saved while this was running isn't in the snapshot; don't lose it when writing the result.
  const seen = new Set(snapshot.map((plan) => plan.id));
  const savedMeanwhile = (await getSavedPlans()).filter((plan) => !seen.has(plan.id));

  const merged = [
    ...remote.map(({ plan, savedAt }) => ({ ...plan, savedAt, synced: true })),
    ...uploaded,
    ...pending,
    ...savedMeanwhile.filter((plan) => !remoteIds.has(plan.id)),
  ].sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
  await replaceSavedPlans(merged);
  return merged;
}
