import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSharedPlan, savePlan, SessionExpiredError } from '@/lib/api';
import { endSession, getSession } from '@/lib/session';
import { samplePlan } from '@/lib/__tests__/sample-plan';
import { saveSharedPlan } from '../plans';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  getSharedPlan: vi.fn(),
  savePlan: vi.fn(),
}));
vi.mock('@/lib/session', () => ({ getSession: vi.fn(), endSession: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSession).mockResolvedValue({ accessToken: 'jwt', displayName: 'Ann' });
  vi.mocked(getSharedPlan).mockResolvedValue(samplePlan);
  vi.mocked(savePlan).mockResolvedValue('saved');
});

describe('saveSharedPlan', () => {
  it('saves the plan fetched from its link to the account', async () => {
    await expect(saveSharedPlan('tok')).resolves.toEqual({ saved: true });

    expect(getSharedPlan).toHaveBeenCalledWith('tok');
    expect(savePlan).toHaveBeenCalledWith('jwt', samplePlan);
  });

  it('sends someone who is not logged in to log in and back', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    await expect(saveSharedPlan('tok')).rejects.toThrow('REDIRECT /login?next=%2Fplan%2Ftok');
    expect(savePlan).not.toHaveBeenCalled();
  });

  it('logs out and asks to log in again when the session expired', async () => {
    vi.mocked(savePlan).mockRejectedValue(new SessionExpiredError());

    await expect(saveSharedPlan('tok')).rejects.toThrow('REDIRECT /login?next=%2Fplan%2Ftok');
    expect(endSession).toHaveBeenCalled();
  });

  it('explains when the plan is no longer shared', async () => {
    vi.mocked(getSharedPlan).mockResolvedValue(null);

    await expect(saveSharedPlan('tok')).resolves.toEqual({
      error: 'This plan isn’t shared anymore, so it can’t be saved.',
    });
    expect(savePlan).not.toHaveBeenCalled();
  });

  it('explains when the account is full', async () => {
    vi.mocked(savePlan).mockResolvedValue('limit');

    await expect(saveSharedPlan('tok')).resolves.toMatchObject({
      error: expect.stringMatching(/full/),
    });
  });

  it('explains other failures', async () => {
    vi.mocked(savePlan).mockRejectedValue(new Error('500'));

    await expect(saveSharedPlan('tok')).resolves.toMatchObject({
      error: 'Couldn’t save the plan right now. Try again in a moment.',
    });
  });
});
