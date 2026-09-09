import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ExerciseSheet } from '@/components/exercise-sheet';
import { SessionSheet } from '@/components/session-sheet';
import { AuthProvider, useAuth } from '@/lib/auth/provider';
import { initCrashReporting, wrapRoot } from '@/lib/crash';
import { color, loadReadingFont, radius } from '@/lib/theme';

// Hold the splash until the persisted session is restored from the Keychain —
// the user never sees a sign-in flash when they're already signed in.
void SplashScreen.preventAutoHideAsync();

// Before the first render, so an error thrown on the way to the first screen is
// already covered. A no-op without a DSN, and it never blocks (`lib/crash.ts`).
initCrashReporting();

/**
 * Expo Router reads this named export as the boundary for everything rendered
 * below the root layout. Before it existed, an uncaught render error in a
 * release bundle simply closed Recore — no screen, and no report either. Now it
 * lands on a page that says the record is intact, prints what the error said,
 * and hands the error to `lib/crash.ts` (`components/error-screen.tsx`).
 */
export { ErrorBoundary } from '@/components/error-screen';

/**
 * Root layout. Recore is a warm-paper, monochrome, light-only app ("Recore
 * Light"), so the canvas is painted `color.canvas` — the grouped grey — everywhere
 * a screen does not override it with the white `surface`, and the status bar
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
function RootLayout() {
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

/**
 * The root goes out wrapped so an unhandled JS error or a native crash is
 * attributed to this app rather than to an anonymous bundle. `wrapRoot` is a
 * pass-through when no DSN is compiled in, so an unconfigured build has no
 * extra layer in its tree.
 */
export default wrapRoot(RootLayout);

function RootNavigator() {
  const { session, loading } = useAuth();
  // The reading face, registered before the splash lifts so no number can
  // render in the fallback family and then reflow into the real one. A no-op
  // until the OTFs are bundled (see theme/typography.ts), and it never blocks:
  // the splash is released on the auth state, not on a font.
  const [fontReady, setFontReady] = useState(false);

  useEffect(() => {
    void loadReadingFont().finally(() => setFontReady(true));
  }, []);

  useEffect(() => {
    if (!loading && fontReady) void SplashScreen.hideAsync();
  }, [loading, fontReady]);

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
          contentStyle: { backgroundColor: color.canvas },
          animation: 'default',
        }}>
        {/* The dispatcher + the pre-account funnel — reachable signed-out.
            `onboarding/[step]` is the illustrated flow (the fourteen-screen
            predecessor was deleted 30 Jul, owner's yes). */}
        <Stack.Screen name="index" />
        {/* THE PRIMARY FUNNEL since 28 Aug 2026 (owner's ruling). It is a
            nested stack of its own (`onboarding-v2/_layout.tsx`), so the root
            names the DIRECTORY. Outside the guard for the same reason the rest
            of the funnel is: the account is the last step, not the first, and
            screen 1 offers "I already have an account" for the people it is
            not the first step for. */}
        <Stack.Screen name="onboarding-v2" />
        <Stack.Screen name="onboarding/[step]" />
        {/* THE FUNNEL'S PAYWALL since 28 Aug 2026 (owner's ruling), and a
            nested stack of its own (`paywall-v2/_layout.tsx`) like the flow it
            continues, so the root names the DIRECTORY. `paywall` below is the
            illustrated screen it replaced: still working, still registered, but
            without a door since 31 August 2026 — and outside the guard for the
            same reason — the account is the funnel's last step, not its first. */}
        <Stack.Screen name="paywall-v2" />
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
          {/* Progression, level two: one lift's metric cards, pushed from the
              tab root (28 Aug 2026). The root answers "what is moving?" across
              lifts; this answers "what is this lift doing?" — which is how the
              reference screens are reached, and why neither needs a selector. */}
          <Stack.Screen name="lift/[key]" />
          {/* Two pushes off You (12 Aug): the shorthands the parser has been
              taught, and the honest state of Apple Health. Both behind the
              guard — one reads the account's own learned rules, the other
              talks about its training. */}
          <Stack.Screen name="aliases" />
          <Stack.Screen name="health" />
          {/* The end-of-session check-in (§8.1), as a real UIKit form sheet.
              Behind the guard because it writes into the account's own record,
              and on the ROOT stack rather than inside `(tabs)` so the one push
              works from Today, from the ledger and from anywhere later.

              THE DETENTS ARE [0.6, 1]. The content is a fixed head, a scroll
              that grows by one row per unrated lift, and a fixed footer, so
              `fitToContents` is out — it forbids the `flex: 1` the scroll
              needs. 0.6 opens on the question, the first lift and the top of
              the reflection field; 1 is the system's own large detent, which
              already insets from the top (the sheet's old `maxHeight: '92%'`
              here would stack our inset on UIKit's and show a gap). Two
              detents, so the config is valid on Android's max of three.

              No header: native stack headers are unsupported inside a form
              sheet, and this one has carried its own title, × and Skip since
              the day it was drawn. `headerShown: false` is the root default
              anyway.

              `contentStyle` paints the sheet `color.surface` — the same warm
              near-white the sheet has always been, and the thing that keeps
              UIKit's system grey and its translucent material off the
              canvas. */}
          <Stack.Screen
            name="check-in"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.6, 1],
              sheetInitialDetentIndex: 0,
              sheetGrabberVisible: true,
              sheetCornerRadius: radius.xl,
              contentStyle: { backgroundColor: color.surface },
            }}
          />
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

const styles = { root: { flex: 1, backgroundColor: color.canvas } } as const;
