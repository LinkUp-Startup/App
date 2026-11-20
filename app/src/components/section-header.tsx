import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing, type ThemeColor } from '@/constants/theme';

type SectionHeaderProps = {
  title: string;
  icon: IconName;
  iconColor?: ThemeColor;
  /** Short note or control on the right, e.g. "Tap to combine" or a stepper. */
  right?: ReactNode;
  /** Small is the 12px muted label of a compact card, such as budget or group size. */
  size?: 'default' | 'small';
};

/** Icon, title and an optional note or control on the right: the heading of a form section. */
export function SectionHeader({
  title,
  icon,
  iconColor = 'tint',
  right,
  size = 'default',
}: SectionHeaderProps) {
  const small = size === 'small';

  return (
    <View style={styles.row}>
      <View style={styles.title}>
        <Icon name={icon} size={small ? 16 : 18} color={iconColor} />
        <ThemedText
          type={small ? 'label' : 'smallBold'}
          themeColor={small ? 'textSecondary' : 'text'}
          accessibilityRole="header"
          style={styles.titleText}>
          {title}
        </ThemedText>
      </View>
      {typeof right === 'string' ? (
        <ThemedText type="micro" themeColor="textSecondary">
          {right}
        </ThemedText>
      ) : (
        right
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  title: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: Spacing.one,
  },
  titleText: {
    flexShrink: 1,
  },
});
