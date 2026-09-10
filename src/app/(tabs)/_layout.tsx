import { NativeTabs } from 'expo-router/unstable-native-tabs';

/**
 * The four surfaces (CLAUDE.md §5.1) on the system tab bar (§5.2).
 *
 *   Today     "What am I doing right now?"   — the default tab, 85% of use
 *   Next      "What am I doing next?"        — the briefing (owner, 28 Jul)
 *   Progress  "Am I actually improving?"
 *   You       "Change something."
 *
 * `Next` took the `Lifts` tab's slot. §16 calls the prediction the single
 * strongest retention mechanism in the product, and it had no door of its own;
 * "how is my bench going" is a question asked occasionally, "what am I doing
 * next" is asked every training day. **Lifts is not gone** — it moved to a
 * pushed route (`/lifts`) reachable from Next and from Progress, which keeps
 * the bar at four and keeps every tab answering exactly one question.
 *
 * `NativeTabs` renders a real `UITabBarController`, which on iOS 26 *is* the
 * floating Liquid Glass bar — true refraction, correct scroll-edge behaviour,
 * correct Dynamic Island interaction, and correct behaviour when the user turns
 * on Reduce Transparency or Increase Contrast. A JavaScript tab bar can imitate
 * the look and cannot reproduce any of that, so we do not build one (§5.2). On
 * Android the same component renders Material 3.
 *
 * Icons are SF Symbols via `sf` — we ship no custom icon where a system symbol
 * exists (§6.10), because system symbols inherit weight, scale, Dynamic Type and
 * the user's contrast settings for free. **No tint is set here on purpose:**
 * Liquid Glass recolours itself against whatever is behind it and gives no
 * callback, so a hardcoded colour goes illegible over some content (§5.2).
 *
 * Android icons are deliberately absent for now — this SDK's
 * `NativeTabs.Trigger.Icon` takes a `drawable` resource name or a `src`
 * require(), neither of which exists until Android is dressed. iOS is the
 * design target and Android follows (§24).
 *
 * ## THE BAR IS ASKED TO MINIMIZE ON SCROLL — AND DOES NOT YET (9 September 2026)
 *
 * `minimizeBehavior="onScrollDown"` is the signature iOS 26 tab-bar behaviour:
 * scrolling down into content shrinks the glass bar to a small capsule and gives
 * the content the space it was occupying, then restores it on the way back up.
 * It is opted into rather than left at `automatic`, because automatic resolves to
 * the system default and the system default is not to minimize.
 *
 * **It was set, and it did not fire.** Verified on the iOS 26.5 simulator on
 * 9 September 2026: the prop is accepted (expo-router validates the value and
 * logs nothing), it reaches native, and `RNSTabsHostComponentView.mm` assigns
 * `_controller.tabBarMinimizeBehavior` on the real `UITabBarController` — and
 * the bar still does not move when the You tab is flung. UIKit minimizes against
 * a scroll view it has to FIND for itself, and this app's scrolls sit several
 * levels down inside a `PaperField` + `SafeAreaView` shell rather than being the
 * screen's own root scroll view, which is the likeliest reason it is not
 * detected.
 *
 * The line stays because it is the correct opt-in, it is inert when unhonoured,
 * and the fix is on the other side of it — but **nothing in this app should be
 * described as minimizing until someone has watched it happen.** The next step,
 * if the owner wants the behaviour, is to make each tab's scroll view the root
 * of its screen.
 *
 * Route note: Today is `today.tsx`, not `index.tsx`. `app/index.tsx` (the funnel
 * dispatcher) and `app/(tabs)/index.tsx` both resolve to `/`, so the two cannot
 * coexist — and `/today` is what §5.3's `recore://today` deep link wants to land
 * on anyway.
 */
export default function TabLayout() {
  return (
    <NativeTabs minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="today">
        <NativeTabs.Trigger.Icon sf="square.and.pencil" />
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="next">
        <NativeTabs.Trigger.Icon sf="arrow.forward" />
        <NativeTabs.Trigger.Label>Next</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="progress">
        <NativeTabs.Trigger.Icon sf="chart.xyaxis.line" />
        <NativeTabs.Trigger.Label>Progress</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="you">
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <NativeTabs.Trigger.Label>You</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
