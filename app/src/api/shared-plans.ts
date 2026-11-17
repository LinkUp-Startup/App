import { apiRequest } from '@/api/client';
import type { SharedPlan } from '@/types/api';

/** A plan someone shared (#153). No account needed; 404 when the link is unknown or no longer shared. */
export function getSharedPlan(token: string, signal?: AbortSignal) {
  return apiRequest<SharedPlan>(`/api/shared-plans/${encodeURIComponent(token)}`, { signal });
}
