import type { ScreenDef } from '../flow';

/**
 * WHAT EVERY v2 SCREEN IS GIVEN, and all it is given.
 *
 * A screen never touches the router, never fires its own view event and never
 * works out its own progress — the route does all three, so no screen can
 * forget to (§0: "Per-screen drop-off is the only thing that will eventually
 * settle which screens deserve to exist, so the instrumentation is not
 * optional").
 */
export interface ScreenProps {
  def: ScreenDef;
  /** 0…1, or null on a screen with no rail. */
  progress: number | null;
  /** Move forward. Fires the completion event and pushes. */
  onAdvance: () => void;
  /** Pop, or leave the flow from screen 1. */
  onBack: () => void;
  /** What the PREVIOUS answer changed, computed by the route so no screen has
   * to know what came before it (`echo.ts`). */
  echo: string | null;
  /**
   * Screen 1's "I already have an account" — the one way out of the funnel for
   * somebody who is not new here.
   *
   * The route owns it because the route is the only thing in this subtree that
   * touches the router, and because what it does differs between a real run
   * (the real sign-in screen) and a development run (nothing, and it says so).
   */
  onSignIn: () => void;
}
