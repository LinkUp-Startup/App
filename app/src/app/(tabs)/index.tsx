import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ApiStatus } from '@/components/api-status';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CheckboxList } from '@/components/form/checkbox-list';
import { ChipGroup } from '@/components/form/chip-group';
import { Stepper } from '@/components/form/stepper';
import { TextField } from '@/components/form/text-field';
import { TimeField } from '@/components/form/time-field';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { MinTapTarget, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import {
  ActivityLabels,
  Limits,
  resolveEndTime,
  TransportLabels,
} from '@/features/preferences/form';
import { StartLocationField } from '@/features/preferences/start-location-field';
import { toggle, usePreferencesForm } from '@/features/preferences/use-preferences-form';
import { usePlanPrefill } from '@/features/preferences/use-plan-prefill';
import { useTheme } from '@/hooks/use-theme';
import type { Activity, Transport } from '@/types/api';

const ActivityEmoji: Record<Activity, string> = {
  dinner: '🍽️',
  drinks: '🍸',
  club: '🪩',
  concert: '🎸',
  cinema: '🎬',
  games: '🎯',
  outdoor: '🌙',
};

// Walking and bike first, as in the design; the object's key order is the order on screen.
const TransportOptions: Record<Transport, string> = {
  walking: TransportLabels.walking,
  bike: TransportLabels.bike,
  publicTransport: TransportLabels.publicTransport,
  taxi: TransportLabels.taxi,
  car: TransportLabels.car,
};

const TransportIcons = {
  walking: 'walk',
  bike: 'bicycle',
  publicTransport: 'bus',
  taxi: 'car-sport',
  car: 'car',
} as const;

export default function PreferencesScreen() {
  const { status, user, accessToken } = useAuth();
  const [planNumber, setPlanNumber] = useState(0);
  if (status === 'loading')
    return (
      <Screen>
        <ThemedText>Loading your session…</ThemedText>
      </Screen>
    );
  return (
    <PlanForm
      key={`${user?.id ?? 'guest'}:${planNumber}`}
      accessToken={accessToken}
      onNewPlan={() => setPlanNumber((value) => value + 1)}
    />
  );
}

/** "7 hours total", from the chosen start to the end (which may be after midnight). */
function totalHours(start: Date, end: Date) {
  const hours = (resolveEndTime(start, end).getTime() - start.getTime()) / (60 * 60 * 1000);
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded} ${rounded === 1 ? 'hour' : 'hours'} total`;
}

/** "Lleida · Tonight": the city with an amber pin, and a cyan dot for tonight. */
function LocationPill() {
  const theme = useTheme();

  return (
    <View style={[styles.locationPill, { backgroundColor: theme.inputFill }]}>
      <Icon name="location" size={16} color="highlight" />
      <ThemedText type="label">Lleida</ThemedText>
      <View style={[styles.dot, { backgroundColor: theme.accent }]} />
      <ThemedText type="label" style={{ color: theme.accent }}>
        Tonight
      </ThemedText>
    </View>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
      {message}
    </ThemedText>
  ) : null;
}

function PlanForm({
  accessToken,
  onNewPlan,
}: {
  accessToken: string | null;
  onNewPlan: () => void;
}) {
  const { form, errors, setField, submit, applyDefaults, hasDraft } = usePreferencesForm();
  const { loading, message } = usePlanPrefill(accessToken, applyDefaults, hasDraft);
  const theme = useTheme();
  const hasErrors = Object.keys(errors).length > 0;
  // The optional notes start folded away, unless there is something in them or something wrong with them.
  const [notesOpen, setNotesOpen] = useState(form.notes !== '');
  const showNotes = notesOpen || !!errors.notes || form.notes !== '';

  const onSubmit = () =>
    submit((preferences) =>
      // The results screen sends the request, so it can show loading and errors.
      router.push({ pathname: '/plans', params: { preferences: JSON.stringify(preferences) } }),
    );

  return (
    <Screen gap={Spacing.four}>
      <View style={styles.header}>
        <LocationPill />
        <ThemedText type="subtitle">Plan your night</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Tell us your budget, group and what you feel like. We&apos;ll put together 2-3 complete
          plans in Lleida.
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Changes here only affect this plan. Your saved defaults stay the same.
        </ThemedText>
      </View>
      {loading && (
        <ThemedText type="small" accessibilityLiveRegion="polite">
          Loading saved defaults… You can edit while they load.
        </ThemedText>
      )}
      {message !== '' && (
        <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
          {message}
        </ThemedText>
      )}

      <View style={styles.section}>
        <SectionHeader
          title="What do you feel like?"
          icon="ticket-outline"
          right="Pick one or more"
        />
        <ChipGroup
          options={ActivityLabels}
          emoji={ActivityEmoji}
          selected={form.activities}
          onToggle={(activity) => setField('activities', toggle(form.activities, activity))}
          invalid={!!errors.activities}
        />
        <FieldError message={errors.activities} />
      </View>

      <View style={styles.cardRow}>
        <Card style={styles.cardColumn}>
          <SectionHeader
            title="Budget / person"
            icon="wallet-outline"
            iconColor="highlight"
            size="small"
          />
          <TextField
            accessibilityLabel="Budget per person in euros"
            prefix="€"
            value={form.budget}
            onChangeText={(budget) => setField('budget', budget)}
            keyboardType="decimal-pad"
            placeholder="30"
            invalid={!!errors.budget}
          />
          <FieldError message={errors.budget} />
        </Card>
        <Card style={styles.cardColumn}>
          <SectionHeader title="Group size" icon="people-outline" iconColor="accent" size="small" />
          <Stepper
            label="Group size"
            size="large"
            value={form.groupSize}
            onChange={(groupSize) => setField('groupSize', groupSize)}
            min={Limits.groupSize.min}
            max={Limits.groupSize.max}
            format={(n) => (n === 1 ? '1 person' : `${n} people`)}
          />
          <FieldError message={errors.groupSize} />
        </Card>
      </View>

      <Card>
        <SectionHeader
          title="Time window"
          icon="time-outline"
          iconColor="highlight"
          right={totalHours(form.startTime, form.endTime)}
        />
        <View style={styles.row}>
          <View style={styles.column}>
            <TimeField
              caption="From (Start)"
              icon="wine-outline"
              iconColor="tint"
              label="Start time"
              value={form.startTime}
              onChange={(startTime) => setField('startTime', startTime)}
            />
          </View>
          <View style={styles.column}>
            <TimeField
              caption="Until (Last Call)"
              icon="partly-sunny-outline"
              iconColor="accent"
              label="End time"
              value={form.endTime}
              onChange={(endTime) => setField('endTime', endTime)}
              invalid={!!errors.endTime}
            />
          </View>
        </View>
        <FieldError message={errors.endTime} />
      </Card>

      <Card style={styles.roomy}>
        <SectionHeader
          title="Maximum exploration radius"
          icon="locate-outline"
          iconColor="accent"
          right={
            <Stepper
              label="Maximum distance"
              size="compact"
              value={form.maxDistanceKm}
              onChange={(km) => setField('maxDistanceKm', km)}
              min={Limits.maxDistanceKm.min}
              max={Limits.maxDistanceKm.max}
              step={Limits.maxDistanceKm.step}
              format={(km) => `${km} km`}
            />
          }
        />
        <FieldError message={errors.maxDistanceKm} />
        <StartLocationField
          value={form.startLocation}
          onChange={(point) => setField('startLocation', point)}
          radiusKm={form.maxDistanceKm}
        />
      </Card>

      <Card>
        <SectionHeader title="Transport mode" icon="bus-outline" right="Select all that apply" />
        <CheckboxList
          grid
          options={TransportOptions}
          icons={TransportIcons}
          selected={form.transport}
          onToggle={(transport) => setField('transport', toggle(form.transport, transport))}
          invalid={!!errors.transport}
        />
        <FieldError message={errors.transport} />
      </Card>

      <Card>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Special vibe and dietary preferences"
          accessibilityState={{ expanded: showNotes }}
          onPress={() => setNotesOpen(!showNotes)}
          style={styles.collapsible}>
          <View style={styles.collapsibleTitle}>
            <Icon name="options-outline" size={18} color="tint" />
            <ThemedText type="smallBold" style={styles.collapsibleText}>
              Special vibe & dietary preferences
            </ThemedText>
            <View style={[styles.optional, { backgroundColor: theme.inputFill }]}>
              <ThemedText type="micro" themeColor="textSecondary">
                Optional
              </ThemedText>
            </View>
          </View>
          <Icon name={showNotes ? 'chevron-up' : 'chevron-down'} size={20} color="textSecondary" />
        </Pressable>
        {showNotes && (
          <>
            <ThemedText type="caption" themeColor="textSecondary">
              {`Dietary needs, accessibility, vibe… (max ${Limits.notesMaxLength} characters)`}
            </ThemedText>
            <TextField
              accessibilityLabel="Additional preferences"
              value={form.notes}
              onChangeText={(notes) => setField('notes', notes)}
              placeholder="e.g. vegetarian, quiet places, step-free access"
              multiline
              maxLength={Limits.notesMaxLength + 50}
              invalid={!!errors.notes}
            />
            <FieldError message={errors.notes} />
          </>
        )}
      </Card>

      {hasErrors && (
        <ThemedText type="small" themeColor="danger">
          Fix the highlighted fields to continue.
        </ThemedText>
      )}
      <Button
        title="Generate plans"
        size="large"
        icon="sparkles"
        trailingIcon="arrow-forward"
        onPress={onSubmit}
      />
      <Button title="Start a new plan" variant="secondary" onPress={onNewPlan} />

      {__DEV__ && <ApiStatus />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
  },
  locationPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    flexDirection: 'row',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  dot: {
    borderRadius: Radius.full,
    height: 6,
    width: 6,
  },
  section: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  // The radius card has more room between its parts than the other cards.
  roomy: {
    gap: Spacing.three,
  },
  // Budget and group size sit side by side, and only stack on a very narrow screen.
  cardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  optional: {
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cardColumn: {
    flexBasis: 150,
    flexGrow: 1,
  },
  column: {
    flex: 1,
  },
  collapsible: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'space-between',
    minHeight: MinTapTarget,
  },
  collapsibleTitle: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.one,
  },
  collapsibleText: {
    flexShrink: 1,
  },
});
