import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = {
  children: ReactNode;
  /** Safe-area edges to pad. Screens under a navigation header leave out 'top'. */
  edges?: Edge[];
};

export function Screen({ children, edges = ['top'] }: ScreenProps) {
  const theme = useTheme();
  // iOS draws the navigation header over the content (translucent since iOS 26), so a scroll view under a
  // header insets itself below it and above the home indicator instead of using safe-area padding.
  const underIosHeader = Platform.OS === 'ios' && !edges.includes('top');

  return (
    <SafeAreaView
      edges={underIosHeader ? [] : edges}
      style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        testID="screen-scroll"
        contentInsetAdjustmentBehavior={underIosHeader ? 'automatic' : 'never'}
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
