import { apiRequest } from '@/api/client';
import { GeneratePlansTimeoutMs } from '@/api/plans';
import type {
  CastVoteRequest,
  CreateGroupRequest,
  Group,
  GroupPlanRound,
  GroupPlansResponse,
  GroupsResponse,
  GroupVoteResults,
  NightPreferences,
  Plan,
  SwapGroupStopRequest,
} from '@/types/api';

/* Groups need an account: every call needs the account's access token. */
function authorization(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

/* Your groups, newest first */
export function listGroups(accessToken: string, signal?: AbortSignal) {
  return apiRequest<GroupsResponse>('/api/groups', { headers: authorization(accessToken), signal });
}

/* Creates a group with you as its owner. The members must be your friends (403 otherwise). */
export function createGroup(
  accessToken: string,
  request: CreateGroupRequest,
  signal?: AbortSignal,
) {
  return apiRequest<Group>('/api/groups', {
    method: 'POST',
    body: request,
    headers: authorization(accessToken),
    signal,
  });
}

/* The group and its members. 404 when it doesn't exist or you are not a member */
export function getGroup(accessToken: string, groupId: string, signal?: AbortSignal) {
  return apiRequest<Group>(`/api/groups/${encodeURIComponent(groupId)}`, {
    headers: authorization(accessToken),
    signal,
  });
}

/*
 * Adds one of your friends to the group; any member can. Adding someone who is already a member does nothing.
 * 403 when the user is not your friend, 404 when you are not a member, 409 when the group is full.
 */
export function addGroupMember(
  accessToken: string,
  groupId: string,
  userId: string,
  signal?: AbortSignal,
) {
  return apiRequest<void>(
    `/api/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
    { method: 'POST', headers: authorization(accessToken), signal },
  );
}

/*
 * Removes a member from the group; only the group's owner can (403 otherwise). With your own id you leave the
 * group instead. 204 also when the user was not a member, 404 when the group doesn't exist or you are not a member.
 */
export function removeGroupMember(
  accessToken: string,
  groupId: string,
  userId: string,
  signal?: AbortSignal,
) {
  return apiRequest<void>(
    `/api/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
    { method: 'DELETE', headers: authorization(accessToken), signal },
  );
}

/* The group's plans, newest round first. 404 when you are not a member */
export function listGroupPlans(accessToken: string, groupId: string, signal?: AbortSignal) {
  return apiRequest<GroupPlansResponse>(`/api/groups/${encodeURIComponent(groupId)}/plans`, {
    headers: authorization(accessToken),
    signal,
  });
}

function roundUrl(groupId: string, roundId: string) {
  return `/api/groups/${encodeURIComponent(groupId)}/rounds/${encodeURIComponent(roundId)}`;
}

/* Where the vote of a round stands: the votes per plan, how many members voted and your own vote */
export function getVoteResults(
  accessToken: string,
  groupId: string,
  roundId: string,
  signal?: AbortSignal,
) {
  return apiRequest<GroupVoteResults>(`${roundUrl(groupId, roundId)}/votes`, {
    headers: authorization(accessToken),
    signal,
  });
}

/* Votes for a plan of the round, or moves your vote to it. 409 once the owner has closed the vote. */
export function castVote(
  accessToken: string,
  groupId: string,
  roundId: string,
  planId: string,
  signal?: AbortSignal,
) {
  const body: CastVoteRequest = { planId };
  return apiRequest<GroupVoteResults>(`${roundUrl(groupId, roundId)}/votes/me`, {
    method: 'PUT',
    body,
    headers: authorization(accessToken),
    signal,
  });
}

/* Closes the vote: nobody can vote or change their vote any more. Only the group's owner can (403). */
export function closeVote(
  accessToken: string,
  groupId: string,
  roundId: string,
  signal?: AbortSignal,
) {
  return apiRequest<GroupVoteResults>(`${roundUrl(groupId, roundId)}/close`, {
    method: 'POST',
    headers: authorization(accessToken),
    signal,
  });
}

/* Generates plans for the group and saves them to it. The group size is the number of members. */
export function generateGroupPlans(
  accessToken: string,
  groupId: string,
  preferences: NightPreferences,
  signal?: AbortSignal,
) {
  return apiRequest<GroupPlanRound>(`/api/groups/${encodeURIComponent(groupId)}/plans/generate`, {
    method: 'POST',
    body: { preferences },
    headers: authorization(accessToken),
    signal,
    timeoutMs: GeneratePlansTimeoutMs,
  });
}

/**
 * Puts one of the swap options in place of a stop of a round's plan, while the vote is open. Everyone in the group
 * sees the changed plan; the server checks the venue against the swap options again.
 */
export function swapGroupStop(
  accessToken: string,
  groupId: string,
  roundId: string,
  planId: string,
  stopIndex: number,
  venueId: number,
  signal?: AbortSignal,
) {
  const body: SwapGroupStopRequest = { venueId };
  return apiRequest<Plan>(
    `${roundUrl(groupId, roundId)}/plans/${encodeURIComponent(planId)}/stops/${stopIndex}`,
    {
      method: 'PUT',
      body,
      headers: authorization(accessToken),
      signal,
    },
  );
}
