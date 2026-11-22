import { apiRequest } from '@/api/client';
import { deleteReceivedPlan, listReceivedPlans } from '@/api/received-plans';
import { sendPlanToFriend } from '@/api/saved-plans';

jest.mock('@/api/client', () => ({ apiRequest: jest.fn() }));

const headers = { Authorization: 'Bearer token-1' };

afterEach(() => jest.clearAllMocks());

describe('sending plans to friends', () => {
  it('sendPlanToFriend posts to the friend, escaping both ids', async () => {
    await sendPlanToFriend('token-1', 'p/1', 'u 2');

    expect(apiRequest).toHaveBeenCalledWith('/api/saved-plans/p%2F1/send/u%202', {
      method: 'POST',
      headers,
      signal: undefined,
    });
  });

  it('listReceivedPlans gets the plans friends sent and returns what the server sent', async () => {
    const received = { plans: [] };
    jest.mocked(apiRequest).mockResolvedValue(received);
    const signal = new AbortController().signal;

    await expect(listReceivedPlans('token-1', signal)).resolves.toBe(received);
    expect(apiRequest).toHaveBeenCalledWith('/api/received-plans', { headers, signal });
  });

  it('deleteReceivedPlan deletes one received plan', async () => {
    await deleteReceivedPlan('token-1', 'r1');

    expect(apiRequest).toHaveBeenCalledWith('/api/received-plans/r1', {
      method: 'DELETE',
      headers,
      signal: undefined,
    });
  });
});
