import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AvatarProps = {
  /** The person's name; the first letter is shown. */
  name: string;
  size?: number;
};

/** A round purple-to-cyan badge with a person's first letter. Decorative: the name is always written beside it. */
export function Avatar({ name, size = 40 }: AvatarProps) {
  const theme = useTheme();
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <LinearGradient
      colors={[theme.tint, theme.accent]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.avatar, { borderRadius: Radius.full, height: size, width: size }]}>
      <ThemedText type="value" themeColor="onTint">
        {initial}
      </ThemedText>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
