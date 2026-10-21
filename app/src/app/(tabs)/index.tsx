import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ApiStatus } from '@/components/api-status';
import { Button } from '@/components/button';
import { CheckboxList } from '@/components/form/checkbox-list';
import { ChipGroup } from '@/components/form/chip-group';
import { FormField } from '@/components/form/form-field';
import { Stepper } from '@/components/form/stepper';
import { TextField } from '@/components/form/text-field';
import { TimeField } from '@/components/form/time-field';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { ActivityLabels, Limits, TransportLabels } from '@/features/preferences/form';
import { toggle, usePreferencesForm } from '@/features/preferences/use-preferences-form';

export default function PreferencesScreen() {
  const { form, errors, setField, submit } = usePreferencesForm();
  const hasErrors = Object.keys(errors).length > 0;

  const onSubmit = () =>
    submit((preferences) =>
      // The results screen sends the request, so it can show loading and errors.
      router.push({ pathname: '/plans', params: { preferences: JSON.stringify(preferences) } }),
    );

  return (
    <Screen>
      <ThemedText type="subtitle">Plan your night</ThemedText>
      <ThemedText themeColor="textSecondary">
        Tell us your budget, group and what you feel like — we&apos;ll put together 2-3 complete
        plans in Lleida.
      </ThemedText>

      <FormField label="What do you feel like?" hint="Pick one or more" error={errors.activities}>
        <ChipGroup
          options={ActivityLabels}
          selected={form.activities}
          onToggle={(activity) => setField('activities', toggle(form.activities, activity))}
          invalid={!!errors.activities}
        />
      </FormField>

      <View style={styles.row}>
        <View style={styles.column}>
          <FormField label="Budget per person" hint="In euros" error={errors.budget}>
            <TextField
              accessibilityLabel="Budget per person in euros"
              value={form.budget}
              onChangeText={(budget) => setField('budget', budget)}
              keyboardType="decimal-pad"
              placeholder="30"
              invalid={!!errors.budget}
            />
          </FormField>
        </View>
        <View style={styles.column}>
          <FormField label="Group size" error={errors.groupSize}>
            <Stepper
              label="Group size"
              value={form.groupSize}
              onChange={(groupSize) => setField('groupSize', groupSize)}
              min={Limits.groupSize.min}
              max={Limits.groupSize.max}
              format={(n) => (n === 1 ? '1 person' : `${n} people`)}
            />
          </FormField>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.column}>
          <FormField label="From">
            <TimeField
              label="Start time"
              value={form.startTime}
              onChange={(startTime) => setField('startTime', startTime)}
            />
          </FormField>
        </View>
        <View style={styles.column}>
          <FormField label="Until" error={errors.endTime}>
            <TimeField
              label="End time"
              value={form.endTime}
              onChange={(endTime) => setField('endTime', endTime)}
              invalid={!!errors.endTime}
            />
          </FormField>
        </View>
      </View>

      <FormField label="Maximum distance" error={errors.maxDistanceKm}>
        <Stepper
          label="Maximum distance"
          value={form.maxDistanceKm}
          onChange={(km) => setField('maxDistanceKm', km)}
          min={Limits.maxDistanceKm.min}
          max={Limits.maxDistanceKm.max}
          step={Limits.maxDistanceKm.step}
          format={(km) => `${km} km`}
        />
      </FormField>

      <FormField
        label="How can you get around?"
        hint="Pick everything your group has available"
        error={errors.transport}>
        <CheckboxList
          options={TransportLabels}
          selected={form.transport}
          onToggle={(transport) => setField('transport', toggle(form.transport, transport))}
          invalid={!!errors.transport}
        />
      </FormField>

      <FormField
        label="Anything else?"
        hint={`Optional — dietary needs, accessibility, vibe… (max ${Limits.notesMaxLength} characters)`}
        error={errors.notes}>
        <TextField
          accessibilityLabel="Additional preferences"
          value={form.notes}
          onChangeText={(notes) => setField('notes', notes)}
          placeholder="e.g. vegetarian, quiet places, step-free access"
          multiline
          maxLength={Limits.notesMaxLength + 50}
          invalid={!!errors.notes}
        />
      </FormField>

      {hasErrors && (
        <ThemedText type="small" themeColor="danger">
          Fix the highlighted fields to continue.
        </ThemedText>
      )}
      <Button title="Generate plans" onPress={onSubmit} />

      {__DEV__ && <ApiStatus />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  column: {
    flex: 1,
  },
});
