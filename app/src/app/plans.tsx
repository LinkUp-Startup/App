import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useGeneratePlans } from '@/features/plans/use-generate-plans';
import { useTheme } from '@/hooks/use-theme';
import type { NightPreferences, Plan } from '@/types/api';

export default function PlanResultsScreen() {
  const params = useLocalSearchParams<{ preferences?: string }>();
  const preferences = useMemo(() => parsePreferences(params.preferences), [params.preferences]);

  return (
    <Screen edges={['bottom']}>
      {preferences ? (
        <Results preferences={preferences} />
      ) : (
        <ThemedText themeColor="textSecondary">
          Fill in your preferences first to get plans.
        </ThemedText>
      )}

      <Button title="Change preferences" variant="secondary" onPress={() => router.back()} />
      <Button
        title="View saved plans"
        variant="secondary"
        onPress={() => router.navigate('/saved')}
      />
    </Screen>
  );
}

function Results({ preferences }: { preferences: NightPreferences }) {
  const theme = useTheme();
  const { state, retry } = useGeneratePlans(preferences);

  switch (state.status) {
    case 'loading':
      return (
        <View style={styles.loading} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={theme.tint} />
          <ThemedText type="smallBold">Putting your night together…</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            This can take a few seconds.
          </ThemedText>
        </View>
      );
    case 'error':
      return (
        <View style={styles.error} accessibilityLiveRegion="polite">
          <ThemedText type="smallBold" themeColor="danger">
            Couldn&apos;t generate plans
          </ThemedText>
          <ThemedText>{state.message}</ThemedText>
          <Button title="Try again" onPress={retry} />
        </View>
      );
    case 'success':
      return state.plans.length === 0 ? (
        <ThemedText themeColor="textSecondary">
          No plans match these preferences. Try a higher budget, a larger distance or more
          activities.
        </ThemedText>
      ) : (
        <>
          {state.plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </>
      );
  }
}

// TODO(#72): full results design — stops, times, map.
function PlanCard({ plan }: { plan: Plan }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{plan.title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {plan.summary}
      </ThemedText>
      <ThemedText type="small">
        {plan.items.length} {plan.items.length === 1 ? 'stop' : 'stops'} · ~€
        {plan.estimatedCostPerPerson.toFixed(0)} per person · {plan.totalDistanceKm.toFixed(1)} km
      </ThemedText>
    </ThemedView>
  );
}

function parsePreferences(value: string | undefined): NightPreferences | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as NightPreferences;
  } catch {
    return undefined;
  }
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  error: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: 12,
    gap: Spacing.one,
    padding: Spacing.three,
  },
});
