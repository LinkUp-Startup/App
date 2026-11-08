import { Platform, Share } from 'react-native';

import { ApiError, NetworkError } from '@/api/client';
import { putSavedPlan, sharePlan, unsharePlan } from '@/api/saved-plans';
import { getShareLink, openShareSheet, shareText, stopSharing } from '@/features/plans/share-plan';
import { getSavedPlan, getSavedPlans, savePlan, type SavedPlan } from '@/storage/saved-plans';

import { tapasPlan } from './fixtures/plans';

jest.mock('@/api/saved-plans');

const url = 'https://linkup.th7bo.dev/plan/tok';
const saved: SavedPlan = { ...tapasPlan, savedAt: '2026-11-01T10:00:00.000Z', synced: true };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(sharePlan).mockResolvedValue({ url });
});

describe('getShareLink', () => {
  it('gets the link and remembers it on the device', async () => {
    await savePlan(saved, { savedAt: saved.savedAt, synced: true });

    await expect(getShareLink(saved, 'token-1')).resolves.toBe(url);

    expect(sharePlan).toHaveBeenCalledWith('token-1', tapasPlan.id);
    expect(putSavedPlan).not.toHaveBeenCalled();
    expect((await getSavedPlan(tapasPlan.id))?.shareUrl).toBe(url);
  });

  it('uploads a plan that never reached the account, then shares it', async () => {
    const deviceOnly: SavedPlan = { ...tapasPlan, savedAt: '2026-11-01T09:00:00.000Z' };
    await savePlan(deviceOnly, { savedAt: deviceOnly.savedAt });
    jest
      .mocked(sharePlan)
      .mockRejectedValueOnce(new ApiError(404, 'not saved'))
      .mockResolvedValueOnce({ url });
    jest.mocked(putSavedPlan).mockResolvedValue({
      plan: tapasPlan,
      savedAt: '2026-11-01T10:00:00.000Z',
      shareUrl: null,
    });

    await expect(getShareLink(deviceOnly, 'token-1')).resolves.toBe(url);

    expect(putSavedPlan).toHaveBeenCalledWith('token-1', deviceOnly);
    const [stored] = await getSavedPlans();
    expect(stored).toMatchObject({
      synced: true,
      shareUrl: url,
      savedAt: '2026-11-01T10:00:00.000Z',
    });
  });

  it('fails without uploading when the account cannot be reached', async () => {
    jest.mocked(sharePlan).mockRejectedValue(new NetworkError('offline'));

    await expect(getShareLink(saved, 'token-1')).rejects.toThrow('offline');
    expect(putSavedPlan).not.toHaveBeenCalled();
  });
});

describe('stopSharing', () => {
  it('revokes the link and forgets it on the device', async () => {
    await savePlan(saved, { shareUrl: url });
    jest.mocked(unsharePlan).mockResolvedValue(undefined);

    await stopSharing(tapasPlan.id, 'token-1');

    expect(unsharePlan).toHaveBeenCalledWith('token-1', tapasPlan.id);
    expect(await getSavedPlan(tapasPlan.id)).not.toHaveProperty('shareUrl');
  });

  it('keeps the link on the device when revoking fails', async () => {
    await savePlan(saved, { shareUrl: url });
    jest.mocked(unsharePlan).mockRejectedValue(new NetworkError('offline'));

    await expect(stopSharing(tapasPlan.id, 'token-1')).rejects.toThrow('offline');
    expect((await getSavedPlan(tapasPlan.id))?.shareUrl).toBe(url);
  });
});

describe('share sheet', () => {
  const originalOs = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOs;
  });

  it('names the plan and its night', () => {
    expect(shareText(saved)).toMatch(new RegExp(`^${tapasPlan.title}, \\w{3} \\d{1,2} \\w{3}$`));
    expect(shareText({ ...saved, items: [] })).toBe(tapasPlan.title);
  });

  it('puts the link in the message on Android', async () => {
    Platform.OS = 'android';
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });

    await openShareSheet(saved, url);

    expect(share).toHaveBeenCalledWith({
      message: `${shareText(saved)}\n${url}`,
      title: tapasPlan.title,
    });
  });

  it('passes the link separately on iOS', async () => {
    Platform.OS = 'ios';
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });

    await openShareSheet(saved, url);

    expect(share).toHaveBeenCalledWith({ message: shareText(saved), url });
  });
});
