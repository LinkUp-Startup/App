import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { describeApiError } from '@/api/errors';
import { getUserPreferences, putUserPreferences } from '@/api/user-preferences';
import { Button } from '@/components/button';
import { CheckboxList } from '@/components/form/checkbox-list';
import { ChipGroup } from '@/components/form/chip-group';
import { FormField } from '@/components/form/form-field';
import { TextField } from '@/components/form/text-field';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import {
  defaultsToForm,
  emptyDefaults,
  formToDefaults,
  validateDefaults,
  type DefaultsForm,
} from '@/features/preferences/defaults-form';
import { ActivityLabels, TransportLabels } from '@/features/preferences/form';
import { toggle } from '@/features/preferences/use-preferences-form';
import { loadGuestPreferences, saveGuestPreferences } from '@/storage/guest-preferences';

function failureMessage(error: unknown, account: boolean): string {
  if (!account) return 'Could not access preferences on this phone. Please try again.';
  if (error instanceof ApiError && error.status === 401)
    return 'Your session is no longer valid. Log in again from Account to access your preferences.';
  return describeApiError(error);
}

export function DefaultPreferencesEditor({ accessToken }: { accessToken: string | null }) {
  const [form, setForm] = useState(() => defaultsToForm(emptyDefaults()));
  const [baseline, setBaseline] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [retry, setRetry] = useState(0);
  const busy = useRef(false);
  const active = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const errors = submitted ? validateDefaults(form) : {};
  const dirty = JSON.stringify(form) !== baseline;

  useEffect(() => {
    let cancelled = false;
    active.current = true;
    const request = new AbortController();
    controller.current = request;
    const load = accessToken
      ? getUserPreferences(accessToken, request.signal)
      : loadGuestPreferences();
    load
      .then((values) => {
        if (cancelled) return;
        const loaded = defaultsToForm(values);
        setForm(loaded);
        setBaseline(JSON.stringify(loaded));
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(failureMessage(error, !!accessToken));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      active.current = false;
      request.abort();
    };
  }, [accessToken, retry]);

  function setField<K extends keyof DefaultsForm>(key: K, value: DefaultsForm[K]) {
    if (busy.current) return;
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setSaveError('');
  }

  async function save() {
    if (busy.current) return;
    setSubmitted(true);
    setSaved(false);
    setSaveError('');
    if (Object.keys(validateDefaults(form)).length) return;
    busy.current = true;
    setSaving(true);
    const values = formToDefaults(form);
    try {
      const persisted = accessToken
        ? await putUserPreferences(accessToken, values, controller.current?.signal)
        : await saveGuestPreferences(values).then(() => values);
      if (!active.current) return;
      const stored = defaultsToForm(persisted);
      setForm(stored);
      setBaseline(JSON.stringify(stored));
      setSaved(true);
    } catch (error) {
      if (active.current) setSaveError(failureMessage(error, !!accessToken));
    } finally {
      busy.current = false;
      if (active.current) setSaving(false);
    }
  }

  if (loading)
    return (
      <Screen edges={[]}>
        <ThemedText accessibilityLiveRegion="polite">Loading preferences…</ThemedText>
      </Screen>
    );
  if (loadError)
    return (
      <Screen edges={[]}>
        <ThemedText themeColor="danger">{loadError}</ThemedText>
        <Button
          title="Retry loading preferences"
          onPress={() => {
            setLoading(true);
            setLoadError('');
            setRetry((value) => value + 1);
          }}
        />
      </Screen>
    );

  return (
    <Screen edges={[]}>
      <ThemedText type="subtitle">Default preferences</ThemedText>
      <ThemedText themeColor="textSecondary">
        {accessToken
          ? 'Saved to your account.'
          : 'Saved only on this phone. Guest preferences are not uploaded when you sign in.'}
      </ThemedText>
      <ThemedText themeColor="textSecondary">
        All fields are optional. Leave numbers blank or deselect all options to clear a default.
      </ThemedText>
      <View pointerEvents={saving ? 'none' : 'auto'} style={{ gap: 16 }}>
        <FormField
          label="Budget per person"
          hint="EUR · Leave blank for unspecified"
          error={errors.budget}>
          <TextField
            accessibilityLabel="Default budget per person in euros"
            value={form.budget}
            onChangeText={(value) => setField('budget', value)}
            keyboardType="decimal-pad"
            editable={!saving}
            invalid={!!errors.budget}
            placeholder="Unspecified"
          />
        </FormField>
        <FormField
          label="Group size"
          hint="Number of participants · Optional"
          error={errors.groupSize}>
          <TextField
            accessibilityLabel="Default group size"
            value={form.groupSize}
            onChangeText={(value) => setField('groupSize', value)}
            keyboardType="number-pad"
            editable={!saving}
            invalid={!!errors.groupSize}
            placeholder="Unspecified"
          />
        </FormField>
        <FormField
          label="Activities"
          hint="Select any preferred activities"
          error={errors.activities}>
          <ChipGroup
            options={ActivityLabels}
            selected={form.activities}
            onToggle={(value) => setField('activities', toggle(form.activities, value))}
            invalid={!!errors.activities}
          />
        </FormField>
        <FormField
          label="Maximum distance"
          hint="Kilometres (km) · Optional"
          error={errors.maxDistanceKm}>
          <TextField
            accessibilityLabel="Default maximum distance in kilometres"
            value={form.maxDistanceKm}
            onChangeText={(value) => setField('maxDistanceKm', value)}
            keyboardType="decimal-pad"
            editable={!saving}
            invalid={!!errors.maxDistanceKm}
            placeholder="Unspecified"
          />
        </FormField>
        <FormField
          label="Transport"
          hint="Select available ways to get around"
          error={errors.transport}>
          <CheckboxList
            options={TransportLabels}
            selected={form.transport}
            onToggle={(value) => setField('transport', toggle(form.transport, value))}
            invalid={!!errors.transport}
          />
        </FormField>
      </View>
      {dirty && (
        <ThemedText type="small" themeColor="textSecondary">
          Unsaved changes. Save before leaving this screen.
        </ThemedText>
      )}
      {saveError !== '' && (
        <ThemedText themeColor="danger" accessibilityLiveRegion="polite">
          {saveError}
        </ThemedText>
      )}
      {saved && (
        <ThemedText accessibilityLiveRegion="polite">
          {accessToken ? 'Preferences saved to your account.' : 'Preferences saved on this phone.'}
        </ThemedText>
      )}
      <Button
        title={saving ? 'Saving preferences…' : 'Save preferences'}
        disabled={saving || !dirty}
        onPress={() => void save()}
      />
    </Screen>
  );
}
