import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ExerciseSheet } from '@/components/exercise-sheet';
import { SessionSheet } from '@/components/session-sheet';
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

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null; // splash is still covering the window

  // The app needs a real account — even in development. The paywall's DEV·SKIP
  // chip only jumps the purchase screen; it still lands on sign-in, because a
  // no-account mode leaves the parser (JWT-gated, §7.3) permanently dead.
  const signedIn = session !== null;

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: color.bg },
          animation: 'default',
        }}>
        {/* The dispatcher + the pre-account funnel — reachable signed-out.
            `onboarding/[step]` is the illustrated flow (the fourteen-screen
            predecessor was deleted 30 Jul, owner's yes). */}
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding/[step]" />
        <Stack.Screen name="paywall" />
        {/* Terms / Privacy / How parsing works. OUTSIDE the guard on purpose:
            the paywall links to them and App Review taps them there, before any
            account exists (PLAN A3). */}
        <Stack.Screen name="legal" />

        {/* The real app — only once an account exists. */}
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          {/* The tracker-import fast path (§2.1). Behind the guard because it
              writes into the account's own ledger, and reached only from the
              dispatcher, which decides who is offered it. */}
          <Stack.Screen name="import-start" />
          <Stack.Screen name="split" />
          <Stack.Screen name="plan-day" />
          {/* Lifts left the tab bar to make room for Next (§4). It kept its
              whole screen — search and all — and became a push, reachable from
              Next and from Progress. */}
          <Stack.Screen name="lifts" />
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

      {/* The session detail is the same case, and it became one the moment You's
          training calendar could open a day: Progress and You are both mounted
          tabs, so a copy on each would have stacked two scrims exactly as the
          Lift sheet used to. Same store key (`sheetSession`), one mount. */}
      {signedIn ? <SessionSheet /> : null}
    </>
  );
}

const styles = { root: { flex: 1, backgroundColor: color.bg } } as const;
