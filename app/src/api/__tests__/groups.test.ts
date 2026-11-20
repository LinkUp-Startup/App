import { apiRequest } from '@/api/client';
import {
  createGroup,
  generateGroupPlans,
  getGroup,
  listGroupPlans,
  listGroups,
} from '@/api/groups';
import { GeneratePlansTimeoutMs } from '@/api/plans';
import type { NightPreferences } from '@/types/api';

jest.mock('@/api/client', () => ({ apiRequest: jest.fn() }));

const headers = { Authorization: 'Bearer token-1' };

afterEach(() => jest.clearAllMocks());

describe('groups endpoints', () => {
  it('listGroups gets your groups and returns what the server sent', async () => {
    const groups = { groups: [] };
    jest.mocked(apiRequest).mockResolvedValue(groups);
    const signal = new AbortController().signal;

    await expect(listGroups('token-1', signal)).resolves.toBe(groups);
    expect(apiRequest).toHaveBeenCalledWith('/api/groups', { headers, signal });
  });

  it('createGroup posts the name and members', async () => {
    await createGroup('token-1', { name: 'Crew', memberIds: ['u2'] });

    expect(apiRequest).toHaveBeenCalledWith('/api/groups', {
      method: 'POST',
      body: { name: 'Crew', memberIds: ['u2'] },
      headers,
      signal: undefined,
    });
  });

  it('getGroup escapes the group id', async () => {
    await getGroup('token-1', 'g/1');

    expect(apiRequest).toHaveBeenCalledWith('/api/groups/g%2F1', { headers, signal: undefined });
  });

  it('listGroupPlans gets the group plans', async () => {
    await listGroupPlans('token-1', 'g1');

    expect(apiRequest).toHaveBeenCalledWith('/api/groups/g1/plans', { headers, signal: undefined });
  });

  it('generateGroupPlans posts the preferences with the longer generation timeout', async () => {
    const preferences = { groupSize: 3 } as NightPreferences;

    await generateGroupPlans('token-1', 'g1', preferences);

    expect(apiRequest).toHaveBeenCalledWith('/api/groups/g1/plans/generate', {
      method: 'POST',
      body: { preferences },
      headers,
      signal: undefined,
      timeoutMs: GeneratePlansTimeoutMs,
    });
  });
});
