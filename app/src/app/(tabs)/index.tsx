import { router } from 'expo-router';

import { ApiStatus } from '@/components/api-status';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function PreferencesScreen() {
  return (
    <Screen>
      <ThemedText type="subtitle">Plan your night</ThemedText>
      <ThemedText themeColor="textSecondary">
        Tell us your budget, group and what you feel like — we&apos;ll put together 2-3 complete
        plans in Lleida.
      </ThemedText>

      {/* TODO(sprint-1): preference form — budget, group size, activities, time, distance, transport checkboxes */}

      <Button title="Generate plans" onPress={() => router.push('/plans')} />

      {__DEV__ && <ApiStatus />}
    </Screen>
  );
}
