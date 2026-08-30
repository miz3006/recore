import { Stack } from 'expo-router';

import { color } from '@/lib/theme';

/**
 * THE THREE-SCREEN PAYWALL'S OWN NAVIGATOR.
 *
 * Cal AI splits the ask across three pushed screens — trial offer → trial
 * reminder → plan selection (`6480417616`, paywall positions 1–3) — and the
 * back chevron on screens 2 and 3 is the whole reason they are a stack rather
 * than a pager: a person who has reached the money screen can walk back to the
 * offer without leaving the funnel, and the iOS edge swipe does it for free.
 *
 * `contentStyle` paints the canvas on the navigator so the gap revealed
 * mid-swipe is warm paper rather than the system's black.
 *
 * ## This IS the funnel's paywall (28 August 2026, owner's ruling)
 *
 * The dispatcher, the You tab's subscription row and the lapsed ledger's
 * "resubscribe" all land here. `src/app/paywall.tsx` — the illustrated screen
 * this replaced — is not deleted and not broken: it is reachable from the You
 * tab's development rows, the way the illustrated onboarding it shipped beside
 * is. Everything commercial about the two is the same code underneath, so what
 * changed is the picture, not a single promise about price, trial or renewal.
 *
 * Only `plan` is built. Screens 1 and 2 of the reference's three (trial offer →
 * trial reminder → plan selection) are still to come, and the back chevron on
 * this one already expects to walk back to them.
 */
export default function PaywallV2Layout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        contentStyle: { backgroundColor: color.canvas },
      }}
    />
  );
}
