import { apiRequest } from '@/api/client';
import { GeneratePlansTimeoutMs } from '@/api/plans';
import type {
  CreateGroupRequest,
  Group,
  GroupPlanRound,
  GroupPlansResponse,
  GroupsResponse,
  NightPreferences,
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

/* The group's plans, newest round first. 404 when you are not a member */
export function listGroupPlans(accessToken: string, groupId: string, signal?: AbortSignal) {
  return apiRequest<GroupPlansResponse>(`/api/groups/${encodeURIComponent(groupId)}/plans`, {
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
