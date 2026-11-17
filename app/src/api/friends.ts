import { apiRequest } from '@/api/client';
import type { FriendsResponse, UserSearchResponse } from '@/types/api';

/* Friends need an account: every call needs the account's access token. */
function authorization(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

/* Users whose display name contains the text (at least 2 characters). Never returns email addresses. */
export function searchUsers(accessToken: string, query: string, signal?: AbortSignal) {
  return apiRequest<UserSearchResponse>(`/api/users/search?query=${encodeURIComponent(query)}`, {
    headers: authorization(accessToken),
    signal,
  });
}

/* - Sends a friend request
   - Succeeds also when it was already sent
   - 409 when you are already friends or the user already sent you a request */
export function sendFriendRequest(accessToken: string, userId: string, signal?: AbortSignal) {
  return apiRequest<void>(`/api/friends/requests/${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: authorization(accessToken),
    signal,
  });
}

/* Your friends, the requests you received and the requests you sent */
export function listFriends(accessToken: string, signal?: AbortSignal) {
  return apiRequest<FriendsResponse>('/api/friends', {
    headers: authorization(accessToken),
    signal,
  });
}

/* Accepts the request this user sent you. 404 when it is no longer pending */
export function acceptFriendRequest(accessToken: string, userId: string, signal?: AbortSignal) {
  return apiRequest<void>(`/api/friends/requests/${encodeURIComponent(userId)}/accept`, {
    method: 'POST',
    headers: authorization(accessToken),
    signal,
  });
}

/* Declines the request this user sent you. 404 when it is no longer pending */
export function declineFriendRequest(accessToken: string, userId: string, signal?: AbortSignal) {
  return apiRequest<void>(`/api/friends/requests/${encodeURIComponent(userId)}/decline`, {
    method: 'POST',
    headers: authorization(accessToken),
    signal,
  });
}
