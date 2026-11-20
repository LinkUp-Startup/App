import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { formatTime } from '@/components/form/format-time';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TimeFieldProps = {
  /** Accessible name, e.g. "Start time". */
  label: string;
  value: Date;
  onChange: (value: Date) => void;
  invalid?: boolean;
  /** Small label at the top of the box, e.g. "From (Start)". */
  caption?: string;
  /** Icon on the left of the time, e.g. a cocktail for the start of the night. */
  icon?: IconName;
  iconColor?: ThemeColor;
};

export { formatTime };

/**
 * Time of day in a box like the design's: a small caption on top, then an icon on the left and the time on the
 * right. Android opens the native dialog on press; iOS shows the compact inline picker. The web has its own
 * version in time-field.web.tsx.
 */
export function TimeField({
  label,
  value,
  onChange,
  invalid,
  caption,
  icon,
  iconColor = 'tint',
}: TimeFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const box = {
    backgroundColor: theme.inputFill,
    borderColor: invalid ? theme.danger : theme.border,
  };
  const top = caption ? (
    <ThemedText type="micro" themeColor="textSecondary">
      {caption}
    </ThemedText>
  ) : null;

  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.box, box]}>
        {top}
        <View style={styles.row}>
          {icon && <Icon name={icon} size={20} color={iconColor} />}
          <DateTimePicker
            accessibilityLabel={label}
            mode="time"
            display="compact"
            minuteInterval={15}
            value={value}
            onValueChange={(_event, date) => onChange(date)}
            style={styles.ios}
          />
        </View>
      </View>
    );
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatTime(value)}`}
        accessibilityHint="Opens a time picker"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.box, box, { opacity: pressed ? 0.8 : 1 }]}>
        {top}
        <View style={styles.row}>
          {icon && <Icon name={icon} size={20} color={iconColor} />}
          <ThemedText type="value">{formatTime(value)}</ThemedText>
        </View>
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
  box: {
    borderRadius: Radius.default,
    borderWidth: 1,
    gap: Spacing.one,
    padding: Spacing.two,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ios: {
    alignSelf: 'center',
  },
});
