import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { PlanCard } from '@/features/plans/plan-card';
import { savePlanFor } from '@/features/plans/saved-plans-sync';
import { SwapStopSheet, type SwapContext } from '@/features/plans/swap-stop';
import { useGeneratePlans } from '@/features/plans/use-generate-plans';
import { useTheme } from '@/hooks/use-theme';
import { getSavedPlans } from '@/storage/saved-plans';
import type { NightPreferences, Plan } from '@/types/api';

export default function PlanResultsScreen() {
  const params = useLocalSearchParams<{ preferences?: string }>();
  const preferences = useMemo(() => parsePreferences(params.preferences), [params.preferences]);

  return (
    <Screen edges={['bottom']} gap={Spacing.four}>
      {preferences ? (
        <Results preferences={preferences} />
      ) : (
        <ThemedText themeColor="textSecondary">
          Fill in your preferences first to get plans.
        </ThemedText>
      )}

      <Button
        title="Change preferences"
        icon="options-outline"
        variant="secondary"
        onPress={() => router.back()}
      />
      <Button
        title="View saved plans"
        icon="bookmark-outline"
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
        <SaveablePlans plans={state.plans} preferences={preferences} />
      );
  }
}

/**
 * The plans, each with a button to keep it: on this device for a guest (#73), and in the account too when
 * signed in (#88).
 */
function SaveablePlans({ plans, preferences }: { plans: Plan[]; preferences: NightPreferences }) {
  const { accessToken } = useAuth();
  // Plans with a stop swapped (#229), by id; they replace the generated ones.
  const [swapped, setSwapped] = useState<Readonly<Record<string, Plan>>>({});
  const [swapping, setSwapping] = useState<{ plan: Plan; index: number } | null>(null);
  const swapContext = useMemo<SwapContext>(
    () => ({
      budgetPerPerson: preferences.budgetPerPerson,
      groupSize: preferences.groupSize,
      startLocation: preferences.startLocation ?? undefined,
    }),
    [preferences],
  );

  function choose(option: Plan) {
    setSwapped((current) => ({ ...current, [option.id]: option }));
    // A copy saved before the swap is the old version: offer to save the new one.
    setSaved((ids) => {
      const next = new Set(ids);
      next.delete(option.id);
      return next;
    });
    setSwapping(null);
  }
  const theme = useTheme();
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

  const cards = plans.map((generated) => {
    const plan = swapped[generated.id] ?? generated;
    const isSaved = saved.has(plan.id);
    return (
      <PlanCard
        key={plan.id}
        plan={plan}
        onSwapStop={(index) => setSwapping({ plan, index })}
        footer={
          <>
            <Button
              title={isSaved ? 'Saved' : 'Save plan'}
              icon={isSaved ? 'heart' : 'heart-outline'}
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

  return (
    <>
      <View style={styles.resultsHeader}>
        <View style={styles.headingRow}>
          <View style={[styles.headingIcon, { backgroundColor: theme.inputFill }]}>
            <Icon name="options-outline" size={16} color="tint" />
          </View>
          <ThemedText type="heading" accessibilityRole="header">
            Tonight&apos;s Curated Routes
          </ThemedText>
        </View>
        {/* One pill: how many plans, for how many people, and the budget they were made for. */}
        <View style={[styles.summaryPill, { backgroundColor: theme.inputFill }]}>
          <Icon name="people-outline" size={14} color="highlight" />
          <ThemedText type="label" themeColor="textSecondary">
            {`${plans.length} ${plans.length === 1 ? 'plan' : 'plans'} found for a group of ${preferences.groupSize}`}
          </ThemedText>
          <ThemedText type="label" themeColor="textSecondary">
            •
          </ThemedText>
          <ThemedText type="label" style={{ color: theme.highlight }}>
            {`Budget / person: €${preferences.budgetPerPerson}`}
          </ThemedText>
        </View>
      </View>
      {cards}
      {swapping && (
        <SwapStopSheet
          key={`${swapping.plan.id}-${swapping.index}`}
          plan={swapping.plan}
          stopIndex={swapping.index}
          context={swapContext}
          onChoose={choose}
          onClose={() => setSwapping(null)}
        />
      )}
    </>
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
  resultsHeader: {
    gap: Spacing.two,
  },
  headingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
  },
  headingIcon: {
    alignItems: 'center',
    borderRadius: Radius.full,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  summaryPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + Spacing.half,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
});
