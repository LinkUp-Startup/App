import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  activityName,
  formatDistance,
  formatEuros,
  formatTimeRange,
  planSummaryLine,
} from '@/features/plans/format';
import { useTheme } from '@/hooks/use-theme';
import type { Plan, PlanItem } from '@/types/api';

type PlanCardProps = {
  plan: Plan;
  /** Actions under the stops, e.g. a save button. */
  footer?: ReactNode;
};

/** A plan with its stops in order: times, venue, price and the distance from the previous stop. */
export function PlanCard({ plan, footer }: PlanCardProps) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={styles.title} accessibilityRole="header">
          {plan.title}
        </ThemedText>
        {plan.summary ? (
          <ThemedText type="small" themeColor="textSecondary">
            {plan.summary}
          </ThemedText>
        ) : null}
        <ThemedText type="small">{planSummaryLine(plan)}</ThemedText>
        <ThemedText type="smallBold">
          {plan.estimatedTotalCost == null
            ? 'Estimated total for the group: price unavailable'
            : `Estimated total for the group: ${formatEuros(plan.estimatedTotalCost)}`}
        </ThemedText>
      </View>

      {plan.items.map((item, index) => (
        <Stop key={`${item.venue.id}-${item.startTime}`} item={item} number={index + 1} />
      ))}

      {footer}
    </ThemedView>
  );
}

function Stop({ item, number }: { item: PlanItem; number: number }) {
  const theme = useTheme();
  const time = formatTimeRange(item.startTime, item.endTime);
  const price =
    item.estimatedCostPerPerson == null
      ? 'Price unknown'
      : `Estimated ${formatEuros(item.estimatedCostPerPerson)} per person`;

  return (
    <View
      style={styles.stop}
      accessible
      accessibilityLabel={`Stop ${number}: ${item.venue.name}, ${activityName(item.venue.category)}, ${time}, ${price}`}>
      <View style={[styles.number, { backgroundColor: theme.tint }]}>
        <ThemedText type="smallBold" style={styles.numberLabel}>
          {number}
        </ThemedText>
      </View>
      <View style={styles.stopText}>
        <ThemedText type="smallBold">{item.venue.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {activityName(item.venue.category)} · {time}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {item.venue.address}
        </ThemedText>
        <ThemedText type="small">
          {price}
          {number > 1 ? ` · ${formatDistance(item.distanceKm)} from the previous stop` : ''}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    gap: Spacing.three,
    padding: Spacing.three,
  },
  header: {
    gap: Spacing.one,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
  },
  stop: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  number: {
    alignItems: 'center',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    marginTop: Spacing.half,
    width: 24,
  },
  numberLabel: {
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 16,
  },
  stopText: {
    flex: 1,
    gap: Spacing.half,
  },
});
