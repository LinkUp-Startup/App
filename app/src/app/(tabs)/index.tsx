import { router } from 'expo-router';
import { useState } from 'react';

import { ApiStatus } from '@/components/api-status';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-context';
import { PlanForm } from '@/features/preferences/plan-form';

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
      title="Plan your night"
      intro="Tell us your budget, group and what you feel like. We'll put together 2-3 complete plans in Lleida."
      submitLabel="Generate plans"
      onSubmit={(preferences) =>
        // The results screen sends the request, so it can show loading and errors.
        router.push({ pathname: '/plans', params: { preferences: JSON.stringify(preferences) } })
      }>
      <Button
        title="Start a new plan"
        variant="secondary"
        onPress={() => setPlanNumber((value) => value + 1)}
      />
      {__DEV__ && <ApiStatus />}
    </PlanForm>
  );
}
