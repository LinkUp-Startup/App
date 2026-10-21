import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type TimeFieldProps = {
  /** Accessible name, e.g. "Start time". */
  label: string;
  value: Date;
  onChange: (value: Date) => void;
  invalid?: boolean;
};

export function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Time of day. Android opens the native dialog on press; iOS shows the compact inline picker. */
export function TimeField({ label, value, onChange, invalid }: TimeFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker
        accessibilityLabel={label}
        mode="time"
        display="compact"
        minuteInterval={15}
        value={value}
        onValueChange={(_event, date) => onChange(date)}
        style={styles.ios}
      />
    );
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatTime(value)}`}
        accessibilityHint="Opens a time picker"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: invalid ? theme.danger : 'transparent',
            opacity: pressed ? 0.8 : 1,
          },
        ]}>
        <ThemedText type="smallBold" style={styles.value}>
          {formatTime(value)}
        </ThemedText>
      </Pressable>
      {open && (
        <DateTimePicker
          mode="time"
          is24Hour
          value={value}
          onValueChange={(_event, date) => {
            setOpen(false);
            onChange(date);
          }}
          onDismiss={() => setOpen(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 48,
  },
  value: {
    fontSize: 16,
  },
  ios: {
    alignSelf: 'flex-start',
  },
});
