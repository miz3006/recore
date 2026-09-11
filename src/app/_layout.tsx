import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ExerciseSheet } from '@/components/exercise-sheet';
import { SessionSheet } from '@/components/session-sheet';
import { AuthProvider, useAuth } from '@/lib/auth/provider';
import { initCrashReporting, wrapRoot } from '@/lib/crash';
import { color, loadReadingFont } from '@/lib/theme';

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

/**
 * THE SYSTEM'S CHROME FOR EVERY PUSH ON THE ROOT STACK (10 September 2026).
 *
 * The four tab roots moved onto the system navigator on 9 September and each
 * one gained the same three things: a title that COLLAPSES as the record
 * travels under it, a bar that IS Liquid Glass on an iOS 26 SDK build, and a
 * back control with the system's own edge-swipe affordance and the previous
 * screen's name beside it. **The pushes off those tabs did not move**, so the
 * app read as two apps: tap Progress and the chrome is UIKit's, tap a lift
 * inside it and the chrome is a `Text` in a row with a chevron drawn beside it.
 *
 * This preset is that same recipe, once, for the root stack. Every option in it
 * is load-bearing and the reasoning is written out in `(tabs)/next/_layout.tsx`
 * — repeated here only where the ROOT stack differs:
 *
 * · NO `headerTransparent` and NO `headerStyle.backgroundColor`. The first
 *   kills the large title outright; the second opts out of the material to
 *   paint a cream slab. An unstyled bar on an iOS 26 SDK build already IS the
 *   glass, and it hides itself at the top of a scroll so the canvas reads
 *   straight through.
 * · `contentStyle` TRANSPARENT, which is the root stack's departure from its
 *   own default (`color.canvas`). The canvas is drawn by each screen's own
 *   scroll view (`experimental_backgroundImage`, `lib/paper-field.ts`) for the
 *   reason the tab layouts give: a `PaperField` hoisted beside the navigator
 *   is covered by the navigator's opaque container, and one mounted inside the
 *   screen as an `absoluteFill` sibling costs UIKit the scroll view it tracks,
 *   so the title stops collapsing. Behind the transparent screen is the flat
 *   `color.canvas` on the root view, which is what shows for the instant before
 *   a screen mounts.
 * · The back button keeps its DEFAULT display mode, so it names the screen
 *   under it rather than drawing a bare "‹". A push is worth naming: it is the
 *   one piece of wayfinding a hand-rolled chevron could never give. The screens
 *   dressed here sit over the whole app rather than inside a tab, so each one
 *   passes its own `headerBackTitle` — the view under them is the tab GROUP,
 *   whose route name is `(tabs)` and which UIKit would print verbatim.
 *
 * Most of the app's pushes are NOT dressed here, because they are not on this
 * stack: a detail reached from exactly one tab lives in that tab's own stack so
 * the tab bar survives it, which is what every app iOS ships does.
 */
const pushHeader = {
  headerShown: true,
  contentStyle: { backgroundColor: 'transparent' },
  headerLargeTitleShadowVisible: false,
  headerShadowVisible: false,
  // The one blue does every control job (design skill §Colour), and a bar
  // button is a control.
  headerTintColor: color.brand,
  headerTitleStyle: { color: color.textPrimary },
  headerLargeTitleStyle: { color: color.textPrimary },
} as const;

import * as Notifications from 'expo-notifications';

import { targetOf } from '@/lib/coaching/push';
import { isCoachModeOn } from '@/lib/env';

function RootNavigator() {
  const { session, loading } = useAuth();
  const router = useRouter();
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

  /**
   * A TAPPED COMMENT NOTIFICATION LANDS ON ITS OWN THREAD (Phase 5).
   *
   * It is mounted at the root because a notification can be tapped from a cold
   * start, from the background, and from any tab — none of which a screen-level
   * listener would see. `getLastNotificationResponseAsync` covers the cold
   * start: the tap happened before this component existed, so there is no event
   * left to receive, only a record of one.
   *
   * `targetOf` VALIDATES the payload rather than casting it. What arrives here
   * came off the network and is about to become a route, so a malformed
   * `workoutId` must produce null and no navigation at all.
   *
   * The route it opens is the same one the coach uses. That is deliberate: a
   * thread is a thread, the viewer is derived from the session, and the screen
   * already labels the other party by name — so one screen serves both ends of
   * the link instead of two that must be kept in step.
   */
  useEffect(() => {
    if (!isCoachModeOn()) return;

    const go = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const target = targetOf(response);
      if (!target) return;
      router.push({
        pathname: '/you/coaching/workout/[id]',
        params: {
          id: target.workoutId,
          ...(target.exerciseRef ? { openRef: target.exerciseRef } : { openWhole: '1' }),
        },
      });
    };

    // The cold-start case: the tap is already in the past.
    void Notifications.getLastNotificationResponseAsync().then(go);
    const sub = Notifications.addNotificationResponseReceivedListener(go);
    return () => sub.remove();
  }, []);

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
            account exists (PLAN A3). The title is the DOCUMENT's, so the screen
            sets it (`legal.tsx`); everything else about the bar is the preset.

            `headerBackTitle` for the reason the preset gives: pushed from You,
            the view underneath is the tab GROUP, and UIKit printed its route
            name verbatim — the back control read "‹ (tabs)". It overrides the
            doc-to-doc case too (Terms links to Privacy), which is a small loss
            against a label that is never wrong. */}
        <Stack.Screen name="legal" options={{ ...pushHeader, headerBackTitle: 'Back' }} />

        {/* The real app — only once an account exists. */}
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          {/* The tracker-import fast path (§2.1). Behind the guard because it
              writes into the account's own ledger, and reached only from the
              dispatcher, which decides who is offered it. */}
          <Stack.Screen name="import-start" />
          {/* THE PLAN EDITOR, and it stays on this stack for the same reason
              the library could not pick a tab: it is reached from Next and from
              You. It is also an app-level thing to be doing — you are changing
              what the app will prescribe, not reading an answer one tab gave —
              so a destination over the whole app is what it is. Hence
              `headerBackTitle`: the view under it is the tab GROUP, whose route
              name UIKit would otherwise print verbatim as "(tabs)". */}
          <Stack.Screen name="split" options={{ ...pushHeader, headerBackTitle: 'Back' }} />
          {/* AUTHORING ONE DAY IS A MODAL, not a push (10 September 2026).
              It is a self-contained task with a commit — you name a day, write
              its movements and Save — and the navigation laws give that shape a
              modal with its own Cancel and Done rather than a chevron that
              silently throws the typing away. It presents from `split`, which
              is the only screen that opens it, and its two bar buttons are the
              screen's own (`plan-day.tsx`). */}
          <Stack.Screen name="plan-day" options={{ ...pushHeader, presentation: 'modal' }} />
          {/* THE LIFT LIBRARY LEFT THIS STACK on 10 September 2026 for the
              same reason the three below it did, plus one of its own. It is
              reached from TWO tabs, so it could not simply move into one — it
              is a component now (`components/lifts-screen.tsx`) with a
              two-line route file in each stack. On iOS 26 the root-stack
              version had also picked up the new BOTTOM-aligned search capsule,
              because there was no tab bar under it, while Progress one tap
              above kept the field at the top. Same API, same app, two
              placements. */}
          {/* PROGRESSION LEVEL TWO, READING CORRECTIONS AND APPLE HEALTH LEFT
              THIS STACK on 10 September 2026, and the reason is the tab bar.
              Each of them is pushed from exactly ONE tab — the lift's metric
              cards from Progress, the other two from You — and a detail push
              off a tab keeps the tab bar in every app iOS ships: Settings,
              Mail, Music. Registered here they covered it, so tapping a row in
              You took the whole navigation away and gave back a screen with no
              way home but the chevron.
              They now live in their tab's own stack
              (`(tabs)/progress/lift/[key].tsx`, `(tabs)/you/aliases.tsx`,
              `(tabs)/you/health.tsx`), which also gives the back control the
              tab's real name instead of the group's. */}
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
          {/* The coaching comment thread, as a real form sheet. It sits on the
              ROOT stack for the same reason `check-in` does, and the route file
              explains what happened when it did not: inside the You tab's stack
              the `formSheet` presentation was simply ignored and the thread
              rendered full screen.

              Behind the guard because it reads and writes another account's
              conversation. Detents are FIXED here where check-in needs
              `fitToContents` — the shapes are opposite, and `coach-thread.tsx`
              says why. */}
          <Stack.Screen
            name="coach-thread"
            options={{
              presentation: 'formSheet',
              /* `fitToContents`, NOT `[0.6, 1]` — and this was established the
                 hard way TWICE in this repository.

                 `check-in` recorded it first: with fixed detents every view
                 inside reported height 0, so each drew from the sheet's top
                 edge and the content stacked on itself. This thread reproduced
                 it exactly on the iOS 26.5 simulator on 10 September 2026 —
                 "COMMENTS ON / Bench Press" and the first message rendered on
                 top of one another, at 0.6.

                 So the direction is the same one that worked there: the content
                 measures ITSELF (`comment-thread.tsx` caps its scroll rather
                 than flexing) and UIKit sizes the sheet to it. It is also the
                 better sheet — a two-message thread gets a short one and a long
                 conversation a tall one, instead of both getting 60%.

                 The cost is honest and worth stating: `fitToContents` is a
                 SINGLE system-computed detent, so there is no dragging between
                 two heights. Fixed detents remain unusable in this
                 RN/iOS combination for any layout that expects a height handed
                 down, and both surfaces in this app now say so. */
              sheetAllowedDetents: 'fitToContents',
              sheetGrabberVisible: true,
              contentStyle: { backgroundColor: color.surface },
            }}
          />
          <Stack.Screen
            name="check-in"
            options={{
              presentation: 'formSheet',
              /* `fitToContents`, NOT [0.6, 1] (9 September 2026).
                 Fixed detents needed the content to fill a height the container
                 was supposed to hand down, and measured on the iOS 26.5
                 simulator it never handed one down: with `onLayout` printed onto
                 the sheet, every view inside reported height 0 — root, head,
                 scroll and footer — so each drew from the sheet's top edge and
                 the question, the lifts and the button landed on top of one
                 another. That is the "razkosano" sheet, and `contentStyle:
                 { flex: 1 }` did not fix it; the same screen presented
                 full-screen measured 874 / 86 / 582 / 81 and was perfect, which
                 is what proves the presentation was the cause.
                 So the direction is reversed. The content is measured and the
                 sheet is sized to it, which is the path that works and the
                 better sheet besides: a one-lift session gets a short sheet and
                 an eight-lift session a tall one, instead of both getting 60%
                 and one of them being mostly empty. The content it measures is
                 one ScrollView holding everything, which is the other half of
                 the fix — `check-in-sheet.tsx` says why a form sheet will not
                 share that view with a fixed head and footer. */
              sheetAllowedDetents: 'fitToContents',
              sheetGrabberVisible: true,
              /* NO `sheetCornerRadius` ON PURPOSE (9 September 2026).
                 It used to ask for `radius.xl` (24). Dropping the prop and
                 measuring what UIKit chooses for itself on the iOS 26.5
                 simulator gave a corner roughly THREE TIMES that — iOS 26 rounds
                 a floating sheet concentrically with the display, and 24 was
                 overriding that with a tighter, wronger number on the one sheet
                 the app had already made native. The system's value also moves
                 with the device for free, which a constant never will. */
              /* NO `flex: 1` HERE ANY MORE. It was added to give the sheet's
                 root something to resolve against and it did not work — see the
                 detents note above. With `fitToContents` the content sizes
                 itself, so a stretch instruction on the container is at best
                 inert and at worst another thing measuring zero. What is left is
                 the paint: `color.surface` keeps UIKit's system grey and its
                 translucent material off the warm sheet. */
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
