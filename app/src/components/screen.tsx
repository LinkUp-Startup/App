import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = {
  children: ReactNode;
  /** Safe-area edges to pad on Android. Screens under a navigation header leave out 'top'. */
  edges?: Edge[];
};

export function Screen({ children, edges = ['top'] }: ScreenProps) {
  const theme = useTheme();
  // iOS draws the navigation header and the tab bar over the content (translucent glass since iOS 26). The
  // scroll view insets itself for all of them, the status bar and the home indicator together, instead of
  // safe-area padding that only knows about the screen edges.
  const ios = Platform.OS === 'ios';

  return (
    <SafeAreaView
      edges={ios ? [] : edges}
      style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        testID="screen-scroll"
        contentInsetAdjustmentBehavior={ios ? 'automatic' : 'never'}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
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
