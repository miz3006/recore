import { Redirect } from 'expo-router';

import { useDevBypass } from '@/lib/auth/dev-bypass';
import { useAuth } from '@/lib/auth/provider';
import { isOnboardingDone } from '@/lib/prefs';

/**
 * `/` is the funnel DISPATCHER and nothing else (CLAUDE.md §13.1, PLAN.md 0.7).
 *
 *   · onboarding not done          → /onboarding (start the funnel)
 *   · onboarded, no session        → /paywall (finish it — sign-in is the
 *                                     paywall's forward step)
 *   · onboarded + session          → /today, inside the (tabs) group
 *
 * Because the account is deferred to the end of the funnel, this route is
 * reachable signed-out; only the real app screens sit behind the auth guard in
 * `_layout.tsx`.
 *
 * Home used to live here too. It moved to `(tabs)/today.tsx` in 0.6: a route
 * group's `index` and this file both resolve to `/`, so keeping both would be a
 * duplicate route — and `/today` is what §5.3's `recore://today` deep link wants
 * to land on anyway.
 */
export default function Dispatcher() {
  const { session } = useAuth();
  const bypassed = useDevBypass();
  // Read fresh each render (cheap sync KV) — memoizing would strand the
  // dispatcher on a stale value after onboarding completes or sign-in lands.
  const onboarded = isOnboardingDone();

  if (!onboarded) return <Redirect href="/onboarding" />;
  if (!session && !bypassed) return <Redirect href="/paywall" />;
  return <Redirect href="/today" />;
}
