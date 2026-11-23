import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type PageHeaderProps = {
  title: string;
  /** Icon in the badge above the title. */
  icon: IconName;
  description?: string;
};

/** The top of a screen: an icon badge, a poster-capitals title and a short muted description. */
export function PageHeader({ title, icon, description }: PageHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.header}>
      <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
        <Icon name={icon} size={22} color="highlight" />
      </View>
      <ThemedText type="subtitle" accessibilityRole="header">
        {title}
      </ThemedText>
      {description ? (
        <ThemedText type="small" themeColor="textSecondary">
          {description}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  badge: {
    alignItems: 'center',
    borderRadius: Radius.md,
    height: 44,
    justifyContent: 'center',
    marginBottom: Spacing.one,
    width: 44,
  },
});
