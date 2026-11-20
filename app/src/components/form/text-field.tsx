import { useState } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontFamily, MinTapTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = TextInputProps & {
  invalid?: boolean;
  /** A symbol before the value, such as "€". Turns the field into a large number-style input. */
  prefix?: string;
};

/** Keyboards without a return key to close them, on iPhone at least. */
const NumberKeyboards: KeyboardTypeOptions[] = [
  'number-pad',
  'decimal-pad',
  'numeric',
  'phone-pad',
];

export function TextField({
  invalid,
  style,
  multiline,
  prefix,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  // The number pads and the multi-line keyboard have no key that closes the keyboard, so while one is open the
  // field shows its own Done button. The field is always in view above the keyboard, so the button is too.
  const needsDone =
    focused && (multiline || (rest.keyboardType && NumberKeyboards.includes(rest.keyboardType)));

  const done = needsDone ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Done"
      hitSlop={10}
      onPress={() => Keyboard.dismiss()}
      style={({ pressed }) => [
        styles.done,
        { backgroundColor: theme.tint, opacity: pressed ? 0.7 : 1 },
      ]}>
      <ThemedText type="label" themeColor="onTint">
        Done
      </ThemedText>
    </Pressable>
  ) : null;

  const input = (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      multiline={multiline}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        prefix ? styles.prefixed : styles.input,
        multiline && styles.multiline,
        // Keep typed text clear of the Done button.
        needsDone && !prefix && styles.reserveDone,
        prefix
          ? { color: theme.text }
          : {
              backgroundColor: theme.inputFill,
              // Error beats focus: the stroke turns purple on focus, red when the value is invalid.
              borderColor: invalid ? theme.danger : focused ? theme.tint : theme.border,
              color: theme.text,
            },
        style,
      ]}
      {...rest}
    />
  );

  if (prefix) {
    return (
      <View
        style={[
          styles.wrapper,
          {
            backgroundColor: theme.inputFill,
            borderColor: invalid ? theme.danger : focused ? theme.tint : theme.border,
          },
        ]}>
        <ThemedText type="value" themeColor="tint" accessibilityElementsHidden>
          {prefix}
        </ThemedText>
        {input}
        {done}
      </View>
    );
  }

  // The input keeps the same place in the tree whether or not the button is showing, so focus is never lost.
  return (
    <View>
      {input}
      {done && (
        <View
          pointerEvents="box-none"
          style={[styles.overlay, multiline ? styles.overlayBottom : styles.overlayCenter]}>
          {done}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 16,
    minHeight: MinTapTarget,
    paddingHorizontal: Spacing.three,
  },
  reserveDone: {
    paddingRight: 72,
  },
  wrapper: {
    alignItems: 'center',
    borderRadius: Radius.default,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: Spacing.one,
    minHeight: MinTapTarget,
    paddingHorizontal: Spacing.two,
  },
  prefixed: {
    flex: 1,
    fontFamily: FontFamily.headline,
    fontSize: 18,
    minHeight: MinTapTarget,
    minWidth: 0,
  },
  multiline: {
    minHeight: 96,
    paddingTop: Spacing.three,
    textAlignVertical: 'top',
  },
  done: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + Spacing.half,
  },
  overlay: {
    alignItems: 'flex-end',
    bottom: 0,
    left: 0,
    paddingHorizontal: Spacing.two,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  overlayCenter: {
    justifyContent: 'center',
  },
  overlayBottom: {
    justifyContent: 'flex-end',
    paddingBottom: Spacing.two,
  },
});
