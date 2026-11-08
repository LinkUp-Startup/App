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
import { getShareLink, openShareSheet, stopSharing } from '@/features/plans/share-plan';
import { getSavedPlan, type SavedPlan } from '@/storage/saved-plans';

/**
 * One saved plan, opened from the Saved tab. Opens offline; deleting it also needs the account when signed in.
 * Sharing (#154) needs an account, because the link points at the plan on the server.
 */
export default function SavedPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // undefined while loading, null when the plan isn't saved (anymore).
  const [plan, setPlan] = useState<SavedPlan | null>();
  const { accessToken } = useAuth();
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareFailed, setShareFailed] = useState<string | null>(null);

  const reload = () =>
    getSavedPlan(id)
      .then((found) => setPlan(found ?? null))
      .catch((error: unknown) => console.warn('Could not reload saved plan', error));

  useEffect(() => {
    getSavedPlan(id)
      .then((found) => setPlan(found ?? null))
      .catch((error: unknown) => {
        console.warn('Could not load saved plan', error);
        setPlan(null);
      });
  }, [id]);

  function share(saved: SavedPlan) {
    if (!accessToken) {
      Alert.alert(
        'Log in to share',
        'A share link opens your plan on the LinkUp website, so the plan needs to be in your account. Your saved plans move to your account when you log in.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log in', onPress: () => router.push('/login') },
        ],
      );
      return;
    }
    setShareFailed(null);
    setSharing(true);
    getShareLink(saved, accessToken)
      .then(async (url) => {
        await reload();
        await openShareSheet(saved, url);
      })
      .catch((error: unknown) => {
        console.warn('Could not share plan', error);
        setShareFailed("Couldn't create a share link. Check your connection and try again.");
      })
      .finally(() => setSharing(false));
  }

  function confirmStopSharing(saved: SavedPlan) {
    if (!accessToken) return;
    Alert.alert('Stop sharing this plan?', 'The link stops working for everyone who has it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop sharing',
        style: 'destructive',
        onPress: () => {
          setShareFailed(null);
          stopSharing(saved.id, accessToken)
            .then(reload)
            .catch((error: unknown) => {
              console.warn('Could not stop sharing plan', error);
              setShareFailed("Couldn't stop sharing. Check your connection and try again.");
            });
        },
      },
    ]);
  }

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
            <Button
              title={sharing ? 'Getting link…' : 'Share plan'}
              disabled={sharing}
              onPress={() => share(plan)}
            />
            {plan.shareUrl && accessToken && (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  Shared: anyone with the link can see this plan.
                </ThemedText>
                <Button
                  title="Stop sharing"
                  variant="secondary"
                  onPress={() => confirmStopSharing(plan)}
                />
              </>
            )}
            {shareFailed && (
              <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
                {shareFailed}
              </ThemedText>
            )}
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
