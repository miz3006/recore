import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useDevBypass } from '@/lib/auth/dev-bypass';
import { AuthProvider, useAuth } from '@/lib/auth/provider';
import { logNativeCheck } from '@/lib/native-check';
import { makeStyles, useAppFonts, useTheme } from '@/lib/theme';

// Hold the splash until the persisted session is restored from the Keychain —
// the user never sees a sign-in flash when they're already signed in.
void SplashScreen.preventAutoHideAsync();

/**
 * Root layout. Recore is a warm-paper, monochrome, light-only app ("Recore
 * Light"), so the canvas is painted with the theme's `canvas` and the status bar
 * carries dark content.
 *
 * FUNNEL (2026-07-23 conversion redesign): the account is NO LONGER the front
 * door. A first-time, signed-out user drops straight into onboarding →
 * paywall; sign-in is deferred to the very end (create the account to start the
 * trial). So onboarding + paywall + the `index` dispatcher live OUTSIDE the
 * auth guard; the real app screens (stats/settings/split/plan-day) stay behind
 * `session !== null`, and `index` decides where to send you based on
 * (session, onboarding-done). Sign-in only exists while signed out.
 */
export default function RootLayout() {
  const styles = useStyles();
  const t = useTheme();
  // Development builds report which native entitlements actually linked — Apple
  // sign-in, Keychain, speech (PLAN.md 0.1). Silent in release bundles.
  useEffect(() => {
    void logNativeCheck();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        {/* Follows the RESOLVED theme, not the device: §6.3 lets the user pin
            light or dark, and a status bar that follows the OS instead would go
            invisible the moment those two disagree. */}
        <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { session, loading } = useAuth();
  const bypassed = useDevBypass();
  const t = useTheme();
  // JetBrains Mono (§6.5). Held behind the same splash as the session so no
  // frame ever renders a load in the system font and then reflows — a font swap
  // under a settled card makes the record itself look unstable (§7.3).
  const fontsReady = useAppFonts();
  const ready = !loading && fontsReady;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null; // splash is still covering the window

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: t.canvas },
        animation: 'default',
      }}>
      {/* The dispatcher + the pre-account funnel — reachable signed-out. */}
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding/index" />
      <Stack.Screen name="paywall" />

      {/* The real app — only once an account exists. */}
      <Stack.Protected guard={session !== null || bypassed}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="stats" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="split" />
        <Stack.Screen name="plan-day" />
      </Stack.Protected>

      {/* Sign-in is the LAST step of the funnel; gone once you're in. */}
      <Stack.Protected guard={session === null}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

const useStyles = makeStyles((t) => ({ root: { flex: 1, backgroundColor: t.canvas } }));
