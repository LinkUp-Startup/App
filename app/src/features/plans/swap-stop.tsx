import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';

import { swapOptions } from '@/api/plans';
import { describeApiError } from '@/api/errors';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { activityName, formatEuros, formatTimeRange } from '@/features/plans/format';
import { useTheme } from '@/hooks/use-theme';
import type { GeoPoint, Plan } from '@/types/api';

/** What the results screen still knows about the night; a saved plan doesn't keep it. */
export type SwapContext = {
  budgetPerPerson?: number;
  groupSize?: number;
  startLocation?: GeoPoint;
};

type Props = {
  plan: Plan;
  /** The stop to replace; null keeps the sheet closed. */
  stopIndex: number | null;
  context?: SwapContext;
  onChoose: (plan: Plan) => void;
  onClose: () => void;
};

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; options: Plan[] };

/**
 * Swap a stop (#229): other places for one stop, each shown with what it does to the whole plan.
 * Give it a `key` per stop, so opening it for another stop starts from "loading" again.
 */
export function SwapStopSheet({ plan, stopIndex, context, onChoose, onClose }: Props) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (stopIndex === null) return;
    const controller = new AbortController();
    const {
      id,
      title,
      summary,
      items,
      estimatedCostPerPerson,
      estimatedTotalCost,
      totalDistanceKm,
    } = plan;
    swapOptions(
      {
        plan: {
          id,
          title,
          summary,
          items,
          estimatedCostPerPerson,
          estimatedTotalCost,
          totalDistanceKm,
        },
        stopIndex,
        ...context,
      },
      controller.signal,
    )
      .then(({ options }) => setState({ status: 'ready', options }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn('Could not load swap options', error);
        setState({ status: 'error', message: describeApiError(error) });
      });
    return () => controller.abort();
  }, [plan, stopIndex, context, attempt]);

  const stop = stopIndex === null ? undefined : plan.items[stopIndex];

  return (
    <Modal
      visible={stopIndex !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <Screen>
        {stop && stopIndex !== null && (
          <>
            <ThemedText type="subtitle" accessibilityRole="header">
              Swap {stop.venue.name}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Other {activityName(stop.venue.category).toLowerCase()} places open from{' '}
              {formatTimeRange(stop.startTime, stop.endTime)}, close to the rest of your plan.
            </ThemedText>
            <Options
              state={state}
              stopIndex={stopIndex}
              plan={plan}
              onChoose={onChoose}
              onRetry={() => {
                setState({ status: 'loading' });
                setAttempt((value) => value + 1);
              }}
            />
          </>
        )}
        <Button title="Keep this stop" variant="secondary" onPress={onClose} />
      </Screen>
    </Modal>
  );
}

function Options({
  state,
  stopIndex,
  plan,
  onChoose,
  onRetry,
}: {
  state: State;
  stopIndex: number;
  plan: Plan;
  onChoose: (plan: Plan) => void;
  onRetry: () => void;
}) {
  const theme = useTheme();
  if (state.status === 'loading')
    return (
      <View style={styles.center} accessibilityLiveRegion="polite">
        <ActivityIndicator color={theme.tint} />
        <ThemedText type="small" themeColor="textSecondary">
          Looking for other places…
        </ThemedText>
      </View>
    );
  if (state.status === 'error')
    return (
      <View style={styles.list} accessibilityLiveRegion="polite">
        <ThemedText themeColor="danger">{state.message}</ThemedText>
        <Button title="Try again" onPress={onRetry} />
      </View>
    );
  if (state.options.length === 0)
    return (
      <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite">
        No other place fits this stop: none is open at that time, within the budget and close
        enough.
      </ThemedText>
    );

  return (
    <View style={styles.list}>
      {state.options.map((option) => {
        const item = option.items[stopIndex];
        return (
          <Pressable
            key={item.venue.id}
            accessibilityRole="button"
            accessibilityLabel={`Swap to ${item.venue.name}`}
            onPress={() => onChoose(option)}
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
            ]}>
            <ThemedText type="smallBold">{item.venue.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatTimeRange(item.startTime, item.endTime)} · {item.venue.address}
            </ThemedText>
            <ThemedText type="small">
              {item.estimatedCostPerPerson == null
                ? 'Price unknown'
                : `Estimated ${formatEuros(item.estimatedCostPerPerson)} per person`}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {planChange(plan, option)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "Plan: €2.50 less per person, 0.3 km more in total": what choosing this option changes. */
export function planChange(before: Plan, after: Plan): string {
  const parts: string[] = [];
  if (before.estimatedCostPerPerson != null && after.estimatedCostPerPerson != null) {
    const cost = after.estimatedCostPerPerson - before.estimatedCostPerPerson;
    parts.push(
      Math.abs(cost) < 0.005
        ? 'same price'
        : `${formatEuros(Math.abs(cost))} ${cost < 0 ? 'less' : 'more'} per person`,
    );
  }
  const km = after.totalDistanceKm - before.totalDistanceKm;
  parts.push(
    Math.abs(km) < 0.05
      ? 'same distance'
      : `${Math.abs(km).toFixed(1)} km ${km < 0 ? 'less' : 'more'} in total`,
  );
  return `Plan: ${parts.join(', ')}`;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
  list: { gap: Spacing.two },
  option: { borderRadius: 12, gap: Spacing.half, padding: Spacing.three },
});
