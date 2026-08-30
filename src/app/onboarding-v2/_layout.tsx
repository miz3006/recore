import { Stack } from 'expo-router';

import { v2color } from '@/components/onboarding-v2/tokens';

/**
 * THE v2 FLOW'S OWN NAVIGATOR.
 *
 * §3, "Screen transition": "Horizontal push. Outgoing translates left, fades to
 * ~0.6; incoming enters from the right at full opacity. Back gesture reverses.
 * Fast, slightly overshooting — ~350ms of perceived travel."
 *
 * That is the iOS push, described. So it is the iOS push: `slide_from_right` on
 * a native stack, which gives the outgoing dim, the incoming slide, and — the
 * part a hand-rolled pager would have to earn back — an interactive back swipe
 * that actually tracks the finger and can be abandoned halfway.
 *
 * What the native transition does not do is overshoot. The flow gets that
 * character from the springs INSIDE each screen instead: content arrives on
 * `arrive`, the rail rides `push`, the CTA pops on `pop`. The trade is
 * deliberate — a custom overshooting transition would have cost the
 * interruptible back gesture, and a back gesture that stutters is a much
 * louder defect than a push that lands flat.
 *
 * `contentStyle` paints the canvas on the navigator itself so the gap revealed
 * mid-swipe is paper rather than the system's black.
 */
export default function OnboardingV2Layout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        contentStyle: { backgroundColor: v2color.canvas },
      }}
    />
  );
}
