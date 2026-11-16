import { apiRequest } from '@/api/client';
import { searchUsers, sendFriendRequest } from '@/api/friends';

jest.mock('@/api/client', () => ({ apiRequest: jest.fn() }));

const headers = { Authorization: 'Bearer token-1' };

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
});
