import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { formatNightDate, planSummaryLine } from '@/features/plans/format';
import { syncSavedPlans } from '@/features/plans/saved-plans-sync';
import { useTheme } from '@/hooks/use-theme';
import { getSavedPlans, type SavedPlan } from '@/storage/saved-plans';

/**
 * Plans saved on this device, shown from local storage first so it works offline (#74). When signed in, they
 * are then synced with the account, which adds plans saved on other devices (#88).
 */
export default function SavedPlansScreen() {
  const { accessToken } = useAuth();
  const [plans, setPlans] = useState<SavedPlan[]>();
  const [syncFailed, setSyncFailed] = useState(false);

  // Reload whenever the tab is shown, so plans saved or deleted elsewhere appear.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const controller = new AbortController();

      getSavedPlans()
        .then((local) => active && setPlans((current) => current ?? local))
        .catch((error: unknown) => {
          console.warn('Could not load saved plans', error);
          if (active) setPlans((current) => current ?? []);
        });

      if (accessToken) {
        syncSavedPlans(accessToken, controller.signal)
          .then((merged) => {
            if (!active) return;
            setPlans(merged);
            setSyncFailed(false);
          })
          .catch((error: unknown) => {
            if (!active) return;
            console.warn('Could not sync saved plans', error);
            setSyncFailed(true);
          });
      }

      return () => {
        active = false;
        controller.abort();
      };
    }, [accessToken]),
  );

  return (
    <Screen>
      <ThemedText type="subtitle">Saved plans</ThemedText>
      {syncFailed && (
        <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
          Couldn&apos;t reach your account. Showing the plans on this device.
        </ThemedText>
      )}
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
      {plans !== undefined && !accessToken && (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Log in to keep your saved plans on all your devices. The ones saved here move to your
            account.
          </ThemedText>
          <Button title="Log in" variant="secondary" onPress={() => router.push('/login')} />
        </>
      )}
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
