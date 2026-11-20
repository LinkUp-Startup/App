import { StyleSheet, View, type ViewProps } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type PillProps = ViewProps & {
  label: string;
  /** Accent for the label and the dot: cyan live status, amber highlights, green success, and so on. */
  tone?: Extract<
    ThemeColor,
    'tint' | 'accent' | 'highlight' | 'success' | 'danger' | 'textSecondary'
  >;
  /** Show a small status dot before the label. */
  dot?: boolean;
  /** Icon before the label, in the pill's tone. */
  icon?: IconName;
};

/** Small non-interactive status tag, e.g. "24 spots active" or "Peak". */
export function Pill({ label, tone = 'textSecondary', dot, icon, style, ...rest }: PillProps) {
  const theme = useTheme();

  return (
    <View
      style={[styles.pill, { backgroundColor: theme.inputFill, borderColor: theme.border }, style]}
      {...rest}>
      {dot && <View style={[styles.dot, { backgroundColor: theme[tone] }]} />}
      {icon && <Icon name={icon} size={14} color={tone} />}
      <ThemedText type="label" style={{ color: theme[tone] }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + Spacing.half,
  },
  dot: {
    borderRadius: Radius.full,
    height: 6,
    width: 6,
  },
});
