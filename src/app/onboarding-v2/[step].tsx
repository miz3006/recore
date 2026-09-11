import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { echoFor } from '@/components/onboarding-v2/echo';
import { FLOW, LAST_STEP, railProgress } from '@/components/onboarding-v2/flow';
import { BuildingScreen } from '@/components/onboarding-v2/screens/BuildingScreen';
import { CommitScreen } from '@/components/onboarding-v2/screens/CommitScreen';
import { DemoScreen } from '@/components/onboarding-v2/screens/DemoScreen';
import { DoneScreen } from '@/components/onboarding-v2/screens/DoneScreen';
import { GreetingScreen } from '@/components/onboarding-v2/screens/GreetingScreen';
import { InsightScreen } from '@/components/onboarding-v2/screens/InsightScreen';
import { LiftsScreen } from '@/components/onboarding-v2/screens/LiftsScreen';
import { NameScreen } from '@/components/onboarding-v2/screens/NameScreen';
import { OverloadScreen } from '@/components/onboarding-v2/screens/OverloadScreen';
import { QuestionScreen } from '@/components/onboarding-v2/screens/QuestionScreen';
import { ReadingScreen } from '@/components/onboarding-v2/screens/ReadingScreen';
import { RevealScreen } from '@/components/onboarding-v2/screens/RevealScreen';
import type { ScreenProps } from '@/components/onboarding-v2/screens/types';
import { WelcomeScreen } from '@/components/onboarding-v2/screens/WelcomeScreen';
import { track } from '@/lib/analytics';
import { useAuth } from '@/lib/auth/provider';
import { markObStepReached } from '@/lib/funnel';
import { commitV2Onboarding } from '@/lib/onboarding-v2-commit';
import { isOnboardingDone } from '@/lib/prefs';
import { setSandboxRun, useV2, v2Answers } from '@/state/onboarding-v2';

/**
 * THE v2 FLOW'S ONE ROUTE.
 *
 * `/onboarding-v2/1` … `/onboarding-v2/18`, then `/onboarding-v2/done`.
 *
 * ## Everything that must not be forgotten lives here
 *
 * Analytics is the reason. §0: "Every screen fires a view event and an advance
 * event through the existing `analytics.ts`. Per-screen drop-off is the only
 * thing that will eventually settle which screens deserve to exist, so the
 * instrumentation is not optional." A view event fired by eighteen individual
 * screens is a view event that eventually goes missing from one of them, so no
 * screen fires its own: the route fires the view on mount and the completion on
 * the way out, and a screen's only route-facing capability is `onAdvance`.
 *
 * The same argument covers the progress rail. `railProgress` is a function of
 * the step number and lives in `flow.ts`; no screen decides how full the bar is
 * on its own behalf.
 *
 * ## The screens still write nothing to the real app — this route does, once
 *
 * v2 is the primary onboarding since 28 August 2026 (owner's ruling; §0 of the
 * spec is amended). What changed is the END of the flow and nothing before it:
 * the eighteen screens still collect into `state/onboarding-v2.ts` and touch no
 * preference, and `commitV2Onboarding` writes the lot exactly once on the way
 * to the done screen. There is still no account creation, no trial, no paywall
 * push and no RevenueCat call in this subtree — the dispatcher owns what
 * happens after `onboarding_done` is set, exactly as it did for the v1 flow.
 *
 * A DEV RUN COMMITS NOTHING. The You tab's rows open the same route through
 * `beginSandboxRun()`, and both the commit and the persistence check that flag,
 * so §0's sandbox promise survives its own graduation.
 */
export default function OnboardingV2Step() {
  const params = useLocalSearchParams<{ step?: string; dev?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const raw = params.step ?? '1';
  const isDone = raw === 'done';
  const step = isDone ? LAST_STEP + 1 : clampStep(raw);
  const def = isDone ? null : FLOW[step - 1];

  /**
   * A DEV RUN IS A PROPERTY OF THE URL, not a flag somebody switched on once.
   *
   * The You tab's rows open `/onboarding-v2/1?dev=1` and every push below
   * carries the parameter forward, so the mode is re-asserted on every screen
   * and cannot be left latched: an abandoned dev run cannot make the next real
   * onboarding write nothing and commit nothing.
   */
  const dev = params.dev === '1';

  /**
   * "I ALREADY HAVE AN ACCOUNT" — screen 1's footer link (§2's "auth last" is
   * about where the funnel ASKS, not about locking the door on someone who has
   * already been here).
   *
   * `/sign-in` exists only while signed out (`app/_layout.tsx`), so the guard
   * takes the screen away the moment the session lands and the effect below
   * carries them out of the funnel.
   */
  const onSignIn = useCallback(() => {
    if (dev) {
      // §0: a development run may not create an account. Present and honest
      // rather than absent, so the screen being tested is the real screen.
      Alert.alert('Sandbox', 'Sign-in is off in a development run. Nothing here is saved.');
      return;
    }
    track('onboarding_sign_in_tap', { flow: 'v2', step });
    router.push('/sign-in');
  }, [dev, router, step]);

  /**
   * THE ACCOUNT ARRIVED WHILE THE FUNNEL WAS ON SCREEN.
   *
   * Only one thing can cause it: somebody tapped the link above and signed in.
   * They are not a new person — their record is in their account — so the
   * funnel stands aside and the dispatcher decides where they belong.
   *
   * `isOnboardingDone()` is the guard that keeps a REPLAY working: an entitled
   * subscriber walking the flow again from You is signed in the whole time, and
   * throwing them out on the first frame would make that row useless.
   */
  useEffect(() => {
    if (dev || session === null) return;
    if (isOnboardingDone()) return;
    router.replace('/');
  }, [dev, router, session]);

  /** Both pushes go through here so the mode cannot be dropped mid-flow. */
  const go = useCallback(
    (nextStep: string) => {
      router.push({
        pathname: '/onboarding-v2/[step]',
        params: dev ? { step: nextStep, dev: '1' } : { step: nextStep },
      });
    },
    [dev, router],
  );

  // One view event per screen, fired from the one place that cannot skip a
  // screen. `completed` guards double-fires from a fast double tap.
  const completed = useRef(false);
  useEffect(() => {
    // First, because everything after it is allowed to write and this is what
    // decides whether writing is allowed.
    setSandboxRun(dev);
    track('onboarding_screen_view', {
      flow: 'v2',
      step,
      step_id: def?.id ?? 'done',
      // A dev run's events are tagged rather than dropped: the queue is local
      // and per-screen drop-off would otherwise be measured against a funnel
      // padded with the owner's own twentieth run.
      dev,
    });
    // The funnel's high-water mark (E7) and the resume position. Both are
    // recorded HERE for the same reason the view event is: this is the only
    // place that knows which screen is on the glass, so no future screen can
    // forget to say so. Neither happens on a dev run — the mark is a real pref
    // and `setStep`'s write is refused by the storage adapter anyway.
    if (!isDone && !dev) {
      markObStepReached(step);
      useV2.getState().setStep(step);
    }
  }, [def?.id, dev, isDone, step]);

  /**
   * THE GUARD IS RELEASED ON FOCUS, NOT ON MOUNT — and getting this wrong was a
   * dead end, not a glitch.
   *
   * A native stack keeps the screens behind it mounted. Resetting `completed`
   * in a mount effect meant it reset exactly once, ever: go forward (the guard
   * closes), swipe back (no remount, so no reset), and the screen you land on
   * has a Continue button that silently does nothing for the rest of the run.
   * The two auto-advancing screens — the greeting and the build — were worse
   * still: they fire `onAdvance` from their own focus effect, so coming back to
   * either one stranded you on a screen with no button at all.
   *
   * On focus it releases every time the screen becomes current, which is
   * exactly the condition under which advancing again is legitimate.
   */
  useFocusEffect(
    useCallback(() => {
      completed.current = false;
    }, []),
  );

  /**
   * THE WAY OUT OF THE DONE SCREEN, and it is two different things.
   *
   * A real run hands back to the DISPATCHER, which is the only place that can
   * see all of onboarded / signed in / entitled at once: a new person meets the
   * paywall there, and an entitled subscriber replaying setup walks straight
   * back into the app instead of being asked to buy again. `replace`, so the
   * eighteen screens cannot be swiped back into from Today.
   *
   * A dev run returns to wherever it was launched from (§0) — `dismissAll`
   * unwinds the whole stack in one move rather than replaying eighteen pops.
   */
  const exit = useCallback(() => {
    if (!dev) {
      leaveForDispatcher(router);
      return;
    }
    setSandboxRun(false); // the dev run is over; the real answers come back
    if (router.canDismiss()) router.dismissAll();
    else router.back();
  }, [dev, router]);

  const onAdvance = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    track('onboarding_screen_complete', { flow: 'v2', step, step_id: def?.id ?? 'done', dev });
    if (step >= LAST_STEP) {
      // THE COMMIT POINT — one call, at the one moment the flow is finished.
      // It is a no-op on a dev run and writes nothing about the account, the
      // trial or the entitlement (`lib/onboarding-v2-commit.ts`).
      commitV2Onboarding();
      // A DEV RUN ENDS ON THE DONE SCREEN (§0). A real one ends on the
      // DISPATCHER, which is the only place that can see onboarded / signed in
      // / entitled at once: a new person meets the paywall there, and an
      // entitled subscriber replaying setup walks back into the app instead of
      // being asked to buy again. `replace`, so the funnel cannot be swiped
      // back into from the paywall.
      if (dev) go('done');
      else leaveForDispatcher(router);
      return;
    }
    go(String(step + 1));
  }, [def?.id, dev, go, router, step]);

  /**
   * BACK STAYS HONEST AFTER A COLD START.
   *
   * A real run that resumes on screen 7 has no history behind it, and a Back
   * button that does nothing is worse than no Back button: the whole flow is
   * built on being able to change an answer. So it walks to the previous step
   * by replacing, exactly as the v1 flow does. Screen 1 of a real run has
   * nothing behind it at all — the app has not been entered yet — and Back
   * there is inert rather than a bounce through the dispatcher. A dev run still
   * leaves the sandbox from screen 1.
   */
  const onBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (dev) {
      exit();
      return;
    }
    if (step > 1) router.replace(`/onboarding-v2/${step - 1}`);
  }, [dev, exit, router, step]);

  // The done screen belongs to a development run. A real run never lands here —
  // it goes to the dispatcher from screen 20 — so a stale or hand-typed
  // `/onboarding-v2/done` is sent where the person actually belongs rather than
  // being told they are set up.
  if (isDone || !def) {
    if (!dev) return <Redirect href="/" />;
    return <DoneScreen onExit={exit} />;
  }

  const props: ScreenProps = {
    def,
    progress: railProgress(def.id),
    onAdvance,
    onBack,
    // Read at render rather than subscribed: the echo describes the answer
    // given on the PREVIOUS screen, which cannot change while this one is up.
    echo: echoFor(def.id, v2Answers()),
    onSignIn,
  };

  switch (def.kind) {
    case 'welcome':
      return <WelcomeScreen {...props} />;
    case 'demo':
      return <DemoScreen {...props} />;
    case 'reading':
      return <ReadingScreen {...props} />;
    case 'text':
      return <NameScreen {...props} />;
    case 'greeting':
      return <GreetingScreen {...props} />;
    case 'lifts':
      return <LiftsScreen {...props} />;
    case 'explainer':
      return <OverloadScreen {...props} />;
    case 'commit':
      return <CommitScreen {...props} />;
    case 'building':
      return <BuildingScreen {...props} />;
    case 'reveal':
      return <RevealScreen {...props} />;
    case 'insight':
      return <InsightScreen {...props} />;
    case 'single':
    case 'multi':
    default:
      return <QuestionScreen {...props} />;
  }
}

/**
 * LEAVE THE FUNNEL FOR THE DISPATCHER.
 *
 * It has to UNWIND rather than replace, because this flow is a NESTED stack
 * (`onboarding-v2/_layout.tsx`): a bare `replace` swaps the top screen and
 * leaves the twenty underneath, reachable with a back swipe from the one screen
 * in the app that must not be escapable backwards. `dismissTo('/')` pops them
 * off and hands the root over to `/`, which sends a new person to the paywall
 * and an entitled replay back to Today.
 *
 * IT USED TO BE `dismissAll()` FOLLOWED BY `replace('/')`, and that pair is what
 * printed "The action 'POP_TO_TOP' was not handled by any navigator"
 * (10 September 2026). Two separate faults, both of them in `dismissAll`:
 *
 * · It queues a RAW `POP_TO_TOP`, dispatched when the routing queue flushes a
 *   render later — but `canDismiss()` answered from the state at CALL time. A
 *   sign-in lands between the two: the session flips the `Stack.Protected`
 *   guards in `app/_layout.tsx`, `sign-in` is unregistered and `(tabs)`
 *   registered, and the pop reaches a root stack with nothing left to pop.
 * · A raw pop is delivered to the INNERMOST focused navigator. Called from
 *   inside this nested stack it popped these twenty screens back to screen 1
 *   instead of unwinding the root at all; only the `replace` behind it hid that.
 *
 * `dismissTo` has neither. It queues a ROUTER_LINK, which expo-router resolves
 * against the live tree at flush time and targets at the navigator that owns
 * `/` — popping to the dispatcher when it is still on the stack, and replacing
 * the current screen with it when it is not.
 */
function leaveForDispatcher(router: ReturnType<typeof useRouter>): void {
  router.dismissTo('/');
}

/** A hand-typed or stale URL must never render a blank screen. */
function clampStep(raw: string): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(parsed, 1), LAST_STEP);
}
