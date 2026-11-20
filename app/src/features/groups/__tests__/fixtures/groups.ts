import { tapasPlan } from '@/features/plans/__tests__/fixtures/plans';
import type { Friend, Group, GroupPlanRound, GroupSummary } from '@/types/api';

/** Ann (u1) owns the group; Bob (u2) is a member. */
export const crew: Group = {
  id: 'g1',
  name: 'Friday crew',
  createdAt: '2026-11-10T18:00:00Z',
  myRole: 'owner',
  members: [
    { userId: 'u1', displayName: 'Ann', role: 'owner', joinedAt: '2026-11-10T18:00:00Z' },
    { userId: 'u2', displayName: 'Bob', role: 'member', joinedAt: '2026-11-10T18:00:00Z' },
  ],
};

export const crewSummary: GroupSummary = {
  id: 'g1',
  name: 'Friday crew',
  memberCount: 2,
  myRole: 'owner',
  createdAt: '2026-11-10T18:00:00Z',
};

export const roundByBob: GroupPlanRound = {
  id: 'r1',
  createdAt: '2026-11-18T18:30:00Z',
  createdBy: { userId: 'u2', displayName: 'Bob' },
  groupSize: 2,
  plans: [tapasPlan, { ...tapasPlan, id: 'p2', title: 'Second plan' }],
};

export const bob: Friend = { userId: 'u2', displayName: 'Bob', since: '2026-11-01T18:00:00Z' };
export const carla: Friend = { userId: 'u3', displayName: 'Carla', since: '2026-11-02T18:00:00Z' };
