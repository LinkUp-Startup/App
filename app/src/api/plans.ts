import { apiRequest } from '@/api/client';
import type {
  GeneratePlansResponse,
  NightPreferences,
  SwapOptionsRequest,
  SwapOptionsResponse,
} from '@/types/api';

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

/** Other places for one stop of a plan (#229), each as the whole plan with that stop replaced. */
export function swapOptions(request: SwapOptionsRequest, signal?: AbortSignal) {
  return apiRequest<SwapOptionsResponse>('/api/plans/swap-options', {
    method: 'POST',
    body: request,
    signal,
  });
}
