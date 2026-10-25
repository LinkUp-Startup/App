import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import { useSyncSavedPlans } from '@/features/plans/use-sync-saved-plans';

// Rejects if the splash screen was already hidden (e.g. after a fast refresh); safe to ignore.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style="auto" />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { status, accessToken } = useAuth();
  useSyncSavedPlans(accessToken);

  // Keep the splash screen up until the saved session has been read, so a signed-in user never sees the
  // app flash as a guest first.
  useEffect(() => {
    if (status === 'ready') SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  return (
    // Without a back title iOS shows the previous route's name, which for the tabs is "(tabs)".
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="plans" options={{ title: 'Your plans' }} />
      <Stack.Screen name="saved-plan/[id]" options={{ title: 'Saved plan' }} />
      <Stack.Screen name="login" options={{ title: 'Log in' }} />
      <Stack.Screen name="register" options={{ title: 'Create account' }} />
    </Stack>
  );
}
