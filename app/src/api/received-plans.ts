import { apiRequest } from '@/api/client';
import type { ReceivedPlansResponse } from '@/types/api';

/* Plans friends sent you (#207). Every call needs the account's access token. */
function authorization(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

/* The plans friends sent you, newest first, each with who sent it */
export function listReceivedPlans(accessToken: string, signal?: AbortSignal) {
  return apiRequest<ReceivedPlansResponse>('/api/received-plans', {
    headers: authorization(accessToken),
    signal,
  });
}

/* Succeeds whether or not it was there, so a retry is harmless. A copy you saved stays saved. */
export function deleteReceivedPlan(accessToken: string, id: string, signal?: AbortSignal) {
  return apiRequest<void>(`/api/received-plans/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authorization(accessToken),
    signal,
  });
}
