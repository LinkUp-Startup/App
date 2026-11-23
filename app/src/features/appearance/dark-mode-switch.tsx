import { StyleSheet, Switch, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useColorSchemeChoice } from '@/features/appearance/color-scheme-context';
import { useTheme } from '@/hooks/use-theme';

/** Dark or light mode for the app, kept on this phone. */
export function DarkModeSwitch() {
  const theme = useTheme();
  const { colorScheme, setColorScheme } = useColorSchemeChoice();
  const dark = colorScheme === 'dark';

  return (
    <Card style={styles.row}>
      <View style={[styles.icon, { backgroundColor: theme.inputFill }]}>
        <Icon name={dark ? 'moon-outline' : 'sunny-outline'} size={22} color="highlight" />
      </View>
      <View style={styles.text}>
        <ThemedText type="smallBold">Dark mode</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {dark ? 'Wine and coral, easy on the eyes at night' : 'Light, for planning in daylight'}
        </ThemedText>
      </View>
      <Switch
        accessibilityLabel="Dark mode"
        value={dark}
        onValueChange={(on) => setColorScheme(on ? 'dark' : 'light')}
        trackColor={{ false: theme.border, true: theme.tint }}
        thumbColor={theme.text}
        ios_backgroundColor={theme.border}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three },
  icon: {
    alignItems: 'center',
    borderRadius: Radius.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  text: { flex: 1, gap: 2 },
});
