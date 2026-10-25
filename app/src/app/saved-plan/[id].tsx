import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-context';
import { formatNightDate } from '@/features/plans/format';
import { PlanCard } from '@/features/plans/plan-card';
import { removePlanFor } from '@/features/plans/saved-plans-sync';
import { getSavedPlan, type SavedPlan } from '@/storage/saved-plans';

/** One saved plan, opened from the Saved tab. Opens offline; deleting it also needs the account when signed in. */
export default function SavedPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // undefined while loading, null when the plan isn't saved (anymore).
  const [plan, setPlan] = useState<SavedPlan | null>();
  const { accessToken } = useAuth();
  const [deleteFailed, setDeleteFailed] = useState(false);

  useEffect(() => {
    getSavedPlan(id)
      .then((found) => setPlan(found ?? null))
      .catch((error: unknown) => {
        console.warn('Could not load saved plan', error);
        setPlan(null);
      });
  }, [id]);

  function confirmDelete(saved: SavedPlan) {
    const where = accessToken ? 'your account and this device' : 'this device';
    Alert.alert('Delete this plan?', `"${saved.title}" will be removed from ${where}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setDeleteFailed(false);
          removePlanFor(saved.id, accessToken)
            .then(() => router.back())
            .catch((error: unknown) => {
              console.warn('Could not delete saved plan', error);
              setDeleteFailed(true);
            });
        },
      },
    ]);
  }

  if (plan === undefined) return <Screen edges={['bottom']}>{null}</Screen>;

  if (plan === null) {
    return (
      <Screen edges={['bottom']}>
        <ThemedText themeColor="textSecondary">This plan is no longer saved.</ThemedText>
        <Button title="Back to saved plans" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <ThemedText type="small" themeColor="textSecondary">
        Saved on {formatNightDate(plan.savedAt)}
      </ThemedText>
      <PlanCard
        plan={plan}
        footer={
          <>
            <Button title="Delete plan" variant="secondary" onPress={() => confirmDelete(plan)} />
            {deleteFailed && (
              <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
                Couldn&apos;t delete this plan. Check your connection and try again.
              </ThemedText>
            )}
          </>
        }
      />
    </Screen>
  );
}
