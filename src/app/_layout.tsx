import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/lib/auth/provider';
import { color } from '@/lib/theme';

// Hold the splash until the persisted session is restored from the Keychain —
// the user never sees a sign-in flash when they're already signed in.
void SplashScreen.preventAutoHideAsync();

/**
 * Root layout. Recore is a near-black, monochrome, dark-only app (CLAUDE.md §5),
 * so the canvas is painted #0A0A0A everywhere and the status bar is light.
 * AuthProvider restores the session, scopes the local DB to the account, and
 * starts background sync; the Stack.Protected guards keep the app behind
 * sign-in (task §4) — onboarding/paywall remain stubs for now.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null; // splash is still covering the window

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.bg },
        animation: 'default',
      }}>
      <Stack.Protected guard={session !== null}>
        <Stack.Screen name="index" />
        <Stack.Screen name="stats" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="onboarding/index" />
        <Stack.Screen name="paywall" />
      </Stack.Protected>
      <Stack.Protected guard={session === null}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = { root: { flex: 1, backgroundColor: color.bg } } as const;
