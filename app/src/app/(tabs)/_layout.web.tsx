import { Tabs } from 'expo-router';

import { FontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The tab bar on the web. The native tabs used on iOS and Android lay out beside the page content in a
 * browser, on top of the screen heading, so the web uses a normal bar along the bottom.
 */
export default function TabLayout() {
  const colors = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarActiveBackgroundColor: colors.backgroundElement,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontFamily: FontFamily.headlineSemi, fontSize: 14 },
        tabBarIconStyle: { display: 'none' },
        tabBarItemStyle: { justifyContent: 'center', borderRadius: Radius.md, margin: 6 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Plan' }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
