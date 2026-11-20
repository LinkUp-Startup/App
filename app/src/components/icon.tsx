import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import type { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type IconProps = {
  name: IconName;
  size?: number;
  /** Theme color of the glyph. */
  color?: ThemeColor;
};

/** Decorative icon: hidden from screen readers, because the label next to it already says it. */
export function Icon({ name, size = 20, color = 'text' }: IconProps) {
  const theme = useTheme();

  return (
    <Ionicons
      name={name}
      size={size}
      color={theme[color]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
