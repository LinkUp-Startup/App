import type { Plan } from '@/types/api';

/**
 * The plan the group chose, once the owner has closed the vote and exactly one plan won. From then on the other
 * plans are no longer shown, and the group follows this one. Nothing else counts: an open vote (even when everyone
 * voted, because votes can still change), a tie and a vote without votes keep showing every plan.
 *
 * winnerPlanIds is missing from a server that has not been updated yet; that is "no winner", not an error.
 */
export function decidedPlan(
  closedAt: string | null | undefined,
  winnerPlanIds: readonly string[] | undefined,
  plans: readonly Plan[],
): Plan | undefined {
  if (closedAt == null || winnerPlanIds?.length !== 1) return undefined;
  return plans.find((plan) => plan.id === winnerPlanIds[0]);
}
