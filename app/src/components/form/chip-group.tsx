import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ChipGroupProps<T extends string> = {
  /** Option value → label. */
  options: Record<T, string>;
  selected: readonly T[];
  onToggle: (value: T) => void;
  invalid?: boolean;
  /** Emoji shown before a label. Decorative only. */
  emoji?: Partial<Record<T, string>>;
};

/** Multi-select chips. Each chip is a checkbox for screen readers. */
export function ChipGroup<T extends string>({
  options,
  selected,
  onToggle,
  invalid,
  emoji,
}: ChipGroupProps<T>) {
  const theme = useTheme();

  return (
    <View style={styles.group}>
      {(Object.keys(options) as T[]).map((value) => {
        const checked = selected.includes(value);
        return (
          <Pressable
            key={value}
            accessibilityRole="checkbox"
            accessibilityLabel={options[value]}
            accessibilityState={{ checked }}
            onPress={() => onToggle(value)}
            // The chip is about 32px tall, as in the design; hitSlop brings the touch area up to 48px.
            hitSlop={8}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: checked ? theme.tint : theme.backgroundElement,
                borderColor:
                  invalid && !checked ? theme.danger : checked ? theme.tint : theme.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            {emoji?.[value] && (
              <ThemedText
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                type="label">
                {emoji[value]}
              </ThemedText>
            )}
            <ThemedText
              type="label"
              style={{ color: checked ? theme.onTint : theme.textSecondary }}>
              {options[value]}
            </ThemedText>
            {checked && (
              // Decorative: the checked state is already announced through accessibilityState.
              <ThemedText
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                type="label"
                style={{ color: theme.onTint }}>
                ✓
              </ThemedText>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    alignItems: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.one,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
