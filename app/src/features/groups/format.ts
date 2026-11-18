import type { GroupSummary } from '@/types/api';

export function memberCount(count: number) {
  return count === 1 ? '1 member' : `${count} members`;
}

/* "3 members · You own it" */
export function groupSummaryLine(group: GroupSummary) {
  return group.myRole === 'owner'
    ? `${memberCount(group.memberCount)} · You own it`
    : memberCount(group.memberCount);
}
