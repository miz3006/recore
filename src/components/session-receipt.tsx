import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
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
import { namesMatch, typedNameOf, type ReceiptData, type ReceiptRow } from '@/lib/parse/receipt';
import { formatDistanceTotal } from '@/lib/parse/summarize';

import { Icon } from './icon';
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
  typed,
  order,
  revision,
  onExercise,
  onFix,
}: {
  row: ReceiptRow;
  /** What the user actually wrote, when it materially differs from the
   * resolved name ("tricpes") — rendered as a quiet ✓-marked correction so
   * the auto-fix is visible and reviewable (long-press still opens FixSheet). */
  typed: string | null;
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
        <View style={styles.nameCell}>
          <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {row.exercise}
          </Text>
          {typed ? (
            <Text style={styles.fixedNote} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              <Text style={styles.fixedTick}>✓ </Text>
              {`“${typed}”`}
            </Text>
          ) : null}
        </View>
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
  noteLines = [],
  reason,
  revision,
  stale,
  parsing = false,
  onExercise,
  onFix,
}: {
  data: ReceiptData;
  /** The raw note split by line — lets each row show what the user actually
   * typed when the parser corrected it. */
  noteLines?: string[];
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
  const cardRef = useRef<View>(null);
  // The share capture briefly renders the Recore mark inside the card — the
  // image carries the brand, the in-app card stays quiet.
  const [branding, setBranding] = useState(false);

  if (data.rows.length === 0) return null;

  const exercises = new Set(data.rows.map((r) => r.exercise)).size;

  // "tricpes" → "Triceps Pushdown" is a real fix, worth a visible mark; a
  // plain shorthand that reads as the same words stays unmarked.
  const typedFor = (row: ReceiptRow): string | null => {
    const t = typedNameOf(noteLines[row.line] ?? '');
    return t.length >= 3 && !namesMatch(t, row.exercise) ? t : null;
  };

  // The organic-growth artifact (CLAUDE.md §11): the receipt as a dark PNG.
  const handleShare = async () => {
    tap();
    setBranding(true);
    await new Promise((r) => setTimeout(r, 80)); // let the brand row paint
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      // view-shot returns file:// on Android but a bare path on iOS.
      const url = uri.startsWith('file://') ? uri : `file://${uri}`;
      await Sharing.shareAsync(url, { mimeType: 'image/png', UTI: 'public.png' });
    } catch {
      // sharing is a bonus, never an error surface
    } finally {
      setBranding(false);
    }
  };

  return (
    <View ref={cardRef} collapsable={false} style={[styles.wrap, stale && styles.stale]}>
      <View style={styles.header}>
        {parsing ? (
          <ReadingLabel />
        ) : (
          <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            SESSION
          </Text>
        )}
        <View style={styles.headerRight}>
          <Text style={styles.headerMeta} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {exercises} {exercises === 1 ? 'exercise' : 'exercises'}
          </Text>
          {!stale && !parsing && !branding ? (
            <Pressable
              onPress={() => void handleShare()}
              hitSlop={spacing.sm}
              style={({ pressed }) => pressed && styles.sharePressed}>
              <Icon name="share" size={moderateScale(15)} tint={color.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {data.rows.map((row, i) => (
        <Row
          key={`${row.line}:${row.exercise}`}
          row={row}
          typed={typedFor(row)}
          order={i}
          revision={revision}
          onExercise={onExercise}
          onFix={onFix}
        />
      ))}

      {/* The total gives every session an ending — the receipt's hero line.
          kg leads; a run-only session totals in distance instead of 0 kg. */}
      <View style={styles.total}>
        <Text style={styles.totalValue} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {data.volume > 0 ? (
            <>
              {groupThousands(data.volume)}
              <Text style={styles.totalUnit}> kg</Text>
            </>
          ) : data.distanceM > 0 ? (
            formatDistanceTotal(data.distanceM)
          ) : (
            <>
              {String(data.totalSets)}
              <Text style={styles.totalUnit}> sets</Text>
            </>
          )}
        </Text>
        <Text style={styles.totalMeta} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {data.volume > 0
            ? `${data.totalSets} sets` +
              (data.distanceM > 0 ? ` · ${formatDistanceTotal(data.distanceM)}` : '')
            : data.distanceM > 0
              ? `${data.totalSets} ${data.totalSets === 1 ? 'set' : 'sets'}`
              : 'total'}
        </Text>
      </View>

      {branding ? (
        <Text style={styles.brand} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Recore
        </Text>
      ) : null}

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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerMeta: {
    fontSize: type.caption.fontSize,
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  sharePressed: {
    opacity: 0.5,
  },
  brand: {
    marginTop: spacing.md,
    textAlign: 'right',
    fontSize: type.caption.fontSize,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: color.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm + 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(color.accent, ink.divider),
    borderRadius: radius.sm,
  },
  rowPressed: {
    backgroundColor: color.surfaceHigh,
  },
  nameCell: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontSize: type.subhead.fontSize,
    fontWeight: '500',
    color: color.textPrimary,
  },
  fixedNote: {
    fontSize: type.caption.fontSize,
    color: color.textMuted,
  },
  fixedTick: {
    color: color.signal,
    fontWeight: '600',
  },
  set: {
    fontFamily: fonts.mono,
    fontSize: type.caption.fontSize,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: color.textPrimary,
    opacity: ECHO_OPACITY,
    marginTop: 1, // optical baseline vs the subhead name
  },
  sigCell: {
    minWidth: moderateScale(58),
    alignItems: 'flex-end',
    marginTop: 1,
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
