import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { formatTime } from '@/components/form/format-time';
import { Spacing } from '@/constants/theme';
import { activityName, directionsUrl, formatDistance } from '@/features/plans/format';
import {
  formatCountdown,
  nightMoment,
  type NightMoment,
  type Stop,
} from '@/features/tonight/night';
import { ReminderSwitch } from '@/features/tonight/reminder-switch';
import { useNow } from '@/features/tonight/use-now';
import { getSavedPlan, type SavedPlan } from '@/storage/saved-plans';

/**
 * Tonight mode (#228): on the night itself, where you should be now, what's next and how long until then.
 * Reads the plan saved on the phone, so it keeps working without a connection.
 */
export default function TonightScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // undefined while loading, null when the plan isn't saved (anymore).
  const [plan, setPlan] = useState<SavedPlan | null>();
  const now = useNow();

  useEffect(() => {
    getSavedPlan(id)
      .then((found) => setPlan(found ?? null))
      .catch((error: unknown) => {
        console.warn('Could not load saved plan', error);
        setPlan(null);
      });
  }, [id]);

  if (plan === undefined) return <Screen edges={['bottom']}>{null}</Screen>;
  if (plan === null)
    return (
      <Screen edges={['bottom']}>
        <ThemedText themeColor="textSecondary">This plan is no longer saved.</ThemedText>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );

  const moment = nightMoment(plan, now);
  return (
    <Screen edges={['bottom']}>
      <ThemedText type="subtitle">{plan.title}</ThemedText>
      <MomentCard moment={moment} />
      <ReminderSwitch plan={plan} now={now} />
      {moment.phase !== 'over' && <StopList stops={plan.items} moment={moment} />}
    </Screen>
  );
}

function MomentCard({ moment }: { moment: NightMoment }) {
  if (moment.phase === 'over')
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="title">That&apos;s the night.</ThemedText>
        <ThemedText themeColor="textSecondary">
          Every stop of this plan is done. Get home safe.
        </ThemedText>
      </ThemedView>
    );

  if (moment.phase === 'at')
    return (
      <>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            You&apos;re at
          </ThemedText>
          <StopTitle stop={moment.current} />
          <ThemedText accessibilityLiveRegion="polite">
            Until {formatTime(new Date(moment.current.item.endTime))},{' '}
            {formatCountdown(moment.endsInMs)} left
          </ThemedText>
          {!moment.next && <Directions stop={moment.current} />}
        </ThemedView>
        {moment.next && (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="small" themeColor="textSecondary">
              Next
            </ThemedText>
            <StopTitle stop={moment.next} />
            <ThemedText>
              At {formatTime(new Date(moment.next.item.startTime))}
              {moment.next.item.distanceKm > 0
                ? `, ${formatDistance(moment.next.item.distanceKm)} from here`
                : ''}
            </ThemedText>
            <Directions stop={moment.next} />
          </ThemedView>
        )}
      </>
    );

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="small" themeColor="textSecondary">
        {moment.phase === 'before' ? 'First stop' : 'On the way to'}
      </ThemedText>
      <StopTitle stop={moment.next} />
      <ThemedText type="title" accessibilityLiveRegion="polite">
        In {formatCountdown(moment.startsInMs)}
      </ThemedText>
      <ThemedText themeColor="textSecondary">
        Starts at {formatTime(new Date(moment.next.item.startTime))}
      </ThemedText>
      <Directions stop={moment.next} />
    </ThemedView>
  );
}

function StopTitle({ stop }: { stop: Stop }) {
  const { venue } = stop.item;
  return (
    <View style={styles.stopTitle}>
      <ThemedText type="subtitle" accessibilityRole="header">
        {venue.name}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {activityName(venue.category)} · {venue.address}
      </ThemedText>
    </View>
  );
}

function Directions({ stop }: { stop: Stop }) {
  const { venue } = stop.item;
  return (
    <Button
      title={`Directions to ${venue.name}`}
      onPress={() => void Linking.openURL(directionsUrl(venue.latitude, venue.longitude))}
    />
  );
}

/** Every stop of the night, marked done, now or next. */
function StopList({ stops, moment }: { stops: SavedPlan['items']; moment: NightMoment }) {
  const currentIndex = moment.phase === 'at' ? moment.current.index : -1;
  const nextIndex =
    moment.phase === 'at' ? (moment.next?.index ?? -1) : 'next' in moment ? moment.next.index : -1;
  const firstNotDone = currentIndex >= 0 ? currentIndex : nextIndex;

  return (
    <View style={styles.list} accessibilityLabel="All stops tonight">
      {stops.map((item, index) => {
        const label =
          index === currentIndex
            ? 'Now'
            : index === nextIndex
              ? 'Next'
              : index < firstNotDone
                ? 'Done'
                : 'Later';
        return (
          <View key={`${item.venue.id}-${item.startTime}`} style={styles.listRow}>
            <ThemedText type="smallBold" style={styles.listTime}>
              {formatTime(new Date(item.startTime))}
            </ThemedText>
            <ThemedText
              type="small"
              style={styles.listName}
              themeColor={label === 'Done' ? 'textSecondary' : undefined}>
              {item.venue.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {label}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, gap: Spacing.two, padding: Spacing.four },
  stopTitle: { gap: Spacing.one },
  list: { gap: Spacing.two },
  listRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.three },
  listTime: { width: 48 },
  listName: { flex: 1 },
});
