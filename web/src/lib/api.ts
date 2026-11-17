/**
 * The LinkUp API, as the website uses it. Types come from the generated contract in shared/ (type-only, so
 * nothing outside web/ ends up in the bundle).
 */
import type { components } from '@shared/api';

export type Plan = components['schemas']['PlanDto'];
type SharedPlan = components['schemas']['SharedPlanDto'];
type SavedPlans = components['schemas']['SavedPlansResponse'];

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

/** The access token is no longer valid (expired, or the account was deleted). */
export class SessionExpiredError extends Error {
  constructor() {
    super('The session has expired.');
    this.name = 'SessionExpiredError';
  }
}

const authorized = (accessToken: string) => ({
  Accept: 'application/json',
  Authorization: `Bearer ${accessToken}`,
});

/** Whether the account already saved a plan with this id. */
export async function hasSavedPlan(accessToken: string, planId: string): Promise<boolean> {
  const response = await fetch(`${apiUrl()}/api/saved-plans`, {
    cache: 'no-store',
    headers: authorized(accessToken),
  });
  if (response.status === 401) throw new SessionExpiredError();
  if (!response.ok) throw new Error(`The API answered ${response.status} for saved plans.`);
  return ((await response.json()) as SavedPlans).plans.some(({ plan }) => plan.id === planId);
}

export type SaveResult = 'saved' | 'limit';

/** Saves the account's own copy of a plan; it stays when the original is deleted. */
export async function savePlan(accessToken: string, plan: Plan): Promise<SaveResult> {
  const response = await fetch(`${apiUrl()}/api/saved-plans/${encodeURIComponent(plan.id)}`, {
    method: 'PUT',
    cache: 'no-store',
    headers: { ...authorized(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify(plan),
  });
  if (response.status === 401) throw new SessionExpiredError();
  if (response.status === 409) return 'limit';
  if (!response.ok) throw new Error(`The API answered ${response.status} when saving a plan.`);
  return 'saved';
}
