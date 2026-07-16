import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { type GutterSignal } from '@/lib/parse/types';
import { alpha, color, fonts, MAX_FONT_SCALE, moderateScale, radius, spacing } from '@/lib/theme';

import { NOTE_FONT_SIZE, NOTE_LINE_HEIGHT } from './note-metrics';

/**
 * The parsed value in the RIGHT GUTTER of a line (CLAUDE.md §5, §8).
 *
 * Same white as the user's text, separated by TEXTURE and PLACE, not hue —
 * muted monospace, right-aligned, sharing the note's baseline grid. Hierarchy
 * is pure opacity: the top-set ECHO ("80 ×8") sits quietest at 45%, a
 * comparison signal (↑ ↓ =) at 70%, a PR at 100% inside a hairline white pill.
 *
 * THE PARSE SWEEP (CLAUDE.md §9): when a parse result lands, values settle in
 * top-to-bottom — each one fades in and slides 4px from the right with a small
 * stagger per line — so the analysis visibly walks down the page. `order` is
 * the value's rank in that cascade and `revision` identifies the parse pass;
 * a new revision replays the sweep. Under reduceMotion the structure appears
 * instantly, no sweep.
 */
const ECHO_OPACITY = 0.45;
const SIGNAL_OPACITY = 0.7;
const PR_OPACITY = 1;
const STAGGER_MS = 45;
const SETTLE_MS = 260;
const SETTLE_SHIFT = 4;
// The ONE bouncy moment in the whole app (CLAUDE.md §9): the PR pill lands
// with a single small overshoot. Everything else settles without spring.
const PR_OVERSHOOT = 1.12;
const PR_FROM = 0.8;

export function signalText(signal: GutterSignal): string {
  switch (signal.kind) {
    case 'up':
      return `↑ ${signal.delta}`;
    case 'down':
      return `↓ ${signal.delta}`;
    case 'equal':
      return '= same';
    case 'pr':
      return 'PR';
    case 'set':
      return signal.text;
  }
}

function targetOpacity(signal: GutterSignal): number {
  switch (signal.kind) {
    case 'pr':
      return PR_OPACITY;
    case 'set':
      return ECHO_OPACITY;
    default:
      return SIGNAL_OPACITY;
  }
}

export function GutterValue({
  signal,
  rowHeight,
  order = 0,
  revision = '',
}: {
  signal: GutterSignal | null;
  rowHeight: number;
  /** Rank within the parse sweep — drives the per-line stagger. */
  order?: number;
  /** Identity of the parse pass — a new revision replays the sweep. */
  revision?: string;
}) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const shift = useSharedValue(0);
  const scale = useSharedValue(1);

  // Replay only when the parse pass or this line's content actually changes —
  // never on unrelated keystrokes.
  const signature = signal ? `${revision}:${signalText(signal)}` : '';

  useEffect(() => {
    if (!signature || !signal) {
      opacity.value = 0;
      return;
    }
    const target = targetOpacity(signal);
    if (reduceMotion) {
      opacity.value = target;
      shift.value = 0;
      scale.value = 1;
      return;
    }
    const delay = order * STAGGER_MS;
    opacity.value = 0;
    shift.value = SETTLE_SHIFT;
    opacity.value = withDelay(
      delay,
      withTiming(target, { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) }),
    );
    shift.value = withDelay(
      delay,
      withTiming(0, { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) }),
    );
    if (signal.kind === 'pr') {
      scale.value = PR_FROM;
      scale.value = withDelay(
        delay,
        withSequence(
          withTiming(PR_OVERSHOOT, { duration: SETTLE_MS * 0.7, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: SETTLE_MS * 0.45, easing: Easing.inOut(Easing.ease) }),
        ),
      );
    } else {
      scale.value = 1;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, reduceMotion, order]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: shift.value }, { scale: scale.value }],
  }));

  // Occupy exactly the FIRST row of the line so the value stays pinned there
  // even when the left text wraps to more rows.
  if (!signal) return <View style={{ height: rowHeight }} />;

  return (
    <Animated.View style={[{ height: rowHeight }, styles.row, animatedStyle]}>
      {signal.kind === 'pr' ? (
        <View style={styles.prPill}>
          <Text style={styles.prText} allowFontScaling maxFontSizeMultiplier={MAX_FONT_SCALE}>
            PR
          </Text>
        </View>
      ) : (
        <Text
          style={styles.signal}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          allowFontScaling
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {signalText(signal)}
        </Text>
      )}
    </Animated.View>
  );
}

/**
 * The "analyzing" state: while a parse is in flight, each pending line shows a
 * three-dot wave — the universal "thinking" indicator — in the SAME place its
 * result will land. Dots light up one after another (0.25 → 0.8 opacity, still
 * pure white), so the working state is unmistakable without a spinner, a
 * toast, or a word. Under reduceMotion the dots hold still, mid-bright.
 */
const PENDING_DOT = 4.5;
const PENDING_MIN = 0.25;
const PENDING_MAX = 0.8;
export const PENDING_STEP_MS = 160;

export function PendingDot({ delay }: { delay: number }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(PENDING_MIN);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 0.45;
      return;
    }
    opacity.value = PENDING_MIN;
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(PENDING_MAX, { duration: 420, easing: Easing.inOut(Easing.ease) }),
        -1,
        true, // wave back down
      ),
    );
  }, [reduceMotion, delay, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.pendingDot, animatedStyle]} />;
}

export function GutterPending({ rowHeight }: { rowHeight: number }) {
  return (
    <View style={[{ height: rowHeight }, styles.row]}>
      <View style={styles.pendingRow}>
        <PendingDot delay={0} />
        <PendingDot delay={PENDING_STEP_MS} />
        <PendingDot delay={PENDING_STEP_MS * 2} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  signal: {
    fontFamily: fonts.mono,
    fontSize: NOTE_FONT_SIZE, // same size as the left text → matched cap height + baseline
    lineHeight: NOTE_LINE_HEIGHT,
    fontWeight: '500',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
    color: color.textPrimary,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PENDING_DOT,
    height: NOTE_LINE_HEIGHT,
  },
  pendingDot: {
    width: PENDING_DOT,
    height: PENDING_DOT,
    borderRadius: PENDING_DOT / 2,
    backgroundColor: color.textPrimary,
  },
  prPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(color.accent, 0.5),
  },
  prText: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(11),
    fontWeight: '500',
    letterSpacing: 1,
    color: color.textPrimary,
  },
});
