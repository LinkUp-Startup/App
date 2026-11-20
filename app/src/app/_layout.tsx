import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Colors, FontFamily } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import { useSyncSavedPlans } from '@/features/plans/use-sync-saved-plans';
import { useOpenReminders } from '@/features/tonight/use-open-reminders';
import { useTheme } from '@/hooks/use-theme';

// Rejects if the splash screen was already hidden (e.g. after a fast refresh); safe to ignore.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colors = useTheme();
  const dark = colors === Colors.dark;
  const base = dark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.tint,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { status, accessToken } = useAuth();
  const colors = useTheme();
  useSyncSavedPlans(accessToken);
  useOpenReminders();

  // A font that fails to load falls back to the system font, so errors never block the app.
  const [fontsLoaded, fontError] = useFonts({
    [FontFamily.display]: PlusJakartaSans_800ExtraBold,
    [FontFamily.headline]: PlusJakartaSans_700Bold,
    [FontFamily.headlineSemi]: PlusJakartaSans_600SemiBold,
    [FontFamily.body]: Inter_400Regular,
    [FontFamily.bodyMedium]: Inter_500Medium,
    [FontFamily.bodySemi]: Inter_600SemiBold,
  });
  const fontsReady = fontsLoaded || fontError !== null;

  // Keep the splash screen up until the saved session and the fonts have been read, so a signed-in user
  // never sees the app flash as a guest first, and text never swaps fonts under the user's eyes.
  useEffect(() => {
    if (status === 'ready' && fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [status, fontsReady]);

  if (!fontsReady) return null;

  return (
    // Without a back title iOS shows the previous route's name, which for the tabs is "(tabs)".
    <Stack
      screenOptions={{
        headerBackTitle: 'Back',
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: FontFamily.headline },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="plans" options={{ title: 'Your plans' }} />
      <Stack.Screen name="saved-plan/[id]" options={{ title: 'Saved plan' }} />
      <Stack.Screen name="tonight/[id]" options={{ title: 'Tonight' }} />
      <Stack.Screen name="shared-plan" options={{ title: 'Open a shared plan' }} />
      <Stack.Screen name="login" options={{ title: 'Log in' }} />
      <Stack.Screen name="register" options={{ title: 'Create account' }} />
      <Stack.Screen name="my-friends" options={{ title: 'Friends' }} />
      <Stack.Screen name="friends" options={{ title: 'Add friends' }} />
      <Stack.Screen name="groups" options={{ title: 'Groups' }} />
      <Stack.Screen name="new-group" options={{ title: 'New group' }} />
      <Stack.Screen name="group/[id]" options={{ title: 'Group' }} />
      <Stack.Screen name="group-plan" options={{ title: 'Plan for the group' }} />
      <Stack.Screen name="default-preferences" options={{ title: 'Default preferences' }} />
    </Stack>
  );
}
