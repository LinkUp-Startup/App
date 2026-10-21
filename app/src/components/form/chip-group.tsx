import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ChipGroupProps<T extends string> = {
  /** Option value → label. */
  options: Record<T, string>;
  selected: readonly T[];
  onToggle: (value: T) => void;
  invalid?: boolean;
};

/** Multi-select chips. Each chip is a checkbox for screen readers. */
export function ChipGroup<T extends string>({
  options,
  selected,
  onToggle,
  invalid,
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
            accessibilityState={{ checked }}
            onPress={() => onToggle(value)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: checked ? theme.tint : theme.backgroundElement,
                borderColor: invalid && !checked ? theme.danger : 'transparent',
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            <ThemedText type="smallBold" style={checked ? styles.checkedLabel : undefined}>
              {options[value]}
            </ThemedText>
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
    gap: Spacing.two,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: Spacing.three,
  },
  checkedLabel: {
    color: '#ffffff',
  },
});
