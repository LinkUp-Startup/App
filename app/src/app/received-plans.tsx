import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { deleteReceivedPlan, listReceivedPlans } from '@/api/received-plans';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { describeFriendError } from '@/features/friends/errors';
import { formatNightDate } from '@/features/plans/format';
import { PlanCard } from '@/features/plans/plan-card';
import { savePlanFor } from '@/features/plans/saved-plans-sync';
import { getSavedPlans } from '@/storage/saved-plans';
import type { ReceivedPlan } from '@/types/api';

/** "Ann sent you this on Fri 6 Nov" */
export function sentLine(received: ReceivedPlan) {
  const who = received.from?.displayName ?? 'A former friend';
  return `${who} sent you this on ${formatNightDate(received.sentAt)}`;
}

/** Plans friends sent you (#207): who sent each one, and a button to save your own copy. */
export default function ReceivedPlansScreen() {
  const { accessToken } = useAuth();
  const [plans, setPlans] = useState<ReceivedPlan[]>();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set());
  const [actionError, setActionError] = useState<{ id: string; message: string }>();

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!accessToken) return;
      setError(undefined);
      try {
        const [received, savedPlans] = await Promise.all([
          listReceivedPlans(accessToken, signal),
          // Plans already in your saved plans show as saved
          getSavedPlans().catch(() => []),
        ]);
        setSaved(new Set(savedPlans.map((plan) => plan.id)));
        setPlans(received.plans);
      } catch (caught) {
        if (!signal?.aborted) setError(describeFriendError(caught));
      }
    },
    [accessToken],
  );

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      load(controller.signal);
      return () => controller.abort();
    }, [load]),
  );

  async function save(received: ReceivedPlan) {
    setActionError(undefined);
    try {
      await savePlanFor(received.plan, accessToken);
      setSaved((ids) => new Set(ids).add(received.plan.id));
    } catch (caught) {
      console.warn('Could not save the received plan', caught);
      setActionError({ id: received.id, message: "Couldn't save this plan. Try again." });
    }
  }

  async function remove(received: ReceivedPlan) {
    if (!accessToken) return;
    setActionError(undefined);
    try {
      await deleteReceivedPlan(accessToken, received.id);
      setPlans((current) => current?.filter((plan) => plan.id !== received.id));
    } catch (caught) {
      console.warn('Could not remove the received plan', caught);
      setActionError({
        id: received.id,
        message: "Couldn't remove this plan. Check your connection and try again.",
      });
    }
  }

  if (!accessToken) {
    return (
      <Screen edges={['bottom']}>
        <ThemedText themeColor="textSecondary">
          Log in to see the plans your friends sent you.
        </ThemedText>
        <Button title="Log in" onPress={() => router.push('/login')} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']} gap={Spacing.four}>
      {error && (
        <>
          <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
            {error}
          </ThemedText>
          <Button title="Try again" variant="secondary" onPress={() => load()} />
        </>
      )}
      {!plans && !error && <ThemedText themeColor="textSecondary">Loading…</ThemedText>}
      {plans?.length === 0 && (
        <ThemedText themeColor="textSecondary">
          No plans from friends right now. When a friend sends you a plan, it shows up here.
        </ThemedText>
      )}
      {plans?.map((received) => {
        const isSaved = saved.has(received.plan.id);
        return (
          <View key={received.id} style={styles.received}>
            <ThemedText type="smallBold">{sentLine(received)}</ThemedText>
            <PlanCard
              plan={received.plan}
              footer={
                <>
                  <Button
                    title={isSaved ? 'Saved' : 'Save to my plans'}
                    icon={isSaved ? 'bookmark' : 'bookmark-outline'}
                    accessibilityLabel={
                      isSaved ? `${received.plan.title} saved` : `Save ${received.plan.title}`
                    }
                    variant={isSaved ? 'secondary' : 'primary'}
                    disabled={isSaved}
                    onPress={() => save(received)}
                  />
                  <Button
                    title="Remove"
                    icon="close-circle-outline"
                    variant="secondary"
                    accessibilityLabel={`Remove ${received.plan.title}`}
                    onPress={() => remove(received)}
                  />
                  {actionError?.id === received.id && (
                    <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
                      {actionError.message}
                    </ThemedText>
                  )}
                </>
              }
            />
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  received: {
    gap: Spacing.two,
  },
});
