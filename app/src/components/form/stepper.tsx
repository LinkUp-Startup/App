import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StepperProps = {
  /** Accessible name, e.g. "Group size". */
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
};

/** − value + control for small numeric ranges. */
export function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format = String,
}: StepperProps) {
  const theme = useTheme();
  // Round to avoid floating-point drift with steps like 0.5.
  const change = (delta: number) =>
    onChange(Math.min(max, Math.max(min, Math.round((value + delta) * 100) / 100)));

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: format(value) }}
      onAccessibilityAction={(event) =>
        change(event.nativeEvent.actionName === 'increment' ? step : -step)
      }
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <StepButton
        symbol="−"
        label={`Decrease ${label.toLowerCase()}`}
        disabled={value <= min}
        onPress={() => change(-step)}
      />
      <ThemedText type="smallBold" style={styles.value}>
        {format(value)}
      </ThemedText>
      <StepButton
        symbol="+"
        label={`Increase ${label.toLowerCase()}`}
        disabled={value >= max}
        onPress={() => change(step)}
      />
    </View>
  );
}

type StepButtonProps = {
  symbol: string;
  label: string;
  disabled: boolean;
  onPress: () => void;
};

function StepButton({ symbol, label, disabled, onPress }: StepButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.background, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}>
      <ThemedText type="subtitle" style={styles.symbol}>
        {symbol}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.one,
  },
  button: {
    alignItems: 'center',
    borderRadius: 10,
    height: 40,
    justifyContent: 'center',
    width: 48,
  },
  symbol: {
    fontSize: 24,
    lineHeight: 28,
  },
  value: {
    fontSize: 16,
  },
});
