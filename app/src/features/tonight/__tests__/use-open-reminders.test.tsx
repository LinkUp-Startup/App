import { renderHook } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

import { useOpenReminders } from '@/features/tonight/use-open-reminders';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const response = (data: object) =>
  ({ notification: { request: { content: { data } } } }) as Notifications.NotificationResponse;

afterEach(() => jest.clearAllMocks());

describe('useOpenReminders', () => {
  it('shows reminders while the app is open', () => {
    const handler = jest.mocked(Notifications.setNotificationHandler).mock.calls[0]?.[0];
    expect(handler).toBeDefined();
    return expect(handler!.handleNotification({} as never)).resolves.toMatchObject({
      shouldShowBanner: true,
      shouldShowList: true,
    });
  });

  it('opens Tonight mode for a tapped reminder, once', async () => {
    jest
      .mocked(Notifications.useLastNotificationResponse)
      .mockReturnValue(response({ planId: 'p1' }));

    await renderHook(() => useOpenReminders());

    expect(router.push).toHaveBeenCalledWith({ pathname: '/tonight/[id]', params: { id: 'p1' } });
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled();
  });

  it('ignores other notifications', async () => {
    jest.mocked(Notifications.useLastNotificationResponse).mockReturnValue(response({}));

    await renderHook(() => useOpenReminders());

    expect(router.push).not.toHaveBeenCalled();
  });
});
