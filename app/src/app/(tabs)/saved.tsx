import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { getSavedPlans, type SavedPlan } from '@/storage/saved-plans';

export default function SavedPlansScreen() {
  const [plans, setPlans] = useState<SavedPlan[]>([]);

  useFocusEffect(
    useCallback(() => {
      getSavedPlans()
        .then(setPlans)
        .catch((error: unknown) => {
          console.warn('Could not load saved plans', error);
          setPlans([]);
        });
    }, []),
  );

  return (
    <Screen>
      <ThemedText type="subtitle">Saved plans</ThemedText>
      {plans.length === 0 ? (
        <>
          <ThemedText themeColor="textSecondary">No saved plans yet.</ThemedText>
          <Button title="Plan a night" onPress={() => router.navigate('/')} />
        </>
      ) : (
        plans.map((plan) => <ThemedText key={plan.id}>{plan.title}</ThemedText>)
      )}
    </Screen>
  );
}
