import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Plan } from '@/types/api';

const KEY = 'linkup.savedPlans.v1';

/**
 * A plan kept on this device. `synced` means it is also saved to the signed-in account; plans without it
 * were saved as a guest (or while offline) and are uploaded the next time the account syncs. `shareUrl` is
 * the plan's public link while the account shares it.
 */
export type SavedPlan = Plan & { savedAt: string; synced?: boolean; shareUrl?: string };

// Every read and write goes through this queue, so they happen in the order they were called: a read right
// after a write (or after clearing on sign-out) always sees it, and two writes never overwrite each other.
let queue: Promise<unknown> = Promise.resolve();
function inOrder<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation, operation);
  queue = result.catch(() => undefined);
  return result;
}

async function read(): Promise<SavedPlan[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SavedPlan[];
  } catch {
    return [];
  }
}

const write = (plans: SavedPlan[]) => AsyncStorage.setItem(KEY, JSON.stringify(plans));

export function getSavedPlans(): Promise<SavedPlan[]> {
  return inOrder(read);
}

export async function getSavedPlan(id: string): Promise<SavedPlan | undefined> {
  return (await getSavedPlans()).find((plan) => plan.id === id);
}

export function savePlan(
  plan: Plan,
  {
    savedAt = new Date().toISOString(),
    synced,
    shareUrl,
  }: { savedAt?: string; synced?: boolean; shareUrl?: string | null } = {},
) {
  return inOrder(async () => {
    const plans = await read();
    await write([
      { ...plan, savedAt, ...(synced && { synced }), ...(shareUrl && { shareUrl }) },
      ...plans.filter((p) => p.id !== plan.id),
    ]);
  });
}

/** Records the plan's public link, or that it is no longer shared (null). Does nothing for an unknown plan. */
export function setShareUrl(id: string, shareUrl: string | null) {
  return inOrder(async () =>
    write(
      (await read()).map((plan) => {
        if (plan.id !== id) return plan;
        const { shareUrl: _previous, ...rest } = plan;
        return shareUrl ? { ...rest, shareUrl } : rest;
      }),
    ),
  );
}

export function removePlan(id: string) {
  return inOrder(async () => write((await read()).filter((p) => p.id !== id)));
}

/** Replaces everything kept on this device, e.g. with the result of syncing with the account. */
export function replaceSavedPlans(plans: SavedPlan[]) {
  return inOrder(() => write(plans));
}

/** Removes every plan from this device. The account's own copies are not touched. */
export function clearSavedPlans() {
  return inOrder(() => AsyncStorage.removeItem(KEY));
}

/**
 * Removes the plans that are safe in the account (on sign-out), keeping the ones that never reached it, e.g.
 * saved while offline, so they aren't lost; they are uploaded the next time someone signs in.
 */
export function clearSyncedPlans() {
  return inOrder(async () => {
    const unsynced = (await read()).filter((plan) => !plan.synced);
    if (unsynced.length === 0) await AsyncStorage.removeItem(KEY);
    else await write(unsynced);
  });
}
