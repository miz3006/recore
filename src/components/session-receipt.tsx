import { useEffect } from 'react';
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
import { alpha, color, fonts, MAX_FONT_SCALE, moderateScale, radius, spacing, type } from '@/lib/theme';

import { signalText } from './gutter-value';

/**
 * Session receipt (CLAUDE.md §9): when a whole workout was typed in at once,
 * the per-line gutter is replaced by ONE summary under the note — what the
 * app understood and what it means. Same voice as the gutter, relocated:
 * exercise · top set in mono at 45% · comparison at 70% — the PR pill is the
 * only thing at full white. One AI line at most, with the thin white left
 * border ("the app spoke"). Rows settle top-to-bottom with the same quiet
 * sweep the gutter uses; a first-time exercise gets SILENCE in the signal
 * column, not a label.
 *
 * Tap a row → exercise history. Long-press → fix the parse (§6.2).
 */
const ECHO_OPACITY = 0.45;
const SIGNAL_OPACITY = 0.7;
const STAGGER_MS = 45;
const SETTLE_MS = 260;
const SETTLE_SHIFT = 4;
const PR_OVERSHOOT = 1.12;
const PR_FROM = 0.8;

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
              <Text style={styles.signal} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
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
  onExercise: (canonical: string) => void;
  onFix: (line: number) => void;
}) {
  if (data.rows.length === 0) return null;

  return (
    <View style={[styles.wrap, stale && styles.stale]}>
      <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        SESSION
      </Text>

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

      <View style={styles.total}>
        <Text style={styles.totalLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          TOTAL
        </Text>
        <Text style={styles.totalValue} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {data.volume > 0 ? `${groupThousands(data.volume)} kg · ` : ''}
          {data.totalSets} sets
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
    marginTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    paddingTop: spacing.md,
  },
  stale: {
    opacity: 0.5,
  },
  label: {
    fontSize: type.caption.fontSize,
    letterSpacing: 1.2,
    color: color.textMuted,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
    paddingVertical: spacing.sm + 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(color.accent, 0.06),
    borderRadius: radius.sm,
  },
  rowPressed: {
    backgroundColor: color.surfaceHigh,
  },
  name: {
    flex: 1,
    fontSize: type.subhead.fontSize,
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
    color: color.textPrimary,
    opacity: SIGNAL_OPACITY,
  },
  prPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1.5,
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
  total: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    marginTop: spacing.xs,
    paddingTop: spacing.md,
  },
  totalLabel: {
    fontSize: type.caption.fontSize,
    letterSpacing: 1.2,
    color: color.textMuted,
    fontWeight: '500',
  },
  totalValue: {
    fontFamily: fonts.mono,
    fontSize: type.caption.fontSize,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: color.textPrimary,
  },
  aiLine: {
    marginTop: spacing.lg,
    paddingLeft: spacing.md,
    borderLeftWidth: 1.5,
    borderLeftColor: alpha(color.accent, 0.7),
  },
  aiText: {
    ...type.caption,
    color: color.textSecondary,
  },
});
