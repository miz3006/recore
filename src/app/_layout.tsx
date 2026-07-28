import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ExerciseSheet } from '@/components/exercise-sheet';
import { useDevBypass } from '@/lib/auth/dev-bypass';
import { AuthProvider, useAuth } from '@/lib/auth/provider';
import { color } from '@/lib/theme';

// Hold the splash until the persisted session is restored from the Keychain —
// the user never sees a sign-in flash when they're already signed in.
void SplashScreen.preventAutoHideAsync();

/**
 * Root layout. Recore is a warm-paper, monochrome, light-only app ("Recore
 * Light"), so the canvas is painted `color.bg` everywhere and the status bar
 * carries dark content.
 *
 * FUNNEL (2026-07-23 conversion redesign): the account is NO LONGER the front
 * door. A first-time, signed-out user drops straight into onboarding →
 * paywall; sign-in is deferred to the very end (create the account to start the
 * trial). So onboarding + paywall + the `index` dispatcher live OUTSIDE the
 * auth guard; the real app screens (the `(tabs)` group plus split/plan-day)
 * stay behind `session !== null`, and `index` decides where to send you based
 * on (session, onboarding-done). Sign-in only exists while signed out.
 *
 * The four surfaces live in `(tabs)` on the system tab bar (CLAUDE.md §5.2);
 * split and plan-day stay pushes on this stack, because §5.3 gives a push to
 * anything with its own identity worth a back button.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { session, loading } = useAuth();
  // Dev-only paywall skip: opens the app screens on a fixed local id, without
  // an account. Compiled out of release builds (see lib/auth/dev-bypass.ts).
  const bypassed = useDevBypass();

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null; // splash is still covering the window

  const signedIn = session !== null || bypassed;

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: color.bg },
          animation: 'default',
        }}>
        {/* The dispatcher + the pre-account funnel — reachable signed-out. */}
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding/index" />
        <Stack.Screen name="paywall" />

        {/* The real app — only once an account exists (or the dev bypass is on). */}
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="split" />
          <Stack.Screen name="plan-day" />
        </Stack.Protected>

        {/* Sign-in is the LAST step of the funnel; gone once you're in. */}
        <Stack.Protected guard={session === null}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>

      {/* The Lift detail sheet is opened from BOTH Today's gutter and the Lifts
          tab, and it is a full-screen RN Modal — so it is mounted exactly once,
          above the navigator. Two copies would stack two scrims. */}
      {signedIn ? <ExerciseSheet /> : null}
    </>
  );
}

const styles = { root: { flex: 1, backgroundColor: color.bg } } as const;
