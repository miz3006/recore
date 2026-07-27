import { useEffect, useMemo, useRef, useState } from 'react';
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

import { getWorkoutById } from '@/lib/db/workouts';
import { tap } from '@/lib/haptics';
import { groupThousands } from '@/lib/parse/estimate';
import { namesMatch, typedNameOf, type ReceiptData, type ReceiptRow } from '@/lib/parse/receipt';
import { formatDistanceTotal } from '@/lib/parse/summarize';
import { type GutterSignal, type LineSignal } from '@/lib/parse/types';
import { color, fonts, HIT, MAX_FONT_SCALE, moderateScale, radius, spacing, type } from '@/lib/theme';
import { useSession } from '@/state/session-store';

import { MonoTag, PrLabel, readingText } from './gutter-value';

/**
 * The RECORDED receipt (design frames 08/09) — the settled ledger under the
 * note. Archival, never celebratory: a bordered mono RECORDED tag with quiet
 * meta ("finished 18:59 · 55 min"), then a table of resolved names (with the
 * user's own words echoed beside them when the parser corrected), mono values
 * on the right and a MUTED mono comparison subline ("+2.5 kg vs last",
 * "same as last", "first recorded") — comparisons are `textMuted`, never
 * lime. PR is the neutral outlined label next to the name. Prose lines are
 * quoted verbatim with "saved, not counted". The total row above a tableRule
 * border gives the session its ending.
 *
 * Rows settle top-to-bottom with the same quiet sweep the gutter uses. Tap a
 * row → exercise history. Long-press → fix the parse (§6.2).
 */
const STAGGER_MS = 45;
const SETTLE_MS = 260;
const SETTLE_SHIFT = 4;
const PR_OVERSHOOT = 1.12;
const PR_FROM = 0.8;

/** The labor-illusion header (research: visible work reads as intelligence).
 * Two quiet mono stages while the parse is in flight — never a spinner,
 * never lime. */
const READING_STAGES = ['reading your log', 'matching exercises'];
const READING_STAGE_MS = 700;

const pad2 = (n: number) => String(n).padStart(2, '0');

function ReadingLabel() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStage((s) => (s + 1) % READING_STAGES.length), READING_STAGE_MS);
    return () => clearInterval(t);
  }, []);
  return (
    <Text style={styles.headerMeta} maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {READING_STAGES[stage]}…
    </Text>
  );
}

const KG_DELTA_RE = /^[+-]\d+(?:\.\d+)?$/;

/** The archival comparison subline — the muted second voice of a row.
 * A bare weight delta ("+2.5") gains its unit; rep/distance/duration deltas
 * already carry theirs. `firstSeen` = this line parsed as a first-time echo. */
function comparisonOf(signal: GutterSignal | null, firstSeen: boolean): string | null {
  if (!signal) return firstSeen ? 'first recorded' : null;
  switch (signal.kind) {
    case 'up':
    case 'down': {
      const delta = KG_DELTA_RE.test(signal.delta) ? `${signal.delta} kg` : signal.delta;
      return `${delta} vs last`;
    }
    case 'equal':
      return 'same as last';
    case 'pr':
      return 'personal record';
    case 'set':
      return null; // echoes never reach a receipt row's signal
  }
}

function Row({
  row,
  typed,
  comparison,
  order,
  revision,
  onExercise,
  onFix,
}: {
  row: ReceiptRow;
  /** What the user actually wrote, when it materially differs from the
   * resolved name ("potisk s prsi") — echoed quietly beside the canonical
   * name so the reading stays auditable (long-press still opens FixSheet). */
  typed: string | null;
  /** The muted archival subline ("+2.5 kg vs last" · "first recorded"). */
  comparison: string | null;
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
        style={({ pressed }) => [
          styles.row,
          order === 0 && styles.rowFirst,
          pressed && styles.rowPressed,
        ]}
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
            {typed ? <Text style={styles.alias}>{`  · “${typed}”`}</Text> : null}
          </Text>
          {isPr ? (
            <Animated.View style={prStyle}>
              <PrLabel />
            </Animated.View>
          ) : null}
        </View>
        <View style={styles.valueCell}>
          <Text style={styles.value} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {readingText(row.setText, ' × ')}
          </Text>
          {comparison ? (
            <Text style={styles.compare} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {comparison}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function SessionReceipt({
  data,
  noteLines = [],
  signals = [],
  reason,
  revision,
  stale,
  parsing = false,
  onExercise,
  onFix,
}: {
  data: ReceiptData;
  /** The raw note split by line — lets each row show what the user actually
   * typed, and surfaces unparsed prose as "saved, not counted". */
  noteLines?: string[];
  /** Per-line gutter signals — a 'set' echo marks a first-time exercise so
   * its subline can honestly say "first recorded". */
  signals?: LineSignal[];
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
  const workoutId = useSession((s) => s.workoutId);
  // The share capture briefly renders the Recore mark inside the card — the
  // image carries the brand, the in-app card stays quiet.
  const [branding, setBranding] = useState(false);

  // "finished 18:59 · 55 min" from the workout row's own timestamps: the last
  // write is the finish, the first is the start. A span too short or too long
  // to be a session drops the duration and keeps the honest finish time. `mins`
  // is exposed separately so the summary card can print it as its own column.
  const meta = useMemo(() => {
    if (!workoutId) return { label: null as string | null, mins: null as number | null };
    const w = getWorkoutById(workoutId);
    if (!w) return { label: null, mins: null };
    const finished = new Date(w.updated_at);
    const rawMins = Math.round((finished.getTime() - new Date(w.created_at).getTime()) / 60_000);
    const mins = rawMins >= 10 && rawMins <= 360 ? rawMins : null;
    const time = `finished ${pad2(finished.getHours())}:${pad2(finished.getMinutes())}`;
    return { label: mins !== null ? `${time} · ${mins} min` : time, mins };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId, revision, parsing]);

  if (data.rows.length === 0) return null;

  const exercises = new Set(data.rows.map((r) => r.exercise)).size;

  // "potisk s prsi" → "Machine Chest Press" is worth an echo beside the name;
  // a plain shorthand that reads as the same words stays unmarked.
  const typedFor = (row: ReceiptRow): string | null => {
    const t = typedNameOf(noteLines[row.line] ?? '');
    return t.length >= 3 && !namesMatch(t, row.exercise) ? t : null;
  };

  // First-time exercises carry a quiet 'set' echo in the gutter — the receipt
  // translates that silence into the archival "first recorded".
  const firstSeenLines = new Set(
    signals.filter((s) => s.signal.kind === 'set').map((s) => s.line),
  );

  // Unparsed prose stays part of the record: quoted verbatim, never counted.
  const rowLines = new Set(data.rows.map((r) => r.line));
  const prose = noteLines
    .map((text, line) => ({ text: text.trim(), line }))
    .filter(({ text, line }) => text.length >= 3 && !rowLines.has(line));

  // The summary card's columns (frame 05): counted sets, tonnage-or-distance,
  // and minutes when the session span was plausibly a real workout. Every
  // figure is drawn straight from the settled receipt / workout row — never
  // estimated.
  const statItems: { n: string; label: string }[] = [
    { n: String(data.totalSets), label: data.totalSets === 1 ? 'working set' : 'working sets' },
    data.volume > 0
      ? { n: groupThousands(data.volume), label: 'kg volume' }
      : data.distanceM > 0
        ? { n: formatDistanceTotal(data.distanceM), label: 'distance' }
        : { n: '0', label: 'kg volume' },
  ];
  if (meta.mins !== null) statItems.push({ n: String(meta.mins), label: 'minutes' });

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
        <MonoTag label="RECORDED" />
        {parsing ? (
          <ReadingLabel />
        ) : (
          <Text style={styles.headerMeta} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {meta.label ?? `${exercises} ${exercises === 1 ? 'exercise' : 'exercises'}`}
          </Text>
        )}
      </View>

      {/* The summary card (frame 05): the session's totals as mono columns —
          the record's ending, up top where it settles first. */}
      <View style={styles.statCard}>
        {statItems.map((s, i) => (
          <View key={s.label} style={[styles.statCol, i > 0 && styles.statColRest]}>
            <Text style={styles.statNum} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {s.n}
            </Text>
            <Text style={styles.statLabel} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {s.label}
            </Text>
          </View>
        ))}
      </View>

      {data.rows.map((row, i) => (
        <Row
          key={`${row.line}:${row.exercise}`}
          row={row}
          typed={typedFor(row)}
          comparison={comparisonOf(row.signal, firstSeenLines.has(row.line))}
          order={i}
          revision={revision}
          onExercise={onExercise}
          onFix={onFix}
        />
      ))}

      {prose.map(({ text, line }) => (
        <View key={`prose:${line}`} style={styles.proseRow}>
          <Text style={styles.proseText} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            “{text}”
          </Text>
          <Text style={styles.proseMeta} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            saved, not counted
          </Text>
        </View>
      ))}

      {reason ? (
        <View style={styles.aiCard}>
          <Text style={styles.aiText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {reason}
          </Text>
        </View>
      ) : null}

      {!stale && !parsing && !branding ? (
        <Pressable
          onPress={() => void handleShare()}
          style={({ pressed }) => [styles.shareBtn, pressed && styles.shareBtnPressed]}>
          <Text style={styles.shareLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Share card
          </Text>
        </Pressable>
      ) : null}

      {branding ? (
        <Text style={styles.brand} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Recore
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // The receipt is a table ON the canvas (frames 08/09), not a floating box:
  // no outer border/radius (minimalism pass) — the RECORDED tag and the
  // tableRule hairlines give it all the structure it needs. The solid bg fill
  // stays: it's what the share-card PNG capture renders against, and it lets
  // the hairlines read.
  wrap: {
    marginTop: spacing.xl,
    backgroundColor: color.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  stale: {
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  headerMeta: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(10.5),
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
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
    borderTopWidth: 1,
    borderTopColor: color.tableRule,
  },
  rowFirst: {
    borderTopWidth: 0,
  },
  rowPressed: {
    backgroundColor: color.surfaceHigh,
  },
  nameCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    flexShrink: 1,
    fontSize: moderateScale(14.5),
    fontWeight: '400',
    color: color.textPrimary,
  },
  alias: {
    fontSize: moderateScale(11.5),
    color: color.textMuted,
  },
  valueCell: {
    alignItems: 'flex-end',
  },
  value: {
    fontFamily: fonts.mono,
    fontSize: type.caption.fontSize,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: color.textPrimary,
  },
  compare: {
    marginTop: 2,
    fontFamily: fonts.mono,
    fontSize: moderateScale(10.5),
    fontVariant: ['tabular-nums'],
    color: color.textMuted,
  },
  proseRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  proseText: {
    flex: 1,
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
  },
  proseMeta: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(10.5),
    color: color.textMuted,
  },
  // The summary card — a raised paper block of mono stat columns (frame 05).
  statCard: {
    flexDirection: 'row',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCol: {
    flex: 1,
  },
  statColRest: {
    paddingLeft: spacing.md,
  },
  statNum: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(22),
    fontWeight: '600',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
    color: color.textPrimary,
  },
  statLabel: {
    fontSize: moderateScale(12),
    color: color.textSecondary,
    marginTop: 3,
  },
  // The one AI line — the next-session affordance, as a quiet bordered card.
  aiCard: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  aiText: {
    ...type.caption,
    color: color.textSecondary,
  },
  shareBtn: {
    marginTop: spacing.md,
    height: HIT,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnPressed: {
    backgroundColor: color.surfaceHigh,
  },
  shareLabel: {
    color: color.textPrimary,
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
});
