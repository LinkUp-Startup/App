import { apiRequest } from '@/api/client';
import type { GeneratePlansResponse, NightPreferences } from '@/types/api';

export function generatePlans(preferences: NightPreferences, signal?: AbortSignal) {
  return apiRequest<GeneratePlansResponse>('/api/plans/generate', {
    method: 'POST',
    body: { preferences },
    signal,
  });
}
