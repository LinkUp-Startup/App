import { apiRequest } from '@/api/client';
import {
  acceptFriendRequest,
  declineFriendRequest,
  listFriends,
  searchUsers,
  sendFriendRequest,
} from '@/api/friends';

jest.mock('@/api/client', () => ({ apiRequest: jest.fn() }));

const headers = { Authorization: 'Bearer token-1' };

afterEach(() => jest.clearAllMocks());

describe('friends endpoints', () => {
  it('searchUsers sends the query, escaped for the URL, with the account token', async () => {
    await searchUsers('token-1', 'Ann & Bob');
    expect(apiRequest).toHaveBeenCalledWith('/api/users/search?query=Ann%20%26%20Bob', {
      headers,
      signal: undefined,
    });
  });

  it('sendFriendRequest posts to the user', async () => {
    await sendFriendRequest('token-1', 'u2');
    expect(apiRequest).toHaveBeenCalledWith('/api/friends/requests/u2', {
      method: 'POST',
      headers,
      signal: undefined,
    });
  });

  it('listFriends gets the friends list and returns what the server sent', async () => {
    const friends = { friends: [], incoming: [], outgoing: [] };
    jest.mocked(apiRequest).mockResolvedValue(friends);
    const signal = new AbortController().signal;

    await expect(listFriends('token-1', signal)).resolves.toBe(friends);
    expect(apiRequest).toHaveBeenCalledWith('/api/friends', { headers, signal });
  });

  it('acceptFriendRequest posts to the accept endpoint of the sender', async () => {
    await acceptFriendRequest('token-1', 'u2');
    expect(apiRequest).toHaveBeenCalledWith('/api/friends/requests/u2/accept', {
      method: 'POST',
      headers,
      signal: undefined,
    });
  });

  it('declineFriendRequest posts to the decline endpoint of the sender', async () => {
    await declineFriendRequest('token-1', 'u2');
    expect(apiRequest).toHaveBeenCalledWith('/api/friends/requests/u2/decline', {
      method: 'POST',
      headers,
      signal: undefined,
    });
  });

  it.each([
    ['sendFriendRequest', sendFriendRequest, '/api/friends/requests/a%2Fb'],
    ['acceptFriendRequest', acceptFriendRequest, '/api/friends/requests/a%2Fb/accept'],
    ['declineFriendRequest', declineFriendRequest, '/api/friends/requests/a%2Fb/decline'],
  ])('%s escapes the user id and passes the abort signal on', async (_, call, url) => {
    const signal = new AbortController().signal;

    await call('token-1', 'a/b', signal);

    expect(apiRequest).toHaveBeenCalledWith(url, expect.objectContaining({ signal }));
  });
});
