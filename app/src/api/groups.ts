import { apiRequest } from '@/api/client';
import type { CreateGroupRequest, Group, GroupsResponse } from '@/types/api';

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
