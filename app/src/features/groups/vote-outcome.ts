import type { GroupVoteResults, Plan } from '@/types/api';

/**
 * How a vote came out. The server decides which plans lead (winnerPlanIds): once every member has voted or the owner
 * has closed the vote. Until the owner closes it, members can still change their vote, so it can still change.
 */
export type VoteOutcome =
  | { kind: 'pending' }
  /** The owner closed the vote and nobody had voted. */
  | { kind: 'nobody' }
  | { kind: 'winner'; plan: Plan; votes: number }
  /** Several plans share the most votes. */
  | { kind: 'tie'; plans: Plan[]; votes: number };

export function voteOutcome(results: GroupVoteResults, plans: Plan[]): VoteOutcome {
  const leading = results.winnerPlanIds.flatMap((id) => plans.find((plan) => plan.id === id) ?? []);
  if (leading.length === 0)
    return results.closedAt == null ? { kind: 'pending' } : { kind: 'nobody' };

  const votes = results.plans.find((plan) => plan.planId === leading[0].id)?.votes ?? 0;
  return leading.length === 1
    ? { kind: 'winner', plan: leading[0], votes }
    : { kind: 'tie', plans: leading, votes };
}

/** The tag on a plan that leads: "Winner" once the vote is closed, "Leading" while it is still open. */
export function standingOf(outcome: VoteOutcome, planId: string, closed: boolean) {
  if (outcome.kind === 'winner' && outcome.plan.id === planId) return closed ? 'Winner' : 'Leading';
  if (outcome.kind === 'tie' && outcome.plans.some((plan) => plan.id === planId)) {
    return 'Tied for first';
  }
  return undefined;
}

/** "A", "A and B", "A, B and C" */
export function joinNames(names: string[]) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
