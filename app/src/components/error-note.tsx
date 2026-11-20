import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A problem the person should know about, in a red-edged box with an icon. Read out when it appears. */
export function ErrorNote({ children }: { children: string }) {
  const theme = useTheme();

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.note, { backgroundColor: theme.inputFill, borderColor: theme.danger }]}>
      <Icon name="alert-circle-outline" size={18} color="danger" />
      <ThemedText type="small" themeColor="danger" style={styles.text}>
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    alignItems: 'center',
    borderRadius: Radius.default,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  text: {
    flex: 1,
  },
});
