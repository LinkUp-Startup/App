import { Tabs } from 'expo-router';

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
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarActiveBackgroundColor: colors.backgroundElement,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.backgroundSelected,
        },
        tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
        tabBarIconStyle: { display: 'none' },
        tabBarItemStyle: { justifyContent: 'center', borderRadius: 12, margin: 6 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Plan' }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
