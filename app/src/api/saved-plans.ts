import { apiRequest } from '@/api/client';
import type { Plan, SavedPlanDto, SavedPlansResponse } from '@/types/api';

/** Plans saved to the signed-in account (#88). Every call needs the account's access token. */
function authorization(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

export function listSavedPlans(accessToken: string, signal?: AbortSignal) {
  return apiRequest<SavedPlansResponse>('/api/saved-plans', {
    headers: authorization(accessToken),
    signal,
  });
}

/** Saves the plan, or replaces it when this account already saved the same plan id. */
export function putSavedPlan(accessToken: string, plan: Plan, signal?: AbortSignal) {
  return apiRequest<SavedPlanDto>(`/api/saved-plans/${encodeURIComponent(plan.id)}`, {
    method: 'PUT',
    headers: authorization(accessToken),
    body: plan,
    signal,
  });
}

/** Succeeds whether or not the plan was saved, so a retry is harmless. */
export function deleteSavedPlan(accessToken: string, id: string, signal?: AbortSignal) {
  return apiRequest<void>(`/api/saved-plans/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authorization(accessToken),
    signal,
  });
}
