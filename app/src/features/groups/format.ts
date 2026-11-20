import { formatNightDate } from '@/features/plans/format';
import type { GroupPlanRound, GroupSummary } from '@/types/api';

export function memberCount(count: number) {
  return count === 1 ? '1 member' : `${count} members`;
}

/* "3 members · You own it" */
export function groupSummaryLine(group: GroupSummary) {
  return group.myRole === 'owner'
    ? `${memberCount(group.memberCount)} · You own it`
    : memberCount(group.memberCount);
}

export function people(count: number) {
  return count === 1 ? '1 person' : `${count} people`;
}

/* "By Ann · Wed 18 Nov, 19:30 · for 3 people" */
export function roundLine(round: GroupPlanRound, myUserId: string | undefined) {
  const author =
    round.createdBy == null
      ? 'By a former member'
      : round.createdBy.userId === myUserId
        ? 'By you'
        : `By ${round.createdBy.displayName}`;
  const time = new Date(round.createdAt).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${author} · ${formatNightDate(round.createdAt)}, ${time} · for ${people(round.groupSize)}`;
}
