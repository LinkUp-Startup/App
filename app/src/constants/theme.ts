import { Platform } from 'react-native';

/**
 * "Nocturne Kinetic" design tokens, see docs/design/nocturne_kinetic/DESIGN.md.
 * Dark is the default theme; light is the daytime alternative.
 */
export const Colors = {
  light: {
    text: '#121316',
    background: '#FFFFFF',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    /** Primary vivid purple: primary actions, selected chips, active routes. */
    tint: '#6C3CE1',
    /** Lighter end of the primary gradient. */
    tintBright: '#8B63F0',
    /** Text and icons drawn on top of `tint`. */
    onTint: '#FFFFFF',
    /** Electric cyan, darkened for contrast on white: live status, waypoints. */
    accent: '#00868F',
    /** Electric amber, darkened for contrast on white: perks, rewards, peak hours. */
    highlight: '#B07800',
    /** Crisp 1px stroke around cards and fields. */
    border: 'rgba(0, 0, 0, 0.06)',
    /** Subtle inset fill for inputs and steppers. */
    inputFill: 'rgba(0, 0, 0, 0.04)',
    /** Frosted surface for floating sheets and pills. */
    glass: 'rgba(255, 255, 255, 0.85)',
    danger: '#D93036',
    success: '#2B9A66',
  },
  dark: {
    text: '#FFFFFF',
    background: '#0F0F12',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    tint: '#9B7BFF',
    tintBright: '#B9A5FF',
    onTint: '#0B061A',
    accent: '#00F0FF',
    highlight: '#FFB300',
    border: 'rgba(255, 255, 255, 0.08)',
    inputFill: 'rgba(255, 255, 255, 0.05)',
    glass: 'rgba(33, 34, 37, 0.85)',
    danger: '#FF6369',
    success: '#3DD68C',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
});

/**
 * Font family names as registered by `useFonts` in the root layout. React Native picks a weight by
 * family, so each weight is its own name and `fontWeight` must not be set alongside it.
 */
export const FontFamily = {
  headline: 'PlusJakartaSans_700Bold',
  headlineSemi: 'PlusJakartaSans_600SemiBold',
  display: 'PlusJakartaSans_800ExtraBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
} as const;

/** Type scale from the design system (mobile sizes). */
export const Type = {
  display: { fontFamily: FontFamily.display, fontSize: 34, lineHeight: 42 },
  headlineLg: { fontFamily: FontFamily.headline, fontSize: 26, lineHeight: 34 },
  headlineMd: { fontFamily: FontFamily.headline, fontSize: 22, lineHeight: 28 },
  headlineSm: { fontFamily: FontFamily.headlineSemi, fontSize: 18, lineHeight: 24 },
  bodyLg: { fontFamily: FontFamily.bodyMedium, fontSize: 16, lineHeight: 24 },
  bodyMd: { fontFamily: FontFamily.bodyMedium, fontSize: 14, lineHeight: 20 },
  bodySm: { fontFamily: FontFamily.body, fontSize: 12, lineHeight: 16 },
  labelLg: { fontFamily: FontFamily.headlineSemi, fontSize: 14, lineHeight: 20 },
  labelMd: { fontFamily: FontFamily.headlineSemi, fontSize: 12, lineHeight: 16 },
  labelSm: { fontFamily: FontFamily.headline, fontSize: 10, lineHeight: 14 },
} as const;

/** Corner radii from the design system. */
export const Radius = {
  sm: 4,
  default: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

/** Every control keeps at least a 48x48 hit area. */
export const MinTapTarget = 48;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
