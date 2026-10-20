import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Config } from '@/config';
import { Spacing } from '@/constants/theme';
import { useApiHealth, type ApiHealth } from '@/hooks/use-api-health';
import { useTheme } from '@/hooks/use-theme';

const labels: Record<ApiHealth, string> = {
  checking: 'Checking API…',
  online: 'API online',
  offline: 'API unreachable — tap to retry',
};

/** Development aid: shows whether the backend at EXPO_PUBLIC_API_URL answers /health. */
export function ApiStatus() {
  const theme = useTheme();
  const { health, recheck } = useApiHealth();

  const dotColor = {
    checking: theme.textSecondary,
    online: theme.success,
    offline: theme.danger,
  }[health];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${labels[health]}, ${Config.apiUrl}`}
      onPress={recheck}
      disabled={health === 'checking'}
      style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <View style={styles.text}>
        <ThemedText type="smallBold">{labels[health]}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {Config.apiUrl}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  dot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  text: {
    flex: 1,
  },
});
