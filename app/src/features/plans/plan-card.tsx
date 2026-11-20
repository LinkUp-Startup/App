import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import {
  activityName,
  formatDistance,
  formatEuros,
  formatTimeRange,
  planDuration,
} from '@/features/plans/format';
import { useTheme } from '@/hooks/use-theme';
import type { Plan, PlanItem } from '@/types/api';

type PlanCardProps = {
  plan: Plan;
  /** Actions under the stops, e.g. a save button. */
  footer?: ReactNode;
  /** Shows a "Swap" button on every stop (#229). */
  onSwapStop?: (index: number) => void;
};

/** A plan with its stops in order: times, venue, price and the distance from the previous stop. */
export function PlanCard({ plan, footer, onSwapStop }: PlanCardProps) {
  const theme = useTheme();

  return (
    <Card style={styles.card}>
      {/* A thin gradient across the top of the card, purple to cyan and back. */}
      <LinearGradient
        colors={[theme.tintBright, theme.accent, theme.tint]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.accent}
      />
      <View style={styles.header}>
        <ThemedText type="subtitle" accessibilityRole="header">
          {plan.title}
        </ThemedText>
        {plan.summary ? (
          <ThemedText type="small" themeColor="textSecondary">
            {plan.summary}
          </ThemedText>
        ) : null}
      </View>

      <SummaryStrip plan={plan} />

      <Totals plan={plan} />

      <View>
        {plan.items.map((item, index) => (
          <Stop
            key={`${item.venue.id}-${item.startTime}`}
            item={item}
            number={index + 1}
            last={index === plan.items.length - 1}
            onSwap={onSwapStop && (() => onSwapStop(index))}
          />
        ))}
      </View>

      {footer}
    </Card>
  );
}

/** How long the night is, how many stops, how far in total: one strip with a dot between each. */
export function SummaryStrip({ plan }: { plan: Plan }) {
  const theme = useTheme();
  const duration = planDuration(plan);
  const stops = `${plan.items.length} ${plan.items.length === 1 ? 'stop' : 'stops'}`;
  const dot = (
    <ThemedText type="label" themeColor="textSecondary">
      •
    </ThemedText>
  );

  return (
    <View style={[styles.strip, { backgroundColor: theme.inputFill }]}>
      {duration && (
        <>
          <View style={styles.stat}>
            <Icon name="time-outline" size={16} color="accent" />
            <ThemedText type="label">{duration}</ThemedText>
          </View>
          {dot}
        </>
      )}
      <View style={styles.stat}>
        <Icon name="location-outline" size={16} color="tint" />
        <ThemedText type="label">{stops}</ThemedText>
      </View>
      {dot}
      <View style={styles.stat}>
        <Icon name="walk" size={16} color="highlight" />
        <ThemedText type="label">{`${formatDistance(plan.totalDistanceKm)} total`}</ThemedText>
      </View>
    </View>
  );
}

/** The group total in purple and the price per person in cyan, side by side in a dark inset box. */
function Totals({ plan }: { plan: Plan }) {
  const theme = useTheme();

  return (
    <View style={[styles.totals, { backgroundColor: theme.background }]}>
      {/* Each is one text, so a screen reader reads it as a sentence; the amount is emphasised inside it. */}
      <ThemedText type="micro" themeColor="textSecondary" style={styles.total}>
        {'Estimated total for the group:\n'}
        <ThemedText type="heading" style={{ color: theme.tint }}>
          {plan.estimatedTotalCost == null
            ? 'price unavailable'
            : formatEuros(plan.estimatedTotalCost)}
        </ThemedText>
      </ThemedText>
      <ThemedText type="micro" themeColor="textSecondary" style={styles.perPerson}>
        {'Estimated per person:\n'}
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          {plan.estimatedCostPerPerson == null
            ? 'price unknown'
            : formatEuros(plan.estimatedCostPerPerson)}
        </ThemedText>
      </ThemedText>
    </View>
  );
}

type StopProps = {
  item: PlanItem;
  number: number;
  last: boolean;
  /** Swaps this stop for another venue (#229). */
  onSwap?: () => void;
};

function Stop({ item, number, last, onSwap }: StopProps) {
  const theme = useTheme();
  const time = formatTimeRange(item.startTime, item.endTime);
  const price =
    item.estimatedCostPerPerson == null
      ? 'Price unknown'
      : `Estimated ${formatEuros(item.estimatedCostPerPerson)} per person`;
  const leg = legLabel(item, number);

  return (
    <View style={styles.stop}>
      {/* The details are one group for a screen reader; the Swap button is its own control beside them. */}
      <View
        style={styles.stopDetails}
        accessible
        accessibilityLabel={`Stop ${number}: ${item.venue.name}, ${activityName(item.venue.category)}, ${time}, ${price}`}>
        <View style={styles.spine} importantForAccessibility="no-hide-descendants">
          <View
            style={[styles.number, { backgroundColor: theme.inputFill, borderColor: theme.tint }]}>
            <ThemedText type="label" style={{ color: theme.tint }}>
              {number}
            </ThemedText>
          </View>
          {/* Route spine down to the next stop. */}
          {!last && <View style={[styles.line, { backgroundColor: theme.border }]} />}
        </View>
        <View style={[styles.stopText, !last && styles.stopGap]}>
          <View style={styles.stopTitle}>
            <ThemedText type="smallBold" style={styles.venue}>
              {item.venue.name}
            </ThemedText>
            {/* The time range in the cyan of a live waypoint. */}
            <ThemedText type="label" style={{ color: theme.accent }}>
              {time.replace('-', ' – ')}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {activityName(item.venue.category)} · {item.venue.address}
          </ThemedText>
          <ThemedText type="small">{price}</ThemedText>
          {leg !== '' && (
            <View style={[styles.leg, { backgroundColor: theme.inputFill }]}>
              <Icon name="walk" size={14} color="textSecondary" />
              <ThemedText type="caption" themeColor="textSecondary">
                {leg}
              </ThemedText>
            </View>
          )}
        </View>
      </View>
      {onSwap && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Swap ${item.venue.name}`}
          hitSlop={8}
          onPress={onSwap}
          style={({ pressed }) => [
            styles.swap,
            { backgroundColor: theme.inputFill, opacity: pressed ? 0.7 : 1 },
          ]}>
          <Icon name="swap-horizontal" size={14} color="tint" />
          <ThemedText type="label" themeColor="tint">
            Swap
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

/** The way to this stop: from the previous stop, or from the start point for the first one (#56). */
function legLabel(item: PlanItem, number: number) {
  if (number > 1) return `${formatDistance(item.distanceKm)} from the previous stop`;
  // Without a start point the API sends 0 for the first stop: there is no walk to show.
  return item.distanceKm > 0 ? `${formatDistance(item.distanceKm)} from your start` : '';
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    overflow: 'hidden',
  },
  accent: {
    height: 4,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  header: {
    gap: Spacing.one,
    // Clear of the accent line.
    marginTop: Spacing.one,
  },
  strip: {
    alignItems: 'center',
    borderRadius: Radius.default,
    columnGap: Spacing.three,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    rowGap: Spacing.one,
  },
  stat: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
  },
  totals: {
    alignItems: 'center',
    borderRadius: Radius.default,
    flexDirection: 'row',
    gap: Spacing.three,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },
  total: {
    flexShrink: 1,
  },
  perPerson: {
    flexShrink: 1,
    textAlign: 'right',
  },
  stop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stopDetails: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.three,
  },
  swap: {
    alignItems: 'center',
    borderRadius: Radius.full,
    flexDirection: 'row',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  spine: {
    alignItems: 'center',
    width: 28,
  },
  number: {
    alignItems: 'center',
    borderRadius: Radius.full,
    borderWidth: 2,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  line: {
    flex: 1,
    marginVertical: Spacing.one,
    width: 2,
  },
  stopText: {
    flex: 1,
    gap: Spacing.half,
  },
  stopGap: {
    paddingBottom: Spacing.three,
  },
  stopTitle: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  venue: {
    flexShrink: 1,
  },
  leg: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    flexDirection: 'row',
    gap: Spacing.one,
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
});
