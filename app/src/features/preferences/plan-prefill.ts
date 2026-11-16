import type { PreferencesForm } from '@/features/preferences/form';
import type { UserPreferences } from '@/types/api';

/** Map validated defaults onto the original plan defaults, without touching times, notes or location. */
export function savedPlanFields(saved: UserPreferences, initial: PreferencesForm) {
  return {
    budget: saved.budgetPerPerson == null ? initial.budget : String(saved.budgetPerPerson),
    groupSize: saved.groupSize ?? initial.groupSize,
    maxDistanceKm: saved.maxDistanceKm ?? initial.maxDistanceKm,
    activities: [...(saved.activities?.length ? saved.activities : initial.activities)],
    transport: [...(saved.transport?.length ? saved.transport : initial.transport)],
  };
}
