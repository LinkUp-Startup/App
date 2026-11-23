import { Platform } from 'react-native';

/**
 * The website's palette (web/src/app/globals.css): a gig poster for a night out. Wine for the night, coral for the
 * main action, butter for tickets and highlights, blush for text. Dark is the default; light is the daytime
 * version of the same palette, on cream.
 */
export const Palette = {
  wine: '#2B0D1E',
  plum: '#3A1229',
  plumLight: '#4C1A37',
  butter: '#FFE7A3',
  coral: '#FF6B5B',
  blush: '#F6E3EA',
  mauve: '#C79AAE',
  cream: '#FFF8EC',
} as const;

export const Colors = {
  light: {
    text: Palette.wine,
    background: Palette.cream,
    backgroundElement: '#FFFFFF',
    backgroundSelected: Palette.butter,
    textSecondary: '#76485D',
    /** Main actions, selected chips, active tabs: coral, darkened for contrast on cream. */
    tint: '#C93A2E',
    /** Kept for the few places that pair two tints; the same coral. */
    tintBright: '#C93A2E',
    /** Text and icons drawn on top of `tint`. */
    onTint: Palette.cream,
    /** Live status and waypoints: plum. */
    accent: '#8E2C4E',
    /** Tickets, dates, rewards: a dark butter that reads on cream. */
    highlight: '#8A5A00',
    border: 'rgba(43, 13, 30, 0.12)',
    inputFill: 'rgba(43, 13, 30, 0.05)',
    glass: 'rgba(255, 248, 236, 0.94)',
    /** Outline of a second-choice button. */
    outline: 'rgba(138, 90, 0, 0.5)',
    danger: '#C8283B',
    success: '#1F7A4A',
  },
  dark: {
    text: Palette.blush,
    background: Palette.wine,
    backgroundElement: Palette.plum,
    backgroundSelected: Palette.plumLight,
    textSecondary: Palette.mauve,
    tint: Palette.coral,
    tintBright: Palette.coral,
    onTint: Palette.wine,
    accent: Palette.butter,
    highlight: Palette.butter,
    border: 'rgba(246, 227, 234, 0.14)',
    inputFill: 'rgba(246, 227, 234, 0.06)',
    glass: 'rgba(58, 18, 41, 0.94)',
    outline: 'rgba(255, 231, 163, 0.6)',
    danger: '#FF8FA3',
    success: '#A8E6B8',
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
 * Font family names as registered by `useFonts` in the root layout, the website's fonts: Big Shoulders (tall poster
 * capitals) for titles and figures, Figtree for text. React Native picks a weight by family, so each weight is its
 * own name and `fontWeight` must not be set alongside it.
 */
export const FontFamily = {
  display: 'BigShoulders_900Black',
  headline: 'BigShoulders_800ExtraBold',
  headlineSemi: 'Figtree_700Bold',
  body: 'Figtree_400Regular',
  bodyMedium: 'Figtree_500Medium',
  bodySemi: 'Figtree_600SemiBold',
} as const;

/** Type scale (mobile sizes). Titles are poster capitals, like the website's headings. */
export const Type = {
  display: {
    fontFamily: FontFamily.display,
    fontSize: 48,
    lineHeight: 46,
    textTransform: 'uppercase',
  },
  headlineLg: {
    fontFamily: FontFamily.display,
    fontSize: 30,
    lineHeight: 30,
    textTransform: 'uppercase',
  },
  headlineMd: {
    fontFamily: FontFamily.display,
    fontSize: 24,
    lineHeight: 26,
    textTransform: 'uppercase',
  },
  headlineSm: { fontFamily: FontFamily.headlineSemi, fontSize: 18, lineHeight: 24 },
  bodyLg: { fontFamily: FontFamily.body, fontSize: 16, lineHeight: 24 },
  bodyMd: { fontFamily: FontFamily.body, fontSize: 14, lineHeight: 20 },
  bodySm: { fontFamily: FontFamily.body, fontSize: 12, lineHeight: 16 },
  labelLg: { fontFamily: FontFamily.headlineSemi, fontSize: 15, lineHeight: 20 },
  labelMd: { fontFamily: FontFamily.bodySemi, fontSize: 12, lineHeight: 16 },
  labelSm: { fontFamily: FontFamily.headlineSemi, fontSize: 10, lineHeight: 14 },
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
