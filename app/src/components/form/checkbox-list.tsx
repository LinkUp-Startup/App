import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CheckboxListProps<T extends string> = {
  /** Option value → label. */
  options: Record<T, string>;
  selected: readonly T[];
  onToggle: (value: T) => void;
  invalid?: boolean;
};

/** Vertical list of checkboxes. */
export function CheckboxList<T extends string>({
  options,
  selected,
  onToggle,
  invalid,
}: CheckboxListProps<T>) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.list,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: invalid ? theme.danger : 'transparent',
        },
      ]}>
      {(Object.keys(options) as T[]).map((value) => {
        const checked = selected.includes(value);
        return (
          <Pressable
            key={value}
            accessibilityRole="checkbox"
            accessibilityLabel={options[value]}
            accessibilityState={{ checked }}
            onPress={() => onToggle(value)}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
            <View
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              style={[
                styles.box,
                {
                  backgroundColor: checked ? theme.tint : 'transparent',
                  borderColor: checked ? theme.tint : theme.textSecondary,
                },
              ]}>
              {checked && <ThemedText style={styles.tick}>✓</ThemedText>}
            </View>
            <ThemedText>{options[value]}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
    minHeight: 44,
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
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 18,
  },
});
