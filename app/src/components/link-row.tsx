import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type LinkRowProps = {
  title: string;
  icon: IconName;
  iconColor?: ThemeColor;
  /** A line of explanation under the title. */
  description?: string;
  onPress: () => void;
};

/** A tappable card that leads to another screen: an icon in a tinted square, a title and a chevron. */
export function LinkRow({ title, icon, iconColor = 'tint', description, onPress }: LinkRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card style={styles.row}>
        <View style={[styles.icon, { backgroundColor: theme.inputFill }]}>
          <Icon name={icon} size={20} color={iconColor} />
        </View>
        <View style={styles.text}>
          <ThemedText type="smallBold">{title}</ThemedText>
          {description ? (
            <ThemedText type="caption" themeColor="textSecondary">
              {description}
            </ThemedText>
          ) : null}
        </View>
        <Icon name="chevron-forward" size={20} color="textSecondary" />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
  },
  icon: {
    alignItems: 'center',
    borderRadius: Radius.default,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
