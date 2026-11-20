import { tapasPlan } from '@/features/plans/__tests__/fixtures/plans';
import {
  joinNames,
  standingOf,
  voteOutcome,
  type VoteOutcome,
} from '@/features/groups/vote-outcome';
import type { GroupVoteResults, Plan } from '@/types/api';

const tapas = tapasPlan;
const bowling: Plan = { ...tapasPlan, id: 'p2', title: 'Bowling night' };
const karaoke: Plan = { ...tapasPlan, id: 'p3', title: 'Karaoke' };

const results = (over: Partial<GroupVoteResults> = {}): GroupVoteResults => ({
  roundId: 'r1',
  closedAt: null,
  memberCount: 3,
  votesCast: 0,
  myVotePlanId: null,
  plans: [
    { planId: 'p1', votes: 2 },
    { planId: 'p2', votes: 1 },
    { planId: 'p3', votes: 0 },
  ],
  winnerPlanIds: [],
  ...over,
});

describe('voteOutcome', () => {
  it('is pending while no plan leads and the vote is open', () => {
    expect(voteOutcome(results(), [tapas, bowling])).toEqual({ kind: 'pending' });
  });

  it('is "nobody" when the vote was closed and no plan leads', () => {
    expect(voteOutcome(results({ closedAt: '2026-11-20T21:00:00Z' }), [tapas, bowling])).toEqual({
      kind: 'nobody',
    });
  });

  it('is a winner with its votes when one plan leads', () => {
    expect(voteOutcome(results({ winnerPlanIds: ['p1'] }), [tapas, bowling])).toEqual({
      kind: 'winner',
      plan: tapas,
      votes: 2,
    });
  });

  it('is a tie with the plans in the order given when several plans lead', () => {
    const tied = results({
      plans: [
        { planId: 'p1', votes: 1 },
        { planId: 'p2', votes: 1 },
        { planId: 'p3', votes: 0 },
      ],
      winnerPlanIds: ['p1', 'p2'],
    });

    expect(voteOutcome(tied, [tapas, bowling, karaoke])).toEqual({
      kind: 'tie',
      plans: [tapas, bowling],
      votes: 1,
    });
  });

  it('ignores a leading plan the round does not have', () => {
    expect(voteOutcome(results({ winnerPlanIds: ['gone'] }), [tapas, bowling])).toEqual({
      kind: 'pending',
    });
  });
});

describe('standingOf', () => {
  const winner: VoteOutcome = { kind: 'winner', plan: tapas, votes: 2 };
  const tie: VoteOutcome = { kind: 'tie', plans: [tapas, bowling], votes: 1 };

  it('tags the winner "Leading" while the vote is open and "Winner" once it is closed', () => {
    expect(standingOf(winner, 'p1', false)).toBe('Leading');
    expect(standingOf(winner, 'p1', true)).toBe('Winner');
    expect(standingOf(winner, 'p2', true)).toBeUndefined();
  });

  it('tags every tied plan, and no other', () => {
    expect(standingOf(tie, 'p1', false)).toBe('Tied for first');
    expect(standingOf(tie, 'p2', true)).toBe('Tied for first');
    expect(standingOf(tie, 'p3', true)).toBeUndefined();
  });

  it('tags nothing without a leader', () => {
    expect(standingOf({ kind: 'pending' }, 'p1', false)).toBeUndefined();
    expect(standingOf({ kind: 'nobody' }, 'p1', true)).toBeUndefined();
  });
});

describe('joinNames', () => {
  it.each([
    [[], ''],
    [['A'], 'A'],
    [['A', 'B'], 'A and B'],
    [['A', 'B', 'C'], 'A, B and C'],
  ])('joins %j as "%s"', (names, expected) => {
    expect(joinNames(names)).toBe(expected);
  });
});
