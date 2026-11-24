import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, MinTapTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CheckboxListProps<T extends string> = {
  /** Option value → label. */
  options: Record<T, string>;
  selected: readonly T[];
  onToggle: (value: T) => void;
  invalid?: boolean;
  /** Icon shown after the checkbox. Decorative only. */
  icons?: Partial<Record<T, IconName>>;
  /** Two columns of separate tiles instead of one list with its own surface. */
  grid?: boolean;
};

/** Checkboxes, as a vertical list or a grid of tiles. */
export function CheckboxList<T extends string>({
  options,
  selected,
  onToggle,
  invalid,
  icons,
  grid,
}: CheckboxListProps<T>) {
  const theme = useTheme();

  return (
    <View
      style={
        grid
          ? styles.grid
          : [
              styles.list,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: invalid ? theme.danger : theme.border,
              },
            ]
      }>
      {(Object.keys(options) as T[]).map((value) => {
        const checked = selected.includes(value);
        const icon = icons?.[value];
        return (
          <Pressable
            key={value}
            accessibilityRole="checkbox"
            accessibilityLabel={options[value]}
            accessibilityState={{ checked }}
            onPress={() => onToggle(value)}
            style={({ pressed }) => [
              styles.row,
              grid && [
                styles.tile,
                {
                  backgroundColor: theme.inputFill,
                  borderColor: invalid && !checked ? theme.danger : theme.border,
                },
              ],
              { opacity: pressed ? 0.7 : 1 },
            ]}>
            <View
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              style={[
                styles.box,
                grid && styles.smallBox,
                {
                  backgroundColor: checked ? theme.tint : 'transparent',
                  borderColor: checked ? theme.tint : theme.textSecondary,
                },
              ]}>
              {checked && (
                <ThemedText
                  style={[styles.tick, grid && styles.smallTick, { color: theme.onTint }]}>
                  ✓
                </ThemedText>
              )}
            </View>
            {icon && <Icon name={icon} size={18} color={checked ? 'tint' : 'textSecondary'} />}
            <ThemedText type={grid ? 'label' : 'default'} style={styles.label}>
              {options[value]}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two + Spacing.one,
    minHeight: 44,
  },
  // A tile is about 40px tall, as in the design: 8px padding around a 16px checkbox, an icon and a label.
  tile: {
    borderRadius: Radius.default,
    borderWidth: 1,
    flexBasis: 140,
    flexGrow: 1,
    gap: Spacing.two,
    minHeight: MinTapTarget - Spacing.two,
    padding: Spacing.two,
  },
  smallBox: {
    borderRadius: 4,
    height: 16,
    width: 16,
  },
  smallTick: {
    fontSize: 10,
    lineHeight: 12,
  },
  label: {
    flexShrink: 1,
  },
  box: {
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  tick: {
    fontFamily: FontFamily.headlineSemi,
    fontSize: 14,
    lineHeight: 18,
  },
});
