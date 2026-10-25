import { renderHook, waitFor } from '@testing-library/react-native';

import { syncSavedPlans } from '@/features/plans/saved-plans-sync';
import { useSyncSavedPlans } from '@/features/plans/use-sync-saved-plans';

jest.mock('@/features/plans/saved-plans-sync');

const syncMock = jest.mocked(syncSavedPlans);

beforeEach(() => {
  jest.clearAllMocks();
  syncMock.mockResolvedValue([]);
});

describe('useSyncSavedPlans', () => {
  it('does nothing for a guest', async () => {
    await renderHook(() => useSyncSavedPlans(null));

    expect(syncMock).not.toHaveBeenCalled();
  });

  it('syncs when someone is signed in', async () => {
    await renderHook(() => useSyncSavedPlans('token-1'));

    expect(syncMock).toHaveBeenCalledWith('token-1', expect.any(AbortSignal));
  });

  it('syncs again for a different account and cancels the earlier sync', async () => {
    const { rerender } = await renderHook((token: string | null) => useSyncSavedPlans(token), {
      initialProps: 'token-1' as string | null,
    });
    const firstSignal = syncMock.mock.calls[0][1]!;

    await rerender('token-2');

    expect(firstSignal.aborted).toBe(true);
    expect(syncMock).toHaveBeenCalledTimes(2);
    expect(syncMock).toHaveBeenLastCalledWith('token-2', expect.any(AbortSignal));
  });

  it('cancels the sync when signing out', async () => {
    const { rerender } = await renderHook((token: string | null) => useSyncSavedPlans(token), {
      initialProps: 'token-1' as string | null,
    });
    const signal = syncMock.mock.calls[0][1]!;

    await rerender(null);

    expect(signal.aborted).toBe(true);
    expect(syncMock).toHaveBeenCalledTimes(1);
  });

  it('only warns when the sync fails, e.g. offline', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    syncMock.mockRejectedValue(new Error('offline'));

    await renderHook(() => useSyncSavedPlans('token-1'));

    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith('Could not sync saved plans', expect.any(Error)),
    );
  });

  it('stays quiet about a sync that was cancelled', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let fail: (error: Error) => void = () => {};
    syncMock.mockReturnValue(new Promise((_resolve, reject) => (fail = reject)));
    const { unmount } = await renderHook(() => useSyncSavedPlans('token-1'));

    await unmount();
    fail(new Error('aborted'));
    await Promise.resolve();

    expect(warn).not.toHaveBeenCalled();
  });
});
