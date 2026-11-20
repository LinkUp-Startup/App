import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { MinTapTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: 'primary' | 'secondary';
  /** Icon before the title. */
  icon?: IconName;
  /** Icon after the title, e.g. an arrow. */
  trailingIcon?: IconName;
  /** Large is the screen's main call to action: 18px bold title and generous padding. */
  size?: 'default' | 'large';
  /** Red title and icon, for an action that deletes something. */
  destructive?: boolean;
};

export function Button({
  title,
  variant = 'primary',
  icon,
  trailingIcon,
  size = 'default',
  destructive,
  style,
  disabled,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const primary = variant === 'primary';
  const labelColor = primary ? 'onTint' : destructive ? 'danger' : 'text';

  return (
    <Pressable
      accessibilityRole="button"
      // Named by the title alone, so an icon beside it is never read out as part of the name.
      accessibilityLabel={title}
      disabled={disabled}
      style={(state) => [
        styles.button,
        size === 'large' && styles.large,
        primary
          ? { shadowColor: theme.tint, ...styles.glow }
          : { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderWidth: 1 },
        {
          opacity: disabled ? 0.5 : state.pressed ? 0.8 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {primary && (
        <LinearGradient
          colors={[theme.tint, theme.tintBright]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={styles.content}>
        {icon && <Icon name={icon} size={size === 'large' ? 22 : 20} color={labelColor} />}
        <ThemedText
          type={size === 'large' ? 'value' : 'smallBold'}
          style={styles.label}
          themeColor={labelColor}>
          {title}
        </ThemedText>
        {trailingIcon && <Icon name={trailingIcon} size={20} color={labelColor} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: Radius.md,
    justifyContent: 'center',
    minHeight: MinTapTarget,
    overflow: 'hidden',
    paddingHorizontal: Spacing.four,
  },
  large: {
    paddingVertical: Spacing.three,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  label: {
    flexShrink: 1,
    textAlign: 'center',
  },
  // Luminous glow instead of an opaque drop shadow.
  glow: {
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
});
