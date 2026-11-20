import type { GroupSummary } from '@/types/api';

export function memberCount(count: number) {
  return count === 1 ? '1 member' : `${count} members`;
}

export function voteCount(count: number) {
  return count === 1 ? '1 vote' : `${count} votes`;
}

/* "2 of 4 voted" */
export function turnout(votesCast: number, memberCount: number) {
  return `${votesCast} of ${memberCount} voted`;
}

/* "3 members · You own it" */
export function groupSummaryLine(group: GroupSummary) {
  return group.myRole === 'owner'
    ? `${memberCount(group.memberCount)} · You own it`
    : memberCount(group.memberCount);
}
