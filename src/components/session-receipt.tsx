import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { tap } from '@/lib/haptics';
import { groupThousands } from '@/lib/parse/estimate';
import { type ReceiptData, type ReceiptRow } from '@/lib/parse/receipt';
import { alpha, color, fonts, ink, MAX_FONT_SCALE, moderateScale, radius, spacing, type } from '@/lib/theme';

import { signalText, signalTint } from './gutter-value';

/**
 * The session ledger (CLAUDE.md §9) — the proof that the machine read the
 * note. For EVERY parsed session (not just the end-of-training dump) one card
 * settles under the text: resolved exercise names, top sets in mono, the
 * comparison vs last time — progress in the machine's volt ink — and a total
 * row that gives the workout an ending. This is where the AI's understanding
 * becomes impossible to miss: the user's messy paragraph above, the clean
 * structure below.
 *
 * Rows settle top-to-bottom with the same quiet sweep the gutter uses; a
 * first-time exercise gets SILENCE in the signal column, not a label. Tap a
 * row → exercise history. Long-press → fix the parse (§6.2).
 */
const ECHO_OPACITY = ink.value;
const STAGGER_MS = 45;
const SETTLE_MS = 260;
const SETTLE_SHIFT = 4;
const PR_OVERSHOOT = 1.12;
const PR_FROM = 0.8;

/** The labor-illusion header (research: visible work reads as intelligence).
 * Two quiet stages while the parse is in flight — never a spinner. */
const READING_STAGES = ['READING YOUR LOG', 'MATCHING EXERCISES'];
const READING_STAGE_MS = 700;

function ReadingLabel() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStage((s) => (s + 1) % READING_STAGES.length), READING_STAGE_MS);
    return () => clearInterval(t);
  }, []);
  return (
    <Text style={[styles.label, styles.labelReading]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {READING_STAGES[stage]}…
    </Text>
  );
}

function Row({
  row,
  order,
  revision,
  onExercise,
  onFix,
}: {
  row: ReceiptRow;
  order: number;
  revision: string;
  onExercise: (canonical: string) => void;
  onFix: (line: number) => void;
}) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const shift = useSharedValue(0);
  const scale = useSharedValue(1);

  const isPr = row.signal?.kind === 'pr';
  const signature = `${revision}:${row.exercise}:${row.setText}`;

  useEffect(() => {
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
    if (isPr) {
      // The ONE bouncy moment in the app (CLAUDE.md §9) stays with the PR.
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
    transform: [{ translateX: shift.value }],
  }));
  const prStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => {
          tap();
          onExercise(row.exercise);
        }}
        onLongPress={() => {
          tap();
          onFix(row.line);
        }}>
        <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {row.exercise}
        </Text>
        <Text style={styles.set} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {row.setText}
        </Text>
        {row.signal ? (
          isPr ? (
            <Animated.View style={[styles.sigCell, prStyle]}>
              <View style={styles.prPill}>
                <Text style={styles.prText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  PR
                </Text>
              </View>
            </Animated.View>
          ) : (
            <View style={styles.sigCell}>
              <Text
                style={[styles.signal, { color: signalTint(row.signal) }]}
                numberOfLines={1}
                maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {signalText(row.signal)}
              </Text>
            </View>
          )
        ) : (
          <View style={styles.sigCell} />
        )}
      </Pressable>
    </Animated.View>
  );
}

export function SessionReceipt({
  data,
  reason,
  revision,
  stale,
  parsing = false,
  onExercise,
  onFix,
}: {
  data: ReceiptData;
  /** The ONE line the AI may say (next-session reason). Null = silence. */
  reason: string | null;
  /** Identity of the parse pass — a new revision replays the settle sweep. */
  revision: string;
  /** The note changed since this was computed — recede until re-parsed. */
  stale: boolean;
  /** A parse is in flight — the header shows the staged reading label. */
  parsing?: boolean;
  onExercise: (canonical: string) => void;
  onFix: (line: number) => void;
}) {
  if (data.rows.length === 0) return null;

  const exercises = new Set(data.rows.map((r) => r.exercise)).size;

  return (
    <View style={[styles.wrap, stale && styles.stale]}>
      <View style={styles.header}>
        {parsing ? (
          <ReadingLabel />
        ) : (
          <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            SESSION
          </Text>
        )}
        <Text style={styles.headerMeta} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {exercises} {exercises === 1 ? 'exercise' : 'exercises'}
        </Text>
      </View>

      {data.rows.map((row, i) => (
        <Row
          key={`${row.line}:${row.exercise}`}
          row={row}
          order={i}
          revision={revision}
          onExercise={onExercise}
          onFix={onFix}
        />
      ))}

      {/* The total gives every session an ending — the receipt's hero line. */}
      <View style={styles.total}>
        <Text style={styles.totalValue} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {data.volume > 0 ? groupThousands(data.volume) : String(data.totalSets)}
          <Text style={styles.totalUnit}>{data.volume > 0 ? ' kg' : ' sets'}</Text>
        </Text>
        <Text style={styles.totalMeta} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {data.volume > 0 ? `${data.totalSets} sets` : 'total'}
        </Text>
      </View>

      {reason ? (
        <View style={styles.aiLine}>
          <Text style={styles.aiText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {reason}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.xl,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(color.accent, ink.hairline),
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  stale: {
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: type.caption.fontSize,
    letterSpacing: 1.2,
    color: color.textMuted,
    fontWeight: '500',
  },
  // The machine at work speaks in its own ink.
  labelReading: {
    color: color.signal,
  },
  headerMeta: {
    fontSize: type.caption.fontSize,
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
    paddingVertical: spacing.sm + 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(color.accent, ink.divider),
    borderRadius: radius.sm,
  },
  rowPressed: {
    backgroundColor: color.surfaceHigh,
  },
  name: {
    flex: 1,
    fontSize: type.subhead.fontSize,
    fontWeight: '500',
    color: color.textPrimary,
  },
  set: {
    fontFamily: fonts.mono,
    fontSize: type.caption.fontSize,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: color.textPrimary,
    opacity: ECHO_OPACITY,
  },
  sigCell: {
    minWidth: moderateScale(58),
    alignItems: 'flex-end',
  },
  signal: {
    fontFamily: fonts.mono,
    fontSize: type.caption.fontSize,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    opacity: ink.delta,
  },
  prPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1.5,
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
  total: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    marginTop: spacing.xs,
    paddingTop: spacing.md,
  },
  totalValue: {
    ...type.statNumber,
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  totalUnit: {
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
    color: color.textSecondary,
  },
  totalMeta: {
    fontSize: type.caption.fontSize,
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  aiLine: {
    marginTop: spacing.md,
    paddingLeft: spacing.md,
    borderLeftWidth: 1.5,
    borderLeftColor: alpha(color.signal, 0.7),
  },
  aiText: {
    ...type.caption,
    color: color.textSecondary,
  },
});
