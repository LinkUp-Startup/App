import { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { nightMoment } from '@/features/tonight/night';
import {
  LEAD_MINUTES,
  remindersOn,
  turnOffReminders,
  turnOnReminders,
} from '@/features/tonight/reminders';
import type { Plan } from '@/types/api';

/** "Remind me before each stop", for a plan that isn't over yet. */
export function ReminderSwitch({ plan, now }: { plan: Plan; now: Date }) {
  const [on, setOn] = useState<boolean>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    remindersOn(plan.id)
      .then(setOn)
      .catch((error: unknown) => {
        console.warn('Could not read reminders', error);
        setOn(false);
      });
  }, [plan.id]);

  if (nightMoment(plan, now).phase === 'over' || on === undefined) return null;

  function change(value: boolean) {
    setMessage(null);
    setBusy(true);
    const done = value
      ? turnOnReminders(plan).then((result) => {
          if (result === 'on') {
            setOn(true);
            setMessage(
              `You'll get a reminder ${LEAD_MINUTES} minutes before you need to leave for each stop.`,
            );
          } else if (result === 'nothing-left') {
            setMessage('Every stop of this plan has already started.');
          } else {
            Alert.alert(
              'Notifications are off',
              'To get reminders, allow LinkUp to send notifications in Settings.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => void Linking.openSettings() },
              ],
            );
          }
        })
      : turnOffReminders(plan.id).then(() => setOn(false));
    done
      .catch((error: unknown) => {
        console.warn('Could not change reminders', error);
        setMessage("Couldn't change the reminders. Try again.");
      })
      .finally(() => setBusy(false));
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <ThemedText style={styles.label}>Remind me before each stop</ThemedText>
        <Switch
          accessibilityLabel="Remind me before each stop"
          value={on}
          disabled={busy}
          onValueChange={change}
        />
      </View>
      {message && (
        <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
          {message}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  label: { flex: 1 },
});
