import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { tapMedium } from '@/lib/haptics';
import {
  color,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  shadow,
  spacing,
  type,
} from '@/lib/theme';
import { useSession } from '@/state/session-store';

import { Icon } from './icon';
import { PressableScale } from './motion';

/**
 * UNDO, for the one edit that had none (11 September 2026).
 *
 * Deleting an entry removes a physical line from `raw_text`, which IS the
 * record (CLAUDE.md §3), and until now nothing could put it back. The app knew:
 * `note-surface.tsx` says "there is no undo stack behind it" as the reason the
 * delete had to stop and ask, and says it a second time beside the inline
 * editor's Delete — "on a line with no undo behind it" — as the reason that
 * button was the more accidental of the two doors. Both comments were arguing
 * for more friction because the action was unrecoverable. This makes it
 * recoverable, which is the fix the friction was standing in for.
 *
 * It is a floating pill, low on the screen, for `UNDO_WINDOW_MS` — the third
 * layer of the design skill's §Structure (canvas → ink record → floating
 * chrome), so it is glass over the page and never a card in the record. It has
 * to be a transient overlay rather than a row in the ledger: a permanent "you
 * deleted something" line would be the app talking about itself on a page whose
 * whole job is what the athlete wrote.
 *
 * ## Why the whole pill is the target
 *
 * A separate "Undo" button inside a message is the desktop shape. This is read
 * mid-workout, one-handed, and often with the keyboard still up, so the pill is
 * one 44 pt-plus target that says what it does. Tapping it is the only thing it
 * does — there is no dismiss control, because the window closing IS the
 * dismissal and a second tappable region in a 6-second overlay is a mis-tap
 * waiting to happen.
 *
 * ## Tone
 *
 * "Deleted “Bench press”" — the record's dry voice, past tense, no apology and
 * no reassurance. The design skill's §Tone allows warmth in onboarding and
 * empty states; this sits on the ledger, which is the dry half.
 */
/**
 * How long the offer stands. Apple's own undo toasts sit for about five
 * seconds; six, because this one is read between sets rather than at a desk,
 * and because the alternative to noticing it in time is a lost record.
 */
export const UNDO_WINDOW_MS = 6_000;

/**
 * And how long it stands for VoiceOver. Six seconds is a glance for a sighted
 * user and not enough time to swipe to a control for someone who navigates by
 * focus — the offer would expire mid-gesture, which is the same as not offering
 * it. Twenty is the window the rest of the app's transient copy is read in.
 */
export const UNDO_WINDOW_SCREEN_READER_MS = 20_000;

export function UndoDelete({
  /** How far off the bottom of the screen to float — Today measures it from the
   * keyboard and the accessory row it has to clear. */
  bottom,
}: {
  bottom: number;
}) {
  const pending = useSession((s) => s.lastDelete);
  const undoDelete = useSession((s) => s.undoDelete);
  const clearUndo = useSession((s) => s.clearUndo);
  const reduce = useReducedMotion();

  // Resolved once and kept current: a person can turn VoiceOver on mid-session.
  const [screenReader, setScreenReader] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (alive) setScreenReader(on);
    });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const id = pending?.id ?? null;
  const label = pending?.label ?? null;
  const message = label ? `Deleted “${label}”` : 'Deleted that line';

  /**
   * THE WINDOW, keyed on `id` and not on the object.
   *
   * `lastDelete` is a fresh object on every delete, but two deletes of the same
   * line with the same words would be indistinguishable by value — and the
   * store's counter exists precisely so the second one restarts the clock
   * instead of inheriting whatever was left of the first one's.
   */
  const closed = useRef(false);
  useEffect(() => {
    if (id === null) return;
    closed.current = false;
    const window = screenReader ? UNDO_WINDOW_SCREEN_READER_MS : UNDO_WINDOW_MS;
    const t = setTimeout(() => {
      closed.current = true;
      clearUndo();
    }, window);
    return () => clearTimeout(t);
  }, [id, screenReader, clearUndo]);

  /**
   * SAY IT OUT LOUD, because the pill is the only report that the delete
   * happened AND the only way back from it. A VoiceOver user whose focus is on
   * the ledger gets neither from a silent overlay.
   */
  useEffect(() => {
    if (id === null) return;
    AccessibilityInfo.announceForAccessibility(`${message}. Undo is available.`);
    // The message is derived from the same id; re-announcing on its identity
    // alone would repeat the sentence on every unrelated re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /**
   * THE WRAPPER STAYS MOUNTED and only the pill comes and goes, so Reanimated
   * has a live parent to play the exit out of. Returning `null` from the whole
   * component took the wrapper with it and the fade-out never ran — the pill
   * just vanished, which is the one thing an overlay reporting a deletion
   * should not also do. It is an empty absolutely-positioned box with
   * `box-none` the rest of the time, so it costs an untouched day nothing.
   */
  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      {!pending ? null : (
        <Animated.View
          // The pill is chrome arriving over live content, so it fades rather than
          // travels — nothing in the record moves to make room for it.
          entering={reduce ? undefined : FadeIn.duration(160)}
          exiting={reduce ? undefined : FadeOut.duration(160)}>
          <PressableScale
            onPress={() => {
              // A commit that changes the record, so the committed-action haptic,
              // the same one Delete itself fired.
              tapMedium();
              undoDelete();
            }}
            haptic="none"
            style={styles.pill}
            accessibilityRole="button"
            accessibilityLabel={`Undo. ${message}`}
            accessibilityHint="Puts the line back where it was">
            <Text style={styles.message} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {message}
            </Text>
            <Icon name="undo" size={moderateScale(15)} tint={color.brand} />
            <Text style={styles.action} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Undo
            </Text>
          </PressableScale>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Centred, unlike the status pill above the keyboard, which is anchored to
    // the composer it reports on. This reports on nothing that has a position.
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  /**
   * PAPER, NOT GLASS — and this one was measured, not chosen (11 Sep 2026).
   *
   * It was a `GlassPressable`, on the design skill's rule that floating chrome
   * is Liquid Glass. On the iOS 26.5 simulator the pill then rendered as **bare
   * text on the canvas**: mean RGB inside the shape came back 244,245,241
   * against a 245,245,239 canvas — no surface at all. The reason is the one
   * `bottom-toolbar.tsx` already writes down, *"glass needs something behind it
   * to refract or it is just a grey rectangle"*: this pill appears at the exact
   * moment the page it floats over has just lost the entry it was showing, so
   * what is behind it is very often flat empty canvas.
   *
   * Glass is right for the chrome the skill lists, because every one of those
   * sits over content that moves. A six-second control the athlete has to FIND
   * may not be the one that disappears when the page is empty, so it takes the
   * other half of the same vocabulary — the floating white pill with the soft
   * warm shadow — which is exactly what `glass.tsx` itself falls back to.
   */
  pill: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    // Comfortably past the 44 pt floor even before the text's own line height,
    // because this is a transient target read at arm's length.
    minHeight: moderateScale(46),
    paddingHorizontal: spacing.lg,
    backgroundColor: color.surface,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: color.border,
    ...shadow.card,
  },
  message: {
    ...readingStyle('400'),
    fontSize: moderateScale(13),
    color: color.textSecondary,
    flexShrink: 1,
  },
  action: {
    // `headline` is the app's button-label token (17/600) — the action keeps the
    // scale's own step, and only the message beside it takes the reading face
    // the status pill above the keyboard already speaks in.
    ...type.headline,
    color: color.brand,
  },
});
