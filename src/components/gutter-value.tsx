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
import { color, fonts, MAX_FONT_SCALE, moderateScale } from '@/lib/theme';

import { NOTE_LINE_HEIGHT, READING_FONT_SIZE } from './note-metrics';

/**
 * The interpreted reading in the RIGHT GUTTER of a line (the record contract,
 * design frames 05–07).
 *
 * WRITTEN is the user's white ink; INTERPRETED is a quiet mono reading in
 * `textSecondary` ("80 kg · 5·5·5") — never a checkmark, never celebratory.
 * Comparisons recede a further step to `textMuted`, and a PR is a NEUTRAL
 * outlined mono label — lime belongs exclusively to planned prescriptions,
 * never to the gutter.
 *
 * THE PARSE SWEEP (CLAUDE.md §9): when a parse result lands, values settle in
 * top-to-bottom — each one fades in and slides 4px from the right with a small
 * stagger per line — so the analysis visibly walks down the page. `order` is
 * the value's rank in that cascade and `revision` identifies the parse pass;
 * a new revision replays the sweep. Under reduceMotion the structure appears
 * instantly, no sweep.
 */
const STAGGER_MS = 45;
const SETTLE_MS = 260;
const SETTLE_SHIFT = 4;
// The ONE bouncy moment in the whole app (CLAUDE.md §9): the PR label lands
// with a single small overshoot. Everything else settles without spring.
const PR_OVERSHOOT = 1.12;
const PR_FROM = 0.8;

/** Tag/label geometry from the design brief: radius 4, padding 2×5. */
const TAG_RADIUS = 4;
const TAG_PAD_H = 5;
const TAG_PAD_V = 2;

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

const ECHO_RE = /^(\d+)×(\d+)(?:\s+(\d+(?:\.\d+)?))?$/;

/** "5·5·5" for up to three sets, the design's "12 ×4" beyond that. */
export function repScheme(count: number, reps: string): string {
  if (count >= 2 && count <= 3) return Array.from({ length: count }, () => reps).join('·');
  return count > 3 ? `${reps} ×${count}` : reps;
}

/**
 * Display transform for the interpreted reading (design frames 05–09):
 * "3×5 80" → "80 kg · 5·5·5", "4×12 10" → "10 kg · 12 ×4", bodyweight
 * "3×10" → "10·10·10". Cardio/hold echoes ("4× 20 m", "60 s") already read
 * as data and pass through untouched. Pure display text — the parse itself
 * is never altered.
 */
export function readingText(echo: string, joiner = ' · '): string {
  const m = ECHO_RE.exec(echo.trim());
  if (!m) return echo;
  const scheme = repScheme(Number(m[1]), m[2]!);
  return m[3] != null ? `${m[3]} kg${joiner}${scheme}` : scheme;
}

/**
 * The reading's ink: interpreted echoes speak in `textSecondary`, comparisons
 * recede to `textMuted`, the PR label carries full `textPrimary`. NO lime —
 * the machine never celebrates here (record contract).
 */
export function signalTint(signal: GutterSignal): string {
  switch (signal.kind) {
    case 'set':
      return color.textSecondary;
    case 'pr':
      return color.textPrimary;
    default:
      return color.textMuted;
  }
}

/**
 * The record-contract tag (design brief): bordered mono ~9px label —
 * PLANNED / RECORDED / LAST SESSION vocabulary. Never lime, never filled.
 */
export function MonoTag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Text>
    </View>
  );
}

/**
 * PR as a NEUTRAL outlined label (design frame 09): textPrimary ink and
 * border, radius 4. The achievement is stated, never celebrated with color —
 * no lime, no confetti, readable colorblind.
 *
 * `animate` opts the label into THE one sanctioned overshoot in the app
 * (CLAUDE.md §14): a single small scale bounce as it lands, reduceMotion-gated
 * to an instant appearance. The composer card sets it so a PR is *felt* at the
 * instant of logging; the gutter leaves it off (there the whole row already
 * animates the scale), keeping exactly one overshoot per PR.
 */
export function PrLabel({ animate = false }: { animate?: boolean }) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(animate && !reduceMotion ? PR_FROM : 1);

  useEffect(() => {
    if (!animate || reduceMotion) return;
    scale.value = PR_FROM;
    scale.value = withSequence(
      withTiming(PR_OVERSHOOT, { duration: 180, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 120, easing: Easing.inOut(Easing.ease) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, reduceMotion]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.prLabel, style]}>
      <Text style={styles.prLabelText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        PR
      </Text>
    </Animated.View>
  );
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
    if (reduceMotion) {
      opacity.value = 1;
      shift.value = 0;
      scale.value = 1;
      return;
    }
    const delay = order * STAGGER_MS;
    opacity.value = 0;
    shift.value = SETTLE_SHIFT;
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) }),
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
        <PrLabel />
      ) : (
        <Text
          style={[styles.signal, { color: signalTint(signal) }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          allowFontScaling
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {signal.kind === 'set' ? readingText(signal.text) : signalText(signal)}
        </Text>
      )}
    </Animated.View>
  );
}

/**
 * The "LAST TIME" hint — the most-quoted five-star feature in this category:
 * name an exercise (no numbers yet) and the gutter instantly shows last
 * session's top set, straight from local SQLite. It sits a full step quieter
 * than parse output (textMuted, not textSecondary) so it can't be mistaken
 * for a logged result, and vanishes the moment numbers appear on the line.
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
        {readingText(text)}
      </Text>
    </Animated.View>
  );
}

/**
 * The "analyzing" state: while a parse is in flight, each pending line shows a
 * three-dot wave — the universal "thinking" indicator — in the SAME place its
 * result will land. Dots light up one after another (0.25 → 0.8 opacity, in
 * the reading's quiet grey), so the working state is unmistakable without a
 * spinner, a toast, or a word. Under reduceMotion the dots hold still.
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
    fontSize: READING_FONT_SIZE, // a step below the written ink (frame 06)
    lineHeight: NOTE_LINE_HEIGHT, // shares the note's baseline grid
    fontWeight: '500',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
    color: color.textSecondary,
  },
  hint: {
    fontFamily: fonts.mono,
    fontSize: READING_FONT_SIZE,
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
    backgroundColor: color.textSecondary,
  },
  // No alignSelf: the tag centers in row headers and gets a row wrapper in
  // column layouts so the border always hugs the text.
  tag: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: TAG_RADIUS,
    paddingHorizontal: TAG_PAD_H,
    paddingVertical: TAG_PAD_V,
  },
  tagText: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(9),
    fontWeight: '500',
    letterSpacing: 1.2,
    color: color.textSecondary,
  },
  prLabel: {
    borderWidth: 1,
    borderColor: color.textPrimary,
    borderRadius: TAG_RADIUS,
    paddingHorizontal: TAG_PAD_H,
    paddingVertical: TAG_PAD_V,
  },
  prLabelText: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(9),
    fontWeight: '500',
    letterSpacing: 1,
    color: color.textPrimary,
  },
});
