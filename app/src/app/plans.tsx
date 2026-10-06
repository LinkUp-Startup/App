import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function PlansScreen() {
  // TODO(sprint-1): call generatePlans() with the submitted preferences and render the results.
  return (
    <Screen edges={['bottom']}>
      <ThemedText themeColor="textSecondary">Generated plans will appear here.</ThemedText>
    </Screen>
  );
}
