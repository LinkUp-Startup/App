import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
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
  /** Large puts the value in the heading font with its unit under it; compact is a pill small enough for a header. */
  size?: 'default' | 'large' | 'compact';
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
  size = 'default',
}: StepperProps) {
  const theme = useTheme();
  const compact = size === 'compact';
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
      style={[
        styles.row,
        compact && styles.compactRow,
        { backgroundColor: theme.inputFill, borderColor: theme.border },
      ]}>
      <StepButton
        symbol="−"
        label={`Decrease ${label.toLowerCase()}`}
        disabled={value <= min}
        compact={compact}
        onPress={() => change(-step)}
      />
      {size === 'large' ? (
        <LargeValue text={format(value)} />
      ) : (
        <ThemedText
          type={compact ? 'smallBold' : 'value'}
          themeColor={compact ? 'tint' : 'text'}
          style={[styles.value, compact && styles.compactValue]}
          numberOfLines={1}>
          {format(value)}
        </ThemedText>
      )}
      <StepButton
        symbol="+"
        label={`Increase ${label.toLowerCase()}`}
        disabled={value >= max}
        compact={compact}
        onPress={() => change(step)}
      />
    </View>
  );
}

/** "4 people" as a bold "4" with a small "people" under it. A value without a unit is just the number. */
function LargeValue({ text }: { text: string }) {
  const [amount, ...unit] = text.split(' ');

  return (
    <View style={styles.large}>
      <ThemedText type="value" numberOfLines={1}>
        {amount}
      </ThemedText>
      {unit.length > 0 && (
        <ThemedText type="micro" themeColor="textSecondary" numberOfLines={1} style={styles.unit}>
          {unit.join(' ')}
        </ThemedText>
      )}
    </View>
  );
}

type StepButtonProps = {
  symbol: string;
  label: string;
  disabled: boolean;
  compact: boolean;
  onPress: () => void;
};

function StepButton({ symbol, label, disabled, compact, onPress }: StepButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      // The buttons are 36px (24px in the compact pill), as in the design; hitSlop keeps the touch area large.
      hitSlop={compact ? 12 : 6}
      style={({ pressed }) => [
        styles.button,
        compact ? styles.compactButton : { backgroundColor: theme.backgroundElement },
        { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}>
      <ThemedText type="heading" style={compact ? styles.compactSymbol : styles.symbol}>
        {symbol}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderRadius: Radius.default,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.one,
  },
  compactRow: {
    borderRadius: Radius.full,
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  button: {
    alignItems: 'center',
    borderRadius: 6,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  compactButton: {
    height: 24,
    width: 24,
  },
  symbol: {
    fontSize: 18,
    lineHeight: 22,
  },
  compactSymbol: {
    fontSize: 16,
    lineHeight: 20,
  },
  // Shrinks before it pushes the + button out of a narrow card.
  value: {
    flexShrink: 1,
    paddingHorizontal: Spacing.one,
    textAlign: 'center',
  },
  compactValue: {
    minWidth: 50,
  },
  large: {
    alignItems: 'center',
    flexShrink: 1,
  },
  unit: {
    marginTop: -Spacing.one,
  },
});
