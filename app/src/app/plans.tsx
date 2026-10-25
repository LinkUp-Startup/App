import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { PlanCard } from '@/features/plans/plan-card';
import { savePlanFor } from '@/features/plans/saved-plans-sync';
import { useGeneratePlans } from '@/features/plans/use-generate-plans';
import { useTheme } from '@/hooks/use-theme';
import { getSavedPlans } from '@/storage/saved-plans';
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
        <SaveablePlans plans={state.plans} />
      );
  }
}

/**
 * The plans, each with a button to keep it: on this device for a guest (#73), and in the account too when
 * signed in (#88).
 */
function SaveablePlans({ plans }: { plans: Plan[] }) {
  const { accessToken } = useAuth();
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set());
  // Saved while signed in, but the account couldn't be reached: only on this device until the next sync.
  const [deviceOnly, setDeviceOnly] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState<string>();

  useEffect(() => {
    getSavedPlans()
      .then((stored) => setSaved(new Set(stored.map((plan) => plan.id))))
      .catch((error: unknown) => console.warn('Could not load saved plans', error));
  }, []);

  async function save(plan: Plan) {
    try {
      const outcome = await savePlanFor(plan, accessToken);
      setSaved((ids) => new Set(ids).add(plan.id));
      if (accessToken && outcome === 'device') setDeviceOnly((ids) => new Set(ids).add(plan.id));
      setFailed(undefined);
    } catch (error) {
      console.warn('Could not save plan', error);
      setFailed(plan.id);
    }
  }

  return plans.map((plan) => {
    const isSaved = saved.has(plan.id);
    return (
      <PlanCard
        key={plan.id}
        plan={plan}
        footer={
          <>
            <Button
              title={isSaved ? 'Saved' : 'Save plan'}
              accessibilityLabel={isSaved ? `${plan.title} saved` : `Save ${plan.title}`}
              accessibilityState={{ disabled: isSaved }}
              variant={isSaved ? 'secondary' : 'primary'}
              disabled={isSaved}
              onPress={() => save(plan)}
            />
            {deviceOnly.has(plan.id) && (
              <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
                Saved on this device. It will be added to your account when we can reach it.
              </ThemedText>
            )}
            {failed === plan.id && (
              <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
                Couldn&apos;t save this plan. Try again.
              </ThemedText>
            )}
          </>
        }
      />
    );
  });
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
});
