import { decidedPlan } from '@/features/groups/winning-plan';
import { tapasPlan } from '@/features/plans/__tests__/fixtures/plans';
import type { Plan } from '@/types/api';

const tapas = tapasPlan;
const bowling: Plan = { ...tapasPlan, id: 'p2', title: 'Bowling night' };
const closedAt = '2026-11-20T21:00:00Z';

describe('decidedPlan', () => {
  it('is the winner once the vote is closed and exactly one plan won', () => {
    expect(decidedPlan(closedAt, ['p2'], [tapas, bowling])).toBe(bowling);
  });

  it('is nothing while the vote is open, even when a plan leads', () => {
    // Everyone voted, but votes can still change until the owner closes the vote
    expect(decidedPlan(null, ['p2'], [tapas, bowling])).toBeUndefined();
    expect(decidedPlan(undefined, ['p2'], [tapas, bowling])).toBeUndefined();
  });

  it('is nothing for a tie, so every plan keeps being shown', () => {
    expect(decidedPlan(closedAt, ['p1', 'p2'], [tapas, bowling])).toBeUndefined();
  });

  it('is nothing for a closed vote without votes', () => {
    expect(decidedPlan(closedAt, [], [tapas, bowling])).toBeUndefined();
  });

  it('is nothing when the server sends no winners yet', () => {
    expect(decidedPlan(closedAt, undefined, [tapas, bowling])).toBeUndefined();
  });

  it('is nothing when the winner is not one of the plans', () => {
    expect(decidedPlan(closedAt, ['gone'], [tapas, bowling])).toBeUndefined();
  });
});
