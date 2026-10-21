import { apiRequest } from '@/api/client';
import type { GeneratePlansResponse, NightPreferences } from '@/types/api';

/** Plan generation calls an AI model on the server, so allow more time than other requests. */
export const GeneratePlansTimeoutMs = 60_000;

export function generatePlans(preferences: NightPreferences, signal?: AbortSignal) {
  return apiRequest<GeneratePlansResponse>('/api/plans/generate', {
    method: 'POST',
    body: { preferences },
    signal,
    timeoutMs: GeneratePlansTimeoutMs,
  });
}
