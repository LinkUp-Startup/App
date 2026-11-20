import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { generateGroupPlans } from '@/api/groups';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { describeGroupError } from '@/features/groups/errors';
import { PlanCard } from '@/features/plans/plan-card';
import { PlanForm } from '@/features/preferences/plan-form';
import { useTheme } from '@/hooks/use-theme';
import type { GroupPlanRound, NightPreferences } from '@/types/api';

type Step =
  | { status: 'form' }
  | { status: 'generating'; preferences: NightPreferences }
  | { status: 'error'; preferences: NightPreferences; message: string }
  | { status: 'done'; round: GroupPlanRound };

/**
 * Plans a night for a group: the usual preferences form with the group size fixed to the member count. The
 * generated plans are saved to the group.
 */
export default function GroupPlanScreen() {
  const params = useLocalSearchParams<{ groupId?: string; groupSize?: string }>();
  const { accessToken, user } = useAuth();
  const theme = useTheme();
  const [step, setStep] = useState<Step>({ status: 'form' });
  const controller = useRef<AbortController | null>(null);
  const groupSize = Number(params.groupSize);

  // Leaving the screen cancels a generation in progress
  useEffect(() => () => controller.current?.abort(), []);

  const generate = useCallback(
    async (preferences: NightPreferences) => {
      if (!accessToken || !params.groupId) return;
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      setStep({ status: 'generating', preferences });
      try {
        const round = await generateGroupPlans(
          accessToken,
          params.groupId,
          preferences,
          current.signal,
        );
        setStep({ status: 'done', round });
      } catch (caught) {
        if (!current.signal.aborted) {
          setStep({ status: 'error', preferences, message: describeGroupError(caught) });
        }
      }
    },
    [accessToken, params.groupId],
  );

  if (!accessToken || !params.groupId || !Number.isInteger(groupSize) || groupSize < 1) {
    return (
      <Screen edges={['bottom']}>
        <ThemedText themeColor="textSecondary">Open a group to plan a night for it.</ThemedText>
        <Button title="Go to your groups" onPress={() => router.replace('/groups')} />
      </Screen>
    );
  }

  switch (step.status) {
    case 'generating':
      return (
        <Screen edges={['bottom']}>
          <View style={styles.centered} accessibilityLiveRegion="polite">
            <ActivityIndicator size="large" color={theme.tint} />
            <ThemedText type="smallBold">Putting your group&apos;s night together…</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              This can take a few seconds.
            </ThemedText>
          </View>
        </Screen>
      );
    case 'error':
      return (
        <Screen edges={['bottom']}>
          <View style={styles.gap} accessibilityLiveRegion="polite">
            <ThemedText type="smallBold" themeColor="danger">
              Couldn&apos;t generate plans
            </ThemedText>
            <ThemedText>{step.message}</ThemedText>
          </View>
          <Button title="Try again" onPress={() => generate(step.preferences)} />
          <Button
            title="Change preferences"
            variant="secondary"
            onPress={() => setStep({ status: 'form' })}
          />
        </Screen>
      );
    case 'done':
      return (
        <Screen edges={['bottom']}>
          <ThemedText type="smallBold" accessibilityLiveRegion="polite">
            {step.round.plans.length} plans for{' '}
            {groupSize === 1 ? '1 person' : `${groupSize} people`} saved to the group.
          </ThemedText>
          {step.round.plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
          <Button title="Back to the group" onPress={() => router.back()} />
          <Button
            title="Plan another night"
            variant="secondary"
            onPress={() => setStep({ status: 'form' })}
          />
        </Screen>
      );
    case 'form':
      return (
        <PlanForm
          key={user?.id ?? 'guest'}
          accessToken={accessToken}
          title="Plan a night together"
          intro="Pick what the group feels like. The plans are saved to the group."
          submitLabel="Generate group plans"
          groupSize={groupSize}
          onSubmit={generate}
        />
      );
  }
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  gap: {
    gap: Spacing.two,
  },
});
