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
