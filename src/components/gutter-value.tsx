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
import { alpha, color, fonts, ink, MAX_FONT_SCALE, moderateScale, radius, spacing } from '@/lib/theme';

import { NOTE_FONT_SIZE, NOTE_LINE_HEIGHT } from './note-metrics';

/**
 * The parsed value in the RIGHT GUTTER of a line (CLAUDE.md §5, §8).
 *
 * TWO INKS: the user's text is white; the machine's voice is mono, and when it
 * has something to SAY — you went up, you set a PR — it says it in signal
 * volt. The first-time echo ("80 ×8") stays quiet white, comparisons speak at
 * ink.delta, and progress (↑ / PR) carries the accent. Hierarchy is opacity +
 * hue with one meaning: volt = you got stronger.
 *
 * THE PARSE SWEEP (CLAUDE.md §9): when a parse result lands, values settle in
 * top-to-bottom — each one fades in and slides 4px from the right with a small
 * stagger per line — so the analysis visibly walks down the page. `order` is
 * the value's rank in that cascade and `revision` identifies the parse pass;
 * a new revision replays the sweep. Under reduceMotion the structure appears
 * instantly, no sweep.
 */
const ECHO_OPACITY = ink.echo;
const SIGNAL_OPACITY = ink.delta;
const PR_OPACITY = ink.full;
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

/** Progress speaks in the machine's ink; everything else stays white. */
export function signalTint(signal: GutterSignal): string {
  return signal.kind === 'up' || signal.kind === 'pr' ? color.signal : color.textPrimary;
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
          style={[styles.signal, { color: signalTint(signal) }]}
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
 * The "LAST TIME" hint — the most-quoted five-star feature in this category:
 * name an exercise (no numbers yet) and the gutter instantly shows last
 * session's top set, straight from local SQLite. It sits a full step quieter
 * than parse output (textMuted, not white) so it can't be mistaken for a
 * logged result, and vanishes the moment numbers appear on the line.
 */
export function GutterHint({ text, rowHeight }: { text: string; rowHeight: number }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withTiming(1, { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[{ height: rowHeight }, styles.row, animatedStyle]}>
      <Text
        style={styles.hint}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        allowFontScaling
        maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {text}
      </Text>
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
  hint: {
    fontFamily: fonts.mono,
    fontSize: NOTE_FONT_SIZE,
    lineHeight: NOTE_LINE_HEIGHT,
    fontWeight: '400',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
    color: color.textMuted, // a memory, not a result
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
    borderColor: alpha(color.signal, ink.pill),
  },
  prText: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(11),
    fontWeight: '500',
    letterSpacing: 1,
    color: color.signal,
  },
});
