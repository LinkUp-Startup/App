import { router } from 'expo-router';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function PlanResultsScreen() {
  // TODO(sprint-1): call generatePlans() with the submitted preferences and render the results.
  return (
    <Screen edges={['bottom']}>
      <ThemedText themeColor="textSecondary">Generated plans will appear here.</ThemedText>

      <Button title="Change preferences" variant="secondary" onPress={() => router.back()} />
      <Button
        title="View saved plans"
        variant="secondary"
        onPress={() => router.navigate('/saved')}
      />
    </Screen>
  );
}
