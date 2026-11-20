import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { formatEuros, formatNightDate } from '@/features/plans/format';
import { SummaryStrip } from '@/features/plans/plan-card';
import { syncSavedPlans } from '@/features/plans/saved-plans-sync';
import { isTonight } from '@/features/tonight/night';
import { useNow } from '@/features/tonight/use-now';
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
  const now = useNow(60_000);
  const tonight = plans?.find((plan) => isTonight(plan, now));

  // Reload whenever the tab is shown, so plans saved or deleted elsewhere appear.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const controller = new AbortController();

      // Fresh from the device on every visit, unless the account's list (newer) has already arrived.
      let synced = false;
      getSavedPlans()
        .then((local) => active && !synced && setPlans(local))
        .catch((error: unknown) => {
          console.warn('Could not load saved plans', error);
          if (active) setPlans((current) => current ?? []);
        });

      if (accessToken) {
        syncSavedPlans(accessToken, controller.signal)
          .then((merged) => {
            if (!active) return;
            synced = true;
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
    <Screen gap={Spacing.four}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <ThemedText type="subtitle">Saved plans</ThemedText>
          {plans !== undefined && plans.length > 0 && <CountBadge count={plans.length} />}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Your nights, kept on this phone and in your account.
        </ThemedText>
      </View>

      {tonight && (
        <Button
          title={`Tonight: ${tonight.title}`}
          icon="moon-outline"
          accessibilityHint="Opens Tonight mode for this plan"
          onPress={() => router.push({ pathname: '/tonight/[id]', params: { id: tonight.id } })}
        />
      )}
      <Button
        title="Open a shared link"
        icon="link-outline"
        variant="secondary"
        onPress={() => router.push('/shared-plan')}
      />
      {syncFailed && (
        <Notice icon="cloud-offline-outline" tone="highlight">
          Couldn&apos;t reach your account. Showing the plans on this device.
        </Notice>
      )}
      {plans?.length === 0 && (
        <Card style={styles.empty}>
          <EmptyIcon />
          <ThemedText type="heading">Nothing saved yet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
            No saved plans yet. Save a plan from your results to find it here, even offline.
          </ThemedText>
          <Button
            title="Plan a night"
            icon="sparkles"
            onPress={() => router.navigate('/')}
            style={styles.emptyButton}
          />
        </Card>
      )}
      {plans?.map((plan) => (
        <SavedPlanRow key={plan.id} plan={plan} />
      ))}
      {plans !== undefined && !accessToken && (
        <Card style={styles.login}>
          <View style={styles.loginText}>
            <Icon name="cloud-upload-outline" size={22} color="highlight" />
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              Log in to keep your saved plans on all your devices. The ones saved here move to your
              account.
            </ThemedText>
          </View>
          <Button
            title="Log in"
            icon="log-in-outline"
            variant="secondary"
            onPress={() => router.push('/login')}
          />
        </Card>
      )}
    </Screen>
  );
}

/** How many plans are saved, as a purple bubble next to the title. */
function CountBadge({ count }: { count: number }) {
  const theme = useTheme();

  return (
    <View style={[styles.badge, { backgroundColor: theme.tint }]}>
      <ThemedText type="label" style={{ color: theme.onTint }}>
        {count}
      </ThemedText>
    </View>
  );
}

function EmptyIcon() {
  const theme = useTheme();

  return (
    <LinearGradient
      colors={[theme.tint, theme.accent]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.emptyGradient}>
      <Icon name="bookmark" size={28} color="onTint" />
    </LinearGradient>
  );
}

/** A short message with an icon, e.g. that the account could not be reached. */
function Notice({
  icon,
  tone,
  children,
}: {
  icon: IconName;
  tone: 'highlight' | 'danger';
  children: string;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: theme.inputFill, borderColor: theme.border }]}>
      <Icon name={icon} size={18} color={tone} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
        {children}
      </ThemedText>
    </View>
  );
}

function SavedPlanRow({ plan }: { plan: SavedPlan }) {
  const theme = useTheme();
  const night = plan.items[0] ? formatNightDate(plan.items[0].startTime) : undefined;
  const route = plan.items.map((item) => item.venue.name).join('  →  ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${plan.title}`}
      onPress={() => router.push({ pathname: '/saved-plan/[id]', params: { id: plan.id } })}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card style={styles.row}>
        {/* The same thin purple-to-cyan line as on the results, so a saved plan looks like the plan it was. */}
        <LinearGradient
          colors={[theme.tintBright, theme.accent, theme.tint]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.accent}
        />
        <View style={styles.rowTop}>
          {night ? (
            <View style={[styles.datePill, { backgroundColor: theme.inputFill }]}>
              <Icon name="calendar-outline" size={14} color="highlight" />
              <ThemedText type="label" style={{ color: theme.highlight }}>
                {night}
              </ThemedText>
            </View>
          ) : (
            <View />
          )}
          <Icon name="chevron-forward" size={20} color="textSecondary" />
        </View>
        <ThemedText type="heading">{plan.title}</ThemedText>
        {route !== '' && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {route}
          </ThemedText>
        )}
        <SummaryStrip plan={plan} />
        <View style={styles.price}>
          <Icon name="cash-outline" size={16} color="accent" />
          <ThemedText type="label" style={{ color: theme.accent }}>
            {plan.estimatedCostPerPerson == null
              ? 'Price unknown'
              : `Estimated ${formatEuros(plan.estimatedCostPerPerson)} per person`}
          </ThemedText>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  badge: {
    alignItems: 'center',
    borderRadius: Radius.full,
    height: 24,
    justifyContent: 'center',
    minWidth: 24,
    paddingHorizontal: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  centered: {
    textAlign: 'center',
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  emptyGradient: {
    alignItems: 'center',
    borderRadius: Radius.full,
    height: 64,
    justifyContent: 'center',
    marginBottom: Spacing.one,
    width: 64,
  },
  emptyButton: {
    alignSelf: 'stretch',
    marginTop: Spacing.two,
  },
  notice: {
    alignItems: 'center',
    borderRadius: Radius.default,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  login: {
    gap: Spacing.three,
  },
  loginText: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  row: {
    gap: Spacing.two,
    overflow: 'hidden',
  },
  accent: {
    height: 4,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  rowTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  datePill: {
    alignItems: 'center',
    borderRadius: Radius.full,
    flexDirection: 'row',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  price: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
  },
});
