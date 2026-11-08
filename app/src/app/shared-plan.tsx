import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { getSharedPlan } from '@/api/shared-plans';
import { Button } from '@/components/button';
import { FormField } from '@/components/form/form-field';
import { TextField } from '@/components/form/text-field';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { PlanCard } from '@/features/plans/plan-card';
import { savePlanFor } from '@/features/plans/saved-plans-sync';
import { parseShareToken } from '@/features/plans/share-link';
import { getSavedPlan } from '@/storage/saved-plans';
import type { Plan } from '@/types/api';

type Saved = 'no' | 'saving' | 'account' | 'device' | 'already';

/**
 * Opens a plan someone shared, from its link, and saves your own copy (#204). The copy is separate from the
 * shared plan: it stays when the owner stops sharing or deletes theirs.
 */
export default function SharedPlanScreen() {
  const { accessToken } = useAuth();
  const [link, setLink] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<Plan>();
  const [saved, setSaved] = useState<Saved>('no');

  async function paste() {
    setLink(await Clipboard.getStringAsync());
    setError(undefined);
  }

  async function open() {
    const token = parseShareToken(link);
    if (!token) {
      setError('This isn’t a LinkUp share link. It looks like https://linkup.th7bo.dev/plan/…');
      return;
    }
    setError(undefined);
    setPlan(undefined);
    setLoading(true);
    try {
      const { plan: shared } = await getSharedPlan(token);
      setPlan(shared);
      setSaved((await getSavedPlan(shared.id)) ? 'already' : 'no');
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 404) {
        setError('This plan isn’t shared anymore, or the link is wrong. Ask for a new link.');
      } else {
        console.warn('Could not open shared plan', failure);
        setError('Couldn’t open the plan. Check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function save(shared: Plan) {
    setSaved('saving');
    setSaved(await savePlanFor(shared, accessToken));
  }

  return (
    <Screen>
      <FormField label="Share link" hint="Paste the link someone sent you." error={error}>
        <TextField
          value={link}
          onChangeText={(text) => {
            setLink(text);
            setError(undefined);
          }}
          placeholder="https://linkup.th7bo.dev/plan/…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={open}
          invalid={!!error}
          accessibilityLabel="Share link"
        />
      </FormField>
      <View style={styles.row}>
        <View style={styles.grow}>
          <Button title="Paste" variant="secondary" onPress={paste} />
        </View>
        <View style={styles.grow}>
          <Button
            title={loading ? 'Opening…' : 'Open plan'}
            disabled={loading || link.trim() === ''}
            onPress={open}
          />
        </View>
      </View>

      {plan && (
        <PlanCard
          plan={plan}
          footer={<SaveFooter saved={saved} onSave={() => save(plan)} planId={plan.id} />}
        />
      )}
    </Screen>
  );
}

function SaveFooter({
  saved,
  onSave,
  planId,
}: {
  saved: Saved;
  onSave: () => void;
  planId: string;
}) {
  const openSaved = () => router.replace({ pathname: '/saved-plan/[id]', params: { id: planId } });

  if (saved === 'no' || saved === 'saving') {
    return (
      <Button
        title={saved === 'saving' ? 'Saving…' : 'Save to my plans'}
        disabled={saved === 'saving'}
        onPress={onSave}
      />
    );
  }

  const message = {
    already: 'This plan is already in your saved plans.',
    account: 'Saved to your plans. You keep it even if the person who shared it deletes theirs.',
    device: 'Saved on this phone. You keep it even if the person who shared it deletes theirs.',
  }[saved];

  return (
    <>
      <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
        {message}
      </ThemedText>
      <Button title="Open in saved plans" variant="secondary" onPress={openSaved} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  grow: { flex: 1 },
});
