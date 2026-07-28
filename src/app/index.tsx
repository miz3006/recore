import { Redirect } from 'expo-router';

import { useDevBypass } from '@/lib/auth/dev-bypass';
import { useAuth } from '@/lib/auth/provider';
import { isOnboardingDone } from '@/lib/prefs';

/**
 * `/` is the funnel DISPATCHER and nothing else.
 *
 * Because the account is deferred to the end of the funnel (see `_layout.tsx`),
 * this route is reachable signed-out — so it routes:
 *   · onboarding not done      → /onboarding (start the funnel)
 *   · onboarded, no session    → /paywall (finish it — sign-in is the paywall's
 *                                 forward step)
 *   · onboarded + session      → /today, inside the (tabs) group
 *
 * Home used to live here too. It moved to `(tabs)/today.tsx` when the four
 * surfaces got their tab bar (CLAUDE.md §5.1–§5.2): a route group's `index` and
 * this file both resolve to `/`, so keeping both would be a duplicate route —
 * and `/today` is what §5.3's `recore://today` deep link wants to land on.
 */
export default function Dispatcher() {
  const { session } = useAuth();
  const bypassed = useDevBypass();
  // Read fresh each render (cheap sync KV) — memoizing would strand the
  // dispatcher on a stale value after onboarding completes or sign-in lands.
  const onboarded = isOnboardingDone();

  if (!onboarded) return <Redirect href="/onboarding" />;
  // Onboarding is done but there's still no account → the paywall is the gate,
  // and sign-in is its forward step. The app itself needs a Supabase user —
  // except under the dev bypass, which runs on a fixed local id (dev-bypass.ts).
  if (!session && !bypassed) return <Redirect href="/paywall" />;
  return <Redirect href="/today" />;
}
