import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = TextInputProps & {
  invalid?: boolean;
};

export function TextField({ invalid, style, multiline, ...rest }: TextFieldProps) {
  const theme = useTheme();

  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      multiline={multiline}
      style={[
        styles.input,
        multiline && styles.multiline,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: invalid ? theme.danger : 'transparent',
          color: theme.text,
        },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 12,
    borderWidth: 1.5,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
  },
  multiline: {
    minHeight: 96,
    paddingTop: Spacing.three,
    textAlignVertical: 'top',
  },
});
