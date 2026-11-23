import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AvatarProps = {
  /** The person's name; the first letter is shown. */
  name: string;
  size?: number;
};

/** A round butter badge with a person's first letter. Decorative: the name is always written beside it. */
export function Avatar({ name, size = 40 }: AvatarProps) {
  const theme = useTheme();
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.avatar,
        { backgroundColor: theme.highlight, borderRadius: Radius.full, height: size, width: size },
      ]}>
      <ThemedText type="value" themeColor="onTint">
        {initial}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
