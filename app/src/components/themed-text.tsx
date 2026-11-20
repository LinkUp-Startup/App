import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { FontFamily, Fonts, ThemeColor, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'headline'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'label'
    | 'caption'
    | 'micro'
    | 'heading'
    | 'value'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? (type === 'linkPrimary' ? 'tint' : 'text')] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'headline' && styles.headline,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'label' && styles.label,
        type === 'caption' && styles.caption,
        type === 'micro' && styles.micro,
        type === 'heading' && styles.heading,
        type === 'value' && styles.value,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: Type.bodyLg,
  title: Type.display,
  subtitle: Type.headlineLg,
  headline: Type.headlineMd,
  small: Type.bodyMd,
  smallBold: Type.labelLg,
  label: Type.labelMd,
  caption: Type.bodySm,
  // The design's smallest label: 10px, for hints and units.
  micro: Type.labelSm,
  // 18px section and card titles.
  heading: Type.headlineSm,
  // 18px bold figures: a budget, a group size, a time.
  value: { fontFamily: FontFamily.headline, fontSize: 18, lineHeight: 24 },
  link: {
    ...Type.bodyMd,
    lineHeight: 30,
  },
  linkPrimary: {
    ...Type.labelLg,
    lineHeight: 30,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
