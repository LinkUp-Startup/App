import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatNightDate, planSummaryLine } from '@/features/plans/format';
import { useTheme } from '@/hooks/use-theme';
import { getSavedPlans, type SavedPlan } from '@/storage/saved-plans';

/** Plans saved on this device. Read from local storage only, so it works offline (#74). */
export default function SavedPlansScreen() {
  const [plans, setPlans] = useState<SavedPlan[]>();

  // Reload whenever the tab is shown, so plans saved or deleted elsewhere appear.
  useFocusEffect(
    useCallback(() => {
      getSavedPlans()
        .then(setPlans)
        .catch((error: unknown) => {
          console.warn('Could not load saved plans', error);
          setPlans([]);
        });
    }, []),
  );

  return (
    <Screen>
      <ThemedText type="subtitle">Saved plans</ThemedText>
      {plans?.length === 0 && (
        <>
          <ThemedText themeColor="textSecondary">
            No saved plans yet. Save a plan from your results to find it here, even offline.
          </ThemedText>
          <Button title="Plan a night" onPress={() => router.navigate('/')} />
        </>
      )}
      {plans?.map((plan) => (
        <SavedPlanRow key={plan.id} plan={plan} />
      ))}
    </Screen>
  );
}

function SavedPlanRow({ plan }: { plan: SavedPlan }) {
  const theme = useTheme();
  const night = plan.items[0] ? formatNightDate(plan.items[0].startTime) : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${plan.title}`}
      onPress={() => router.push({ pathname: '/saved-plan/[id]', params: { id: plan.id } })}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
      ]}>
      <ThemedText type="smallBold">{plan.title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {night ? `${night} · ` : ''}
        {planSummaryLine(plan)}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: 12,
    gap: Spacing.one,
    padding: Spacing.three,
  },
});
