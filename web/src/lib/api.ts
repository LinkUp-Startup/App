/**
 * The LinkUp API, as the website uses it. Types come from the generated contract in shared/ (type-only, so
 * nothing outside web/ ends up in the bundle).
 */
import type { components } from '@shared/api';

export type Plan = components['schemas']['PlanDto'];
type SharedPlan = components['schemas']['SharedPlanDto'];

export const apiUrl = () =>
  (process.env.LINKUP_API_URL ?? 'https://linkup-api.th7bo.dev').replace(/\/$/, '');

/** The plan behind a share link, or null when the link is unknown or no longer shared. */
export async function getSharedPlan(token: string): Promise<Plan | null> {
  // Not cached: when the owner stops sharing, the link must stop working straight away.
  const response = await fetch(`${apiUrl()}/api/shared-plans/${encodeURIComponent(token)}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`The API answered ${response.status} for a shared plan.`);
  return ((await response.json()) as SharedPlan).plan;
}
