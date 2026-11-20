import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDismissKeyboardOnBlur } from '@/hooks/use-dismiss-keyboard-on-blur';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = {
  children: ReactNode;
  /** Safe-area edges to pad on Android. Screens under a navigation header leave out 'top'. */
  edges?: Edge[];
  /** Space between the screen's sections. */
  gap?: number;
};

export function Screen({ children, edges = ['top'], gap = Spacing.three }: ScreenProps) {
  const theme = useTheme();
  // iOS draws the navigation header and the tab bar over the content (translucent glass since iOS 26). The
  // scroll view insets itself for all of them, the status bar and the home indicator together, instead of
  // safe-area padding that only knows about the screen edges.
  const ios = Platform.OS === 'ios';

  useDismissKeyboardOnBlur();

  return (
    <SafeAreaView
      edges={ios ? [] : edges}
      style={[styles.root, { backgroundColor: theme.background }]}>
      {/*
        Keeping the field you are typing in above the keyboard:
        - iOS: the scroll view scrolls the focused field into view by itself (automaticallyAdjustKeyboardInsets),
          so this wrapper stays out of the way.
        - Android: the app draws edge to edge, so the system no longer shrinks the window for the keyboard. This
          wrapper pads the bottom instead, and the scroll view then brings the focused field into view.
      */}
      <KeyboardAvoidingView
        testID="screen-keyboard-avoiding"
        style={styles.root}
        behavior="padding"
        enabled={!ios}>
        <ScrollView
          testID="screen-scroll"
          contentInsetAdjustmentBehavior={ios ? 'automatic' : 'never'}
          contentContainerStyle={[styles.content, { gap }]}
          automaticallyAdjustKeyboardInsets
          // Closing the keyboard: tapping outside a field (handled taps, such as on a button, still work) and
          // dragging the screen. On iOS the keyboard follows the finger down.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={ios ? 'interactive' : 'on-drag'}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    gap: Spacing.three,
    padding: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
