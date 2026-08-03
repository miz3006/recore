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
import { useOnboardingAnswers } from '@/state/onboarding';

/**
 * `/` is the funnel DISPATCHER and nothing else.
 *
 * Because the account is deferred to the end of the funnel (see `_layout.tsx`),
 * this route is reachable signed-out — so it routes:
 *   · onboarding not done            → /onboarding/<step> (the illustrated
 *                                       funnel, resumed where a killed app
 *                                       left off; [step].tsx clamps bad values)
 *   · onboarded, no session          → /paywall (finish it — sign-in is the
 *                                       paywall's forward step)
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
  // The illustrated funnel's persisted position — hydrated synchronously from
  // the same SQLite, so a killed app resumes on the exact step it left.
  const resumeStep = useOnboardingAnswers((s) => s.currentStep);

  if (!onboarded) return <Redirect href={`/onboarding/${resumeStep}`} />;
  // Onboarding is done but there's still no account → the paywall is the gate,
  // and sign-in is its forward step. The app itself needs a Supabase user,
  // in development too — the paywall's DEV·SKIP goes to sign-in, not past it.
  if (!session) return <Redirect href="/paywall" />;

  if (
    entitlement === 'entitled' &&
    wantsImportFastPath(getObTracker(), hasImportBeenOffered(), getFirstAction())
  ) {
    return <Redirect href="/import-start" />;
  }

  return <Redirect href="/today" />;
}
