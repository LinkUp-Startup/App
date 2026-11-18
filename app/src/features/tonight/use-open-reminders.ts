import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { reminderPlanId } from '@/features/tonight/reminders';

// Reminders also show while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Tapping a reminder opens Tonight mode for its plan, also when the tap started the app. */
export function useOpenReminders() {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const planId = reminderPlanId(response);
    if (!planId) return;
    // Handled once: without this, the same tap would open Tonight mode again after a restart.
    Notifications.clearLastNotificationResponse();
    router.push({ pathname: '/tonight/[id]', params: { id: planId } });
  }, [response]);
}
