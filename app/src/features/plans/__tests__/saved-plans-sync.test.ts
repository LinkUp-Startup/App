import { deleteSavedPlan, listSavedPlans, putSavedPlan } from '@/api/saved-plans';
import { NetworkError } from '@/api/client';
import { removePlanFor, savePlanFor, syncSavedPlans } from '@/features/plans/saved-plans-sync';
import { getSavedPlans, savePlan } from '@/storage/saved-plans';
import type { Plan } from '@/types/api';

import { tapasPlan } from './fixtures/plans';

jest.mock('@/api/saved-plans');

const listMock = jest.mocked(listSavedPlans);
const putMock = jest.mocked(putSavedPlan);
const deleteMock = jest.mocked(deleteSavedPlan);

const token = 'token-1';
const plan = (id: string): Plan => ({ ...tapasPlan, id, title: `Plan ${id}` });
const remote = (id: string, savedAt: string) => ({ plan: plan(id), savedAt });
const ids = async () => (await getSavedPlans()).map((p) => p.id);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  listMock.mockResolvedValue({ plans: [] });
  putMock.mockImplementation(async (_token, saved) => ({
    plan: saved,
    savedAt: '2026-11-01T10:00:00.000Z',
  }));
  deleteMock.mockResolvedValue(undefined);
});

describe('savePlanFor', () => {
  it('keeps a guest plan on the device only', async () => {
    await expect(savePlanFor(plan('a'), null)).resolves.toBe('device');

    expect(putMock).not.toHaveBeenCalled();
    const [stored] = await getSavedPlans();
    expect(stored.id).toBe('a');
    expect(stored.synced).toBeUndefined();
  });

  it('saves to the account and keeps the account time and the synced mark on the device copy', async () => {
    await expect(savePlanFor(plan('a'), token)).resolves.toBe('account');

    expect(putMock).toHaveBeenCalledWith(token, plan('a'));
    expect(await getSavedPlans()).toEqual([
      { ...plan('a'), savedAt: '2026-11-01T10:00:00.000Z', synced: true },
    ]);
  });

  it('falls back to the device, not synced, when the account cannot be reached', async () => {
    putMock.mockRejectedValue(new NetworkError('offline'));

    await expect(savePlanFor(plan('a'), token)).resolves.toBe('device');

    const [stored] = await getSavedPlans();
    expect(stored.id).toBe('a');
    expect(stored.synced).toBeUndefined();
  });
});

describe('removePlanFor', () => {
  it('removes a guest plan from the device without calling the account', async () => {
    await savePlan(plan('a'));

    await removePlanFor('a', null);

    expect(deleteMock).not.toHaveBeenCalled();
    expect(await ids()).toEqual([]);
  });

  it('removes from the account first, then from the device', async () => {
    await savePlan(plan('a'));
    deleteMock.mockImplementation(async () => {
      // At the moment the account is asked, the device still has the plan.
      expect(await ids()).toEqual(['a']);
    });

    await removePlanFor('a', token);

    expect(deleteMock).toHaveBeenCalledWith(token, 'a');
    expect(await ids()).toEqual([]);
  });

  it('keeps the plan on the device when the account cannot be reached', async () => {
    await savePlan(plan('a'));
    deleteMock.mockRejectedValue(new NetworkError('offline'));

    await expect(removePlanFor('a', token)).rejects.toThrow('offline');

    expect(await ids()).toEqual(['a']);
  });
});

describe('syncSavedPlans', () => {
  it("downloads the account's plans, newest first, marked as synced", async () => {
    listMock.mockResolvedValue({
      plans: [remote('old', '2026-10-01T10:00:00.000Z'), remote('new', '2026-10-05T10:00:00.000Z')],
    });

    const merged = await syncSavedPlans(token);

    expect(merged.map((p) => p.id)).toEqual(['new', 'old']);
    expect(merged.every((p) => p.synced)).toBe(true);
    expect(await getSavedPlans()).toEqual(merged);
    expect(listMock).toHaveBeenCalledWith(token, undefined);
  });

  it("uploads a guest's plans, so they move to the account on login", async () => {
    await savePlan(plan('guest'));

    const merged = await syncSavedPlans(token);

    expect(putMock).toHaveBeenCalledWith(
      token,
      expect.objectContaining({ id: 'guest' }),
      undefined,
    );
    expect(merged).toEqual([
      { ...plan('guest'), savedAt: '2026-11-01T10:00:00.000Z', synced: true },
    ]);
  });

  it('does not upload plans the account already has', async () => {
    await savePlan(plan('a'), { synced: true });
    listMock.mockResolvedValue({ plans: [remote('a', '2026-10-01T10:00:00.000Z')] });

    await syncSavedPlans(token);

    expect(putMock).not.toHaveBeenCalled();
  });

  it('keeps a plan that could not be uploaded, to try again next time', async () => {
    await savePlan(plan('a'));
    putMock.mockRejectedValue(new NetworkError('offline'));

    const merged = await syncSavedPlans(token);

    expect(merged.map((p) => p.id)).toEqual(['a']);
    expect(merged[0].synced).toBeUndefined();
  });

  it('drops a synced plan that was deleted on another device, without uploading it again', async () => {
    await savePlan(plan('gone'), { synced: true });
    await savePlan(plan('mine'));
    listMock.mockResolvedValue({ plans: [remote('other', '2026-10-01T10:00:00.000Z')] });

    const merged = await syncSavedPlans(token);

    expect(merged.map((p) => p.id).sort()).toEqual(['mine', 'other']);
    expect(putMock).toHaveBeenCalledTimes(1);
    expect(putMock).toHaveBeenCalledWith(token, expect.objectContaining({ id: 'mine' }), undefined);
  });

  it('leaves the plans on the device alone when the account cannot be reached', async () => {
    await savePlan(plan('a'));
    listMock.mockRejectedValue(new NetworkError('offline'));

    await expect(syncSavedPlans(token)).rejects.toThrow('offline');

    expect(await ids()).toEqual(['a']);
  });

  it('keeps a plan saved while the sync was running', async () => {
    await savePlan(plan('a'));
    putMock.mockImplementation(async (_token, saved) => {
      await savePlan(plan('late')); // the user saves another plan mid-sync
      return { plan: saved, savedAt: '2026-11-01T10:00:00.000Z' };
    });

    await syncSavedPlans(token);

    expect((await ids()).sort()).toEqual(['a', 'late']);
  });

  it('stops when it is aborted instead of treating it as a failed upload', async () => {
    await savePlan(plan('a'));
    const controller = new AbortController();
    putMock.mockImplementation(async () => {
      controller.abort();
      throw new Error('aborted');
    });

    await expect(syncSavedPlans(token, controller.signal)).rejects.toThrow('aborted');

    expect(await ids()).toEqual(['a']);
  });
});

describe('running one at a time', () => {
  it('a plan deleted while a sync is running stays deleted', async () => {
    await savePlan(plan('a'), { savedAt: '2026-11-01T09:00:00.000Z', synced: true });
    let answer!: (value: { plans: ReturnType<typeof remote>[] }) => void;
    listMock.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));

    const sync = syncSavedPlans(token);
    const remove = removePlanFor('a', token); // tapped while the account was still answering
    answer({ plans: [remote('a', '2026-11-01T09:00:00.000Z')] });
    await Promise.all([sync, remove]);

    expect(await ids()).toEqual([]);
    expect(deleteMock).toHaveBeenCalledWith(token, 'a');
  });

  it('a sync cancelled by signing out does not write the account plans onto the device', async () => {
    const controller = new AbortController();
    let answer!: (value: { plans: ReturnType<typeof remote>[] }) => void;
    listMock.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));

    const sync = syncSavedPlans(token, controller.signal);
    controller.abort(); // signed out meanwhile
    answer({ plans: [remote('theirs', '2026-11-01T09:00:00.000Z')] });

    await expect(sync).rejects.toThrow();
    expect(await ids()).toEqual([]);
  });
});
