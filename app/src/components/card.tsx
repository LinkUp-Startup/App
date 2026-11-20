import { StyleSheet, View, type ViewProps } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CardProps = ViewProps & {
  /** Frosted translucent surface for floating panels instead of the solid card surface. */
  glass?: boolean;
};

/** Structural card (elevation level 1): tonal surface with a crisp 1px perimeter stroke. */
export function Card({ glass, style, ...rest }: CardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: glass ? theme.glass : theme.backgroundElement,
          borderColor: theme.border,
        },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.two,
    padding: Spacing.three,
  },
});
