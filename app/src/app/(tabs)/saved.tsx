import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { getSavedPlans, type SavedPlan } from '@/storage/saved-plans';

export default function SavedScreen() {
  const [plans, setPlans] = useState<SavedPlan[]>([]);

  useFocusEffect(
    useCallback(() => {
      getSavedPlans().then(setPlans);
    }, []),
  );

  return (
    <Screen>
      <ThemedText type="subtitle">Saved plans</ThemedText>
      {plans.length === 0 ? (
        <ThemedText themeColor="textSecondary">No saved plans yet.</ThemedText>
      ) : (
        plans.map((plan) => <ThemedText key={plan.id}>{plan.title}</ThemedText>)
      )}
    </Screen>
  );
}
