import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptic on every tap (CLAUDE.md §2, §9): `Haptics.impactAsync(Light)`.
 * No-op on web where the API is unavailable. Fire-and-forget — never awaited,
 * never blocks the UI.
 */
export function tap() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** A slightly firmer tick for a committed action (e.g. Start). */
export function tapMedium() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** The rest timer's "go again" moment — a success pattern, not an alarm. */
export function success() {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/**
 * A DISCRETE VALUE CHANGED — a segment, a chip, a picker detent, a tab.
 *
 * iOS draws a hard line between the two feelings and so should we: `tap()` is
 * an *impact* ("you hit something"), while this is *selection* — the light,
 * dry click a picker wheel makes as a value passes under the line. Apple fires
 * it on segmented-control and tab changes; using an impact there makes routine
 * browsing feel heavier than committing to an action does (see the motion note
 * in `design-md/fitness/apple-fitness/DESIGN.md` §6: "light selection on
 * tab/segment change; medium impact on Start Workout").
 */
export function selection() {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}
