import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth/provider';
import { useEntitlement } from '@/lib/billing/state';
import { wantsImportFastPath } from '@/lib/onboarding';
import {
  getFirstAction,
  getObTracker,
  hasImportBeenOffered,
  isOnboardingDone,
} from '@/lib/prefs';
import { useV2 } from '@/state/onboarding-v2';

/**
 * `/` is the funnel DISPATCHER and nothing else.
 *
 * Because the account is deferred to the end of the funnel (see `_layout.tsx`),
 * this route is reachable signed-out — so it routes:
 *   · onboarding not done            → /onboarding-v2/<step> (the v2 funnel,
 *                                       primary since 28 Aug 2026, resumed
 *                                       where a killed app left off;
 *                                       [step].tsx clamps bad values)
 *   · onboarded, no session          → /paywall-v2/plan (finish it — sign-in
 *                                       is the paywall's forward step)
 *   · entitled, tracker user, import
 *     never offered                  → /import-start (the §2.1 fast path)
 *   · otherwise                      → /today, inside the (tabs) group
 *
 * THE IMPORT LEG IS THE ONE ADDED ON 29 JULY (§2.1). It sits here rather than
 * inside Today because the spec puts it in the funnel — "immediately after
 * trial start, before the walkthrough" — and because a dispatcher is the only
 * place that can see all four facts at once: onboarded, signed in, entitled,
 * and a tracker answer that import can actually act on.
 *
 * It is gated on the ENTITLEMENT as well as the session: someone whose purchase
 * did not complete belongs on the lapsed surface, not in an import flow, and
 * `import-start` itself would otherwise be the first thing a non-subscriber saw.
 *
 * Home used to live here too. It moved to `(tabs)/today.tsx` when the four
 * surfaces got their tab bar: a route group's `index` and this file both
 * resolve to `/`, so keeping both would be a duplicate route — and `/today` is
 * what the `recore://today` deep link wants to land on.
 */
export default function Dispatcher() {
  const { session } = useAuth();
  const entitlement = useEntitlement();
  // Read fresh each render (cheap sync KV) — memoizing would strand the
  // dispatcher on a stale value after onboarding completes or sign-in lands.
  const onboarded = isOnboardingDone();
  /**
   * The v2 funnel's persisted position — hydrated synchronously from the same
   * SQLite, so a killed app resumes on the exact step it left.
   *
   * THE FLOW BEHIND THIS CHANGED ON 28 AUGUST 2026 (owner's ruling): v2 is the
   * primary onboarding and the illustrated funnel at `/onboarding/` is no
   * longer dispatched to. It is still reachable from the You tab's development
   * rows and still works; nothing was deleted. An install that was part-way
   * through the old flow starts the new one from screen 1 rather than resuming
   * a position that names a different screen — its answers are untouched, and
   * the new flow asks its own questions anyway.
   */
  const resumeStep = useV2((s) => s.step);

  /**
   * NOT ONBOARDED **AND SIGNED OUT** → the funnel. The second half of that
   * condition is what makes screen 1's "I already have an account" work: a
   * person who signs in there has an account that already carries their record,
   * and sending them back to screen 2 to be asked where they log their training
   * would be the app arguing with them. It also rescues the case where
   * `ensureLocalUser` wiped this device's meta on an account switch — signed in
   * with no local onboarding flag is a returning user, not a new one.
   */
  return <Redirect href="/next" />; // SIMPASS
  if (!onboarded && !session) return <Redirect href={`/onboarding-v2/${resumeStep}`} />;
  /**
   * Onboarding is done but there's still no account → the paywall is the gate,
   * and sign-in is its forward step. The app itself needs a Supabase user, in
   * development too — the paywall's DEV·SKIP goes to sign-in, not past it.
   *
   * **v2 IS THE FUNNEL'S PAYWALL SINCE 28 AUGUST 2026** (owner's ruling). The
   * screen at `src/app/paywall.tsx` is not deleted and still works; it is
   * reachable from the You tab's development rows, exactly like the illustrated
   * onboarding it shipped beside. Everything commercial about the two is the
   * same code — one `fetchOffer`, one `purchase`, one entitlement — so the swap
   * changes what the screen LOOKS like and nothing about what it promises.
   */
  if (!session) return <Redirect href="/paywall-v2/plan" />;

  if (
    entitlement === 'entitled' &&
    wantsImportFastPath(getObTracker(), hasImportBeenOffered(), getFirstAction())
  ) {
    return <Redirect href="/import-start" />;
  }

  return <Redirect href="/today" />;
}
