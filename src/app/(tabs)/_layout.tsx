import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';

/**
 * The four surfaces (CLAUDE.md §5.1) on the system tab bar (§5.2).
 *
 *   Today     "What am I doing right now?"   — the default tab, 85% of use
 *   Lifts     "How is my bench going?"
 *   Progress  "Am I actually improving?"
 *   You       "Change something."
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
 * Android icons are deliberately absent for now — this SDK's `Icon` takes a
 * `drawable` resource name or an `androidSrc` require(), neither of which exists
 * until Android is dressed. iOS is the design target and Android follows (§24).
 *
 * Route note: Today is `today.tsx`, not `index.tsx`. `app/index.tsx` (the funnel
 * dispatcher) and `app/(tabs)/index.tsx` both resolve to `/`, so the two cannot
 * coexist — and `/today` is what §5.3's `recore://today` deep link wants to land
 * on anyway.
 */
export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="today">
        <Icon sf="square.and.pencil" />
        <Label>Today</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="lifts">
        <Icon sf="list.bullet" />
        <Label>Lifts</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="progress">
        <Icon sf="chart.xyaxis.line" />
        <Label>Progress</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="you">
        <Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <Label>You</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
