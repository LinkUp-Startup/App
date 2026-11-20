import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ErrorNote } from '@/components/error-note';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { savePlanFor } from '@/features/plans/saved-plans-sync';
import type { Plan } from '@/types/api';

/**
 * Follows the plan the group chose: keeps it with the person's own plans, so it is theirs to follow even without
 * a connection, and opens Tonight mode for it. Every member does this on their own phone.
 */
export function FollowPlanButton({ plan }: { plan: Plan }) {
  const { accessToken } = useAuth();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string>();

  async function follow() {
    setOpening(true);
    setError(undefined);
    try {
      // Saved to the account when signed in; kept on this phone either way. Tonight mode reads it from the phone.
      await savePlanFor(plan, accessToken);
      router.push({ pathname: '/tonight/[id]', params: { id: plan.id } });
    } catch (caught) {
      console.warn('Could not keep the winning plan on this phone', caught);
      setError("Couldn't keep this plan on your phone. Try again.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <View style={styles.container}>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button
        title={opening ? 'Opening…' : 'Follow this plan'}
        icon="navigate"
        accessibilityHint="Keeps the plan with your plans and opens Tonight mode"
        disabled={opening}
        onPress={follow}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
});
