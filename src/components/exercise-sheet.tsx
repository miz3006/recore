import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { PressableScale, Stagger } from '@/components/motion';
import { Eyebrow } from '@/components/primitives';
import { getCachedBriefSummary, refineBriefSummary } from '@/lib/brief-explain';
import { type DayKey } from '@/lib/db/dates';
import { getExerciseStats, type ExerciseSession, type ExerciseStats } from '@/lib/db/exercise-stats';
import { findExerciseByName } from '@/lib/db/exercises';
import { getAllTimePRs, getE1rmSeries } from '@/lib/db/insights';
import { tap } from '@/lib/haptics';
import { liftProse, type LiftBrief } from '@/lib/lift-prose';
import {
  alpha,
  color,
  eyebrow,
  fonts,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  type,
} from '@/lib/theme';
import { groupThousands } from '@/lib/parse/estimate';
import { fmtNumber } from '@/lib/parse/summarize';
import { labelForDay, useSession } from '@/state/session-store';

import { BottomSheet } from './bottom-sheet';
import { stepPathD } from './charts';
import { glyphTint, Icon, type IconName } from './icon';

/**
 * Lift detail sheet (design frame 08 — "PR-first history"). Tap a gutter value
 * and this sheet answers "how strong am I on this lift, and how did I get
 * here?" — PR FIRST, then the settled session history.
 *
 * A chevron header + name pill, one selected chip for the exercise's real
 * modality, then, top to bottom (owner, 29 July, against a reference screen):
 *
 *   1. **two stat tiles** — sessions ever, best estimated 1RM;
 *   2. the **PR card** — neutral outlined label, the best working set as a big
 *      mono figure;
 *   3. the **PROGRESSION card** — metric chips over a STEP chart with its own
 *      axis readings, and **the one place in the app that carries ember**
 *      (§5.1, owner 29 Jul): the line and the wash under it;
 *   4. the **history table** — newest session first, each row a date (+ PR label
 *      the day it was set) with an archival comparison subline and a
 *      right-aligned mono "sets×reps · load";
 *   5. the **summary** — a composed paragraph over this lift's own loads
 *      (`lift-prose.ts`), optionally rephrased by the model under §8.5's guard.
 *
 * RECORDED work only — no green (that belongs to planned prescriptions), no
 * next weight (that lives on Today and Next), no chart theatre. The user's own
 * words for the lift sit in a quiet card; long-press for parse correction stays
 * the row's job elsewhere.
 */

/** How many PR rows to scan when marking this exercise's all-time best. */
const PR_SCAN = 400;

/** Human label for a lift's modality — the one real categorical attribute we
 * have (no equipment/variant data exists, so the frame's variant chips collapse
 * to a single honest chip). */
const MODALITY_LABEL: Record<string, string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  carry: 'Carry',
  hold: 'Hold',
};

/** The right-aligned mono reading for a session ("5×5 · 100 kg"). */
function sessionValue(s: ExerciseSession): string {
  if (s.topWeight != null) {
    return s.topReps != null
      ? `${s.setCount}×${s.topReps} · ${fmtNumber(s.topWeight)} kg`
      : `${s.setCount} × ${fmtNumber(s.topWeight)} kg`;
  }
  return s.topReps != null ? `${s.setCount}×${s.topReps}` : `${s.setCount} sets`;
}

/** The archival comparison subline (§9) — weight or rep delta vs the previous
 * session, "first recorded" for the oldest. Real data only; never a fabricated
 * reason. */
function sessionSubline(s: ExerciseSession, older: ExerciseSession | undefined): string | null {
  if (!older) return 'first recorded';
  if (s.topWeight != null && older.topWeight != null) {
    const d = s.topWeight - older.topWeight;
    if (d === 0) return `same load · ${labelForDay(older.day)}`;
    return `${d > 0 ? 'up' : 'down'} ${fmtNumber(Math.abs(d))} kg · ${labelForDay(older.day)}`;
  }
  if (s.topReps != null && older.topReps != null) {
    const d = s.topReps - older.topReps;
    if (d === 0) return `same reps · ${labelForDay(older.day)}`;
    return `${d > 0 ? 'up' : 'down'} ${Math.abs(d)} rep${Math.abs(d) === 1 ? '' : 's'} · ${labelForDay(older.day)}`;
  }
  return null;
}

interface ChartPoint {
  day: DayKey;
  value: number;
}

/** Left gutter reserved for the two axis readings. */
const AXIS_W = moderateScale(30);

/** The id the area gradient is referenced by. One chart is mounted at a time
 * (the sheet is a single modal), so a constant id cannot collide. */
const FILL_ID = 'liftTrendFill';

/**
 * Progression chart (Mobbin: Hevy's exercise chart + Tonal's dashed PR
 * reference). Plots ONE chosen metric — heaviest weight, estimated 1RM, or top
 * reps — over the last sessions.
 *
 * **It is a STEP, not a curve**, for the same reason the Progress tab's
 * `StepChart` is (§16.5, and they now share `stepPathD`): a weight holds for
 * however many sessions it holds, then jumps, and a diagonal between two
 * sessions draws loads nobody lifted.
 *
 * **Ember is the one hue here** (`color.trend`, owner 29 Jul): the step line
 * and the wash fading out under it. The wash is the *shape of the record*, not
 * a value — every number around it, including the current reading and the axis,
 * stays ink or muted grey. A single UNLABELED dashed hairline marks the
 * all-time best, folded into the domain so it is always on-screen — neutral,
 * never a second "PR" caption; the outlined mono label owns that word.
 *
 * Axis readings are the domain's own ends, drawn at the exact y they sit at, so
 * the numbers cannot drift from the line. All series are real data; under two
 * points it says so instead of a flat line.
 */
function ProgressionChart({
  points,
  prRef,
  unit,
  footNote,
}: {
  points: ChartPoint[];
  prRef: number | null;
  unit: string;
  footNote: string;
}) {
  const [w, setW] = useState(0);

  if (points.length < 2) {
    return (
      <Text style={styles.chartEmpty} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Log a couple of sessions to see your progression here.
      </Text>
    );
  }

  const H = moderateScale(150);
  const padR = moderateScale(2);
  const padT = moderateScale(14);
  const padB = moderateScale(12);
  const values = points.map((p) => p.value);
  // Fold the PR reference into the domain so its hairline never clips.
  const domain = prRef != null ? [...values, prRef] : values;
  const min = Math.min(...domain);
  const max = Math.max(...domain);
  const span = max - min;
  const plotW = Math.max(1, w - AXIS_W - padR);
  const plotH = H - padT - padB;
  // inset 10% top & bottom so the line never glues to the frame
  const yOf = (v: number) =>
    padT + plotH * 0.1 + (1 - (span > 0 ? (v - min) / span : 0.5)) * plotH * 0.8;
  const xOf = (i: number) => AXIS_W + (i / (points.length - 1)) * plotW;
  const lineD = stepPathD(values, xOf, yOf);
  // The wash closes the step path down to the baseline — same path, so the fill
  // can never disagree with the line it sits under.
  const baseY = H - padB;
  const areaD = `${lineD} L ${xOf(points.length - 1).toFixed(1)} ${baseY.toFixed(1)} L ${xOf(0).toFixed(
    1,
  )} ${baseY.toFixed(1)} Z`;

  const first = points[0]!;
  const mid = points[Math.floor((points.length - 1) / 2)]!;
  const last = points[points.length - 1]!;
  const prY = prRef != null ? yOf(prRef) : null;
  const halfLabel = moderateScale(7);

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartPlot} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0 ? (
          <>
            <Svg width={w} height={H}>
              <Defs>
                <LinearGradient id={FILL_ID} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={color.trend} stopOpacity={0.26} />
                  <Stop offset="1" stopColor={color.trend} stopOpacity={0.02} />
                </LinearGradient>
              </Defs>
              {/* All-time-best reference — one unlabeled neutral hairline. */}
              {prY != null ? (
                <Line
                  x1={AXIS_W}
                  y1={prY}
                  x2={w - padR}
                  y2={prY}
                  stroke={color.border}
                  strokeWidth={1}
                  strokeDasharray="3 4"
                />
              ) : null}
              <Path d={areaD} fill={`url(#${FILL_ID})`} />
              <Path
                d={lineD}
                fill="none"
                stroke={color.trend}
                strokeWidth={2}
                strokeLinejoin="miter"
                strokeLinecap="round"
              />
              <Circle
                cx={xOf(points.length - 1)}
                cy={yOf(last.value)}
                r={moderateScale(3.5)}
                fill={color.trend}
                stroke={color.surface}
                strokeWidth={1.5}
              />
            </Svg>
            {/* Axis readings, pinned to the exact y of the domain's ends. Only
                the top one when the record is flat — two labels on one line is
                a chart arguing with itself. */}
            <Text
              style={[styles.axisValue, { top: yOf(max) - halfLabel }]}
              numberOfLines={1}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {fmtNumber(max)}
            </Text>
            {span > 0 ? (
              <Text
                style={[styles.axisValue, { top: yOf(min) - halfLabel }]}
                numberOfLines={1}
                maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {fmtNumber(min)}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>
      <View style={styles.chartFoot}>
        <Text style={styles.chartDate} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {labelForDay(first.day)}
        </Text>
        {points.length > 2 ? (
          <Text style={styles.chartDateMid} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {labelForDay(mid.day)}
          </Text>
        ) : (
          <View style={styles.chartDateMid} />
        )}
        <Text style={[styles.chartDate, styles.chartDateRight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {labelForDay(last.day)}
        </Text>
      </View>
      <Text style={styles.chartNote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {unit ? `${footNote} · ${unit}` : footNote}
      </Text>
    </View>
  );
}

/**
 * One reading in the sheet's opening ledger row (owner, 29 Jul — the centred
 * two-tile version was rejected): a tinted glyph and its small mono label OVER
 * a left-aligned figure, three of them split by hairlines. Same shape as You's
 * record card, which is where the app already says "a big numeral over a small
 * caption" is what warmth is made of here (§16.4).
 *
 * The glyph is CHROME — §5.1's `glyph` palette, keyed by the glyph in
 * `icon.tsx`, so `plate` is the same gold it is on You. It is wayfinding and
 * never a claim: it sits beside the LABEL, never on the value, and the figure
 * itself stays ink. The label wraps rather than clipping at the Dynamic Type
 * ceiling (§5.3).
 */
function Stat({
  glyph,
  label,
  value,
  unit,
}: {
  glyph: IconName;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <View
      style={styles.statTile}
      accessible
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}>
      <View style={styles.statHead}>
        <Icon name={glyph} size={moderateScale(13)} tint={glyphTint(glyph)} />
        <Text style={styles.statLabel} numberOfLines={2}>
          {label.toUpperCase()}
        </Text>
      </View>
      <View style={styles.statFigureRow}>
        <Text
          style={styles.statFigure}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {value}
        </Text>
        {unit ? (
          <Text style={styles.statUnit} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

type ChartMetric = 'weight' | 'e1rm' | 'reps';

const METRIC_CHIP_LABEL: Record<ChartMetric, string> = {
  weight: 'Heaviest',
  e1rm: 'Est. 1RM',
  reps: 'Top Reps',
};

export function ExerciseSheet() {
  const insets = useSafeAreaInsets();
  const userId = useSession((s) => s.userId);
  const sheetExercise = useSession((s) => s.sheetExercise);
  const closeExerciseSheet = useSession((s) => s.closeExerciseSheet);

  const stats: ExerciseStats | null = useMemo(() => {
    if (!userId || !sheetExercise) return null;
    return getExerciseStats(userId, sheetExercise);
  }, [userId, sheetExercise]);

  // Real config + vocabulary only — never fabricated. The exercises row gives
  // the modality and plate step; the aliases the parser has actually seen.
  const exerciseRow = useMemo(() => {
    if (!userId || !stats) return null;
    return findExerciseByName(userId, stats.canonical);
  }, [userId, stats]);

  const aliases: string[] = useMemo(() => {
    if (!exerciseRow) return [];
    try {
      const parsed = JSON.parse(exerciseRow.aliases);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }, [exerciseRow]);

  // The all-time best for THIS exercise — the hero, and the mark on the session
  // that set it.
  const pr = useMemo(() => {
    if (!userId || !stats) return null;
    return (
      getAllTimePRs(userId, PR_SCAN).find(
        (p) => p.canonical.toLowerCase() === stats.canonical.toLowerCase(),
      ) ?? null
    );
  }, [userId, stats]);

  // The PR-first hero: the best WEIGHTED set if there is one, else the best set
  // by reps (bodyweight lifts carry the story in reps). Derived from real rows.
  const hero = useMemo(() => {
    if (pr && pr.weightKg != null) return { weight: pr.weightKg, reps: pr.reps, day: pr.day };
    if (!stats || stats.sessions.length === 0) return null;
    const best = [...stats.sessions].sort(
      (a, b) => (b.topWeight ?? 0) - (a.topWeight ?? 0) || (b.topReps ?? 0) - (a.topReps ?? 0),
    )[0]!;
    return { weight: best.topWeight, reps: best.topReps, day: best.day };
  }, [pr, stats]);

  // e1RM trend series (Epley over ≤24 sessions) — the metric serious lifters
  // chase. It was computed in db/insights but, until now, never drawn.
  const e1rmSeries = useMemo(
    () => (userId && stats ? getE1rmSeries(userId, stats.canonical, 24) : []),
    [userId, stats],
  );

  // Which metric the progression chart plots. Sticky across exercises; forced
  // to reps for a bodyweight lift (there's no weight to plot).
  const [metric, setMetric] = useState<ChartMetric>('weight');

  // The chart view model for the selected metric — real points, the all-time
  // best as a reference line, honest labels. Monochrome; no green ever.
  const chart = useMemo(() => {
    if (!stats) return null;
    const weighted = stats.sessions.filter((s) => s.topWeight != null);
    const isWeighted = weighted.length > 0;
    const m: ChartMetric = isWeighted ? metric : 'reps';
    if (m === 'e1rm') {
      const points = e1rmSeries.map((p) => ({ day: p.day, value: p.e1rm }));
      return { isWeighted, metric: m, points, prRef: stats.e1rm, title: 'Est. 1RM', unit: 'kg',
        foot: `est. 1RM · last ${points.length} sessions` };
    }
    if (m === 'reps') {
      const points = stats.sessions
        .filter((s) => s.topReps != null)
        .map((s) => ({ day: s.day, value: s.topReps as number }));
      // Top reps IS the max — a reference hairline at it would be redundant.
      return { isWeighted, metric: m, points, prRef: null, title: 'Top reps', unit: '',
        foot: `top-set reps · last ${points.length} sessions` };
    }
    const points = weighted.map((s) => ({ day: s.day, value: s.topWeight as number }));
    return { isWeighted, metric: m, points, prRef: pr?.weightKg ?? null, title: 'Heaviest weight', unit: 'kg',
      foot: `heaviest set · last ${points.length} sessions` };
  }, [stats, e1rmSeries, metric, pr]);

  // The closing summary — COMPOSED from this lift's own loads (`lift-prose.ts`,
  // pure and tested), never generated. Every number in it is already on the
  // screen above; a model may only rephrase the finished paragraph (§8.5).
  const brief: LiftBrief | null = useMemo(() => {
    if (!stats || stats.sessions.length === 0) return null;
    const window = stats.sessions;
    const firstS = window[0]!;
    const lastS = window[window.length - 1]!;
    // How many of the most recent sessions topped out at the same weight.
    let stall = 0;
    if (lastS.topWeight != null) {
      for (let i = window.length - 1; i >= 0; i--) {
        if (window[i]!.topWeight !== lastS.topWeight) break;
        stall++;
      }
    }
    const firstLabel = stats.firstDay ? labelForDay(stats.firstDay) : null;
    return {
      canonical: stats.canonical,
      sessionCount: stats.sessionCount,
      // "since Today" is not a sentence about a record.
      firstDayLabel: firstLabel === 'Today' || firstLabel === 'Yesterday' ? null : firstLabel,
      windowSessions: window.length,
      firstWeight: firstS.topWeight,
      lastWeight: lastS.topWeight,
      firstReps: firstS.topReps,
      lastReps: lastS.topReps,
      bestWeight: hero?.weight ?? null,
      bestReps: hero?.reps ?? null,
      bestDayLabel: hero ? labelForDay(hero.day) : null,
      e1rmBest: stats.e1rm,
      stallSessions: stall,
    };
  }, [stats, hero]);

  const prose = brief ? liftProse(brief) : '';
  // One cache slot per lift, so opening a second lift never evicts the first.
  const scope = stats ? `lift_${stats.canonical.toLowerCase()}` : '';
  const sessionCount = brief?.sessionCount ?? 0;
  const [summary, setSummary] = useState<string | null>(null);
  useEffect(() => {
    // The composed paragraph is on screen already; the rewrite is an upgrade
    // that arrives late or never (§1.1 inv. 2). Three sessions is the bar
    // Progress sets for having a trend at all (§16.5) — under it there is
    // nothing worth a call.
    setSummary(prose ? getCachedBriefSummary(prose, scope) : null);
    if (prose && sessionCount >= 3) refineBriefSummary(prose, setSummary, scope);
  }, [prose, scope, sessionCount]);

  const close = () => {
    tap();
    closeExerciseSheet();
  };

  // Real config only ("step +2.5 kg") — hidden when unknown.
  const step =
    exerciseRow?.modality === 'strength' && exerciseRow.increment_kg != null
      ? `step +${fmtNumber(exerciseRow.increment_kg)} kg`
      : null;

  const modality = exerciseRow ? MODALITY_LABEL[exerciseRow.modality] ?? null : null;

  // Newest session first; the older session (for the comparison subline) is the
  // next one in this reversed order.
  const ordered = stats ? [...stats.sessions].reverse() : [];

  // The plotted metric's latest value, read out beside the card's own label.
  const chartCurrent =
    chart && chart.points.length > 0
      ? `${fmtNumber(chart.points[chart.points.length - 1]!.value)}${chart.unit ? ` ${chart.unit}` : ''}`
      : null;

  return (
    <BottomSheet
      visible={sheetExercise !== null}
      onClose={close}
      sheetStyle={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
      {/* Header: chevron close · centered name pill · spacer. */}
      <View style={styles.header}>
            <PressableScale
              style={styles.chevron}
              pressedStyle={styles.chevronPressed}
              onPress={close}
              haptic="none"
              activeScale={0.92}
              hitSlop={spacing.sm}
              accessibilityRole="button"
              accessibilityLabel="Close">
              <Icon name="chevron-back" size={moderateScale(16)} tint={color.textPrimary} />
            </PressableScale>
            <View style={styles.namePill}>
              <Text style={styles.nameText} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {stats?.canonical ?? sheetExercise}
              </Text>
            </View>
            <View style={styles.spacer} />
          </View>

          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
          {/* Variant row — a single selected chip for the real modality (no
              equipment/variant data exists to offer alternatives). */}
          {modality ? (
            <View style={styles.chipRow}>
              <View style={styles.chipSelected}>
                <Text style={styles.chipSelectedText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {modality}
                </Text>
              </View>
              {step ? (
                <Text style={styles.step} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {step}
                </Text>
              ) : null}
            </View>
          ) : null}

          {stats && hero ? (
            <Stagger step={55} initialDelay={80}>
              {/* The three readings the whole sheet is about: how much record
                  there is, the strongest thing in it, and how much work is in
                  it. All INK — the ember below draws the shape of the record,
                  never its numbers. Tonnage gives way to reps on a bodyweight
                  lift, where there is no weight to multiply. */}
              <View style={styles.statsCard}>
                <Stat
                  glyph="calendar"
                  label={stats.sessionCount === 1 ? 'Session' : 'Sessions'}
                  value={String(stats.sessionCount)}
                />
                <View style={styles.statRule} />
                <Stat
                  glyph="plate"
                  label="Best e1RM"
                  value={stats.e1rm != null ? fmtNumber(stats.e1rm) : '—'}
                  unit={stats.e1rm != null ? 'kg' : undefined}
                />
                <View style={styles.statRule} />
                {stats.volumeTotal > 0 ? (
                  <Stat
                    glyph="barbell"
                    label="Volume"
                    value={groupThousands(stats.volumeTotal)}
                    unit="kg"
                  />
                ) : (
                  <Stat glyph="barbell" label="Total reps" value={groupThousands(stats.repsTotal)} />
                )}
              </View>

              {/* PR card — best working set first. */}
              <View style={styles.heroCard}>
                <Eyebrow tone="muted" style={styles.cardEyebrow}>
                  Personal record
                </Eyebrow>
                <View style={styles.heroTagRow}>
                  <Text style={styles.prLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    PR
                  </Text>
                  <Text style={styles.heroCaption} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    Best working set · {labelForDay(hero.day)}
                  </Text>
                </View>
                <View style={styles.heroFigureRow}>
                  <Text style={styles.heroFigure} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {hero.weight != null
                      ? `${fmtNumber(hero.weight)} kg × ${hero.reps ?? '—'}`
                      : hero.reps != null
                        ? `× ${hero.reps}`
                        : '—'}
                  </Text>
                </View>
              </View>

              {/* PROGRESSION — its own card, the way the reference reads it:
                  what is plotted, its current value, the switch, the chart. */}
              {chart ? (
                <View style={styles.progressCard}>
                  <View style={styles.chartHead}>
                    <Eyebrow tone="muted">{chart.isWeighted ? 'Progression' : chart.title}</Eyebrow>
                    {chartCurrent ? (
                      <Text style={styles.chartCurrent} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        {chartCurrent}
                      </Text>
                    ) : null}
                  </View>
                  {/* Metric chips — swap the plotted series on a fixed axis
                      (Hevy pattern). Only for weighted lifts; bodyweight lifts
                      show top reps with no toggle. */}
                  {chart.isWeighted ? (
                    <View style={styles.metricChips}>
                      {(['weight', 'e1rm', 'reps'] as const).map((mk) => {
                        const active = chart.metric === mk;
                        return (
                          <PressableScale
                            key={mk}
                            onPress={() => {
                              tap();
                              setMetric(mk);
                            }}
                            haptic="none"
                            activeScale={0.94}
                            style={[styles.metricChip, active && styles.metricChipActive]}
                            pressedStyle={!active ? styles.metricChipPressed : undefined}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={METRIC_CHIP_LABEL[mk]}>
                            <Text
                              style={[styles.metricChipText, active && styles.metricChipTextActive]}
                              maxFontSizeMultiplier={MAX_FONT_SCALE}>
                              {METRIC_CHIP_LABEL[mk]}
                            </Text>
                          </PressableScale>
                        );
                      })}
                    </View>
                  ) : null}
                  <ProgressionChart
                    points={chart.points}
                    prRef={chart.prRef}
                    unit={chart.unit}
                    footNote={chart.foot}
                  />
                </View>
              ) : null}

              {/* History table — recorded sessions, newest first. */}
              <View style={styles.tableCard}>
                <Eyebrow tone="muted" style={styles.tableEyebrow}>
                  History
                </Eyebrow>
                {ordered.map((s, i) => {
                  const isPr =
                    pr != null && s.topWeight != null && s.day === pr.day && s.topWeight === pr.weightKg;
                  const subline = sessionSubline(s, ordered[i + 1]);
                  const last = i === ordered.length - 1;
                  return (
                    <View key={s.day} style={[styles.row, !last && styles.rowRule]}>
                      <View style={styles.rowLeft}>
                        <View style={styles.rowDateLine}>
                          <Text style={styles.rowDate} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                            {labelForDay(s.day)}
                          </Text>
                          {isPr ? (
                            <Text style={styles.prLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                              PR
                            </Text>
                          ) : null}
                        </View>
                        {subline ? (
                          <Text style={styles.rowSub} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                            {subline}
                          </Text>
                        ) : null}
                      </View>
                      <Text
                        style={[styles.rowValue, isPr && styles.rowValuePr]}
                        numberOfLines={1}
                        maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        {sessionValue(s)}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* The summary, at the bottom because it summarises everything
                  above it. COMPOSED from this lift's own loads and rendered
                  instantly; a validated rewrite swaps in if one ever lands
                  (§8.5) — the foot says truthfully which one is on screen. */}
              {prose ? (
                <View style={styles.summaryCard}>
                  {/* The one glyph on this card, and chrome like the stat row's
                      (§5.1): it labels the card, never the sentences. */}
                  <View style={styles.summaryHead}>
                    <Icon name="sparkle" size={moderateScale(13)} tint={glyphTint('sparkle')} />
                    <Eyebrow tone="muted">Summary</Eyebrow>
                  </View>
                  <Text style={styles.summaryText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {summary ?? prose}
                  </Text>
                  <Text style={styles.summaryFoot} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {summary
                      ? 'Phrased from your own sets — every number is read from this record.'
                      : 'Read from your own sets — same history, same summary, offline.'}
                  </Text>
                </View>
              ) : null}

              {/* The user's own vocabulary — real aliases only. */}
              {aliases.length > 0 ? (
                <View style={styles.aliasCard}>
                  <Text style={styles.aliasText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    Your words for this:{' '}
                    <Text style={styles.aliasWords}>{aliases.map((a) => `“${a}”`).join(', ')}</Text>
                  </Text>
                </View>
              ) : null}

              <Text style={styles.footer} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Recorded work only. Plans and unfinished drafts never appear here.
              </Text>
            </Stagger>
          ) : (
            <Text style={styles.empty} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              No logged sessions yet.
            </Text>
          )}
          </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: color.bg,
    paddingHorizontal: spacing.xl,
    // Cap the sheet so a long history scrolls instead of pushing the header off
    // the top of the screen; the body below shrinks and scrolls within it.
    maxHeight: '90%',
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: spacing.sm,
  },

  // The opening ledger row: three readings, hairline-split, label over figure.
  statsCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: spacing.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
  },
  statTile: {
    flex: 1,
    paddingHorizontal: spacing.md,
    gap: spacing.xs + 2,
  },
  statRule: {
    width: 1,
    backgroundColor: color.tableRule,
  },
  statHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 1,
  },
  statLabel: {
    ...eyebrow,
    flexShrink: 1,
    color: color.textMuted,
  },
  statFigureRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  statFigure: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(22),
    lineHeight: moderateScale(26),
    fontWeight: '600',
    letterSpacing: -0.4,
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statUnit: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(11),
    color: color.textMuted,
  },

  // The progression card — label, current reading, metric switch, chart.
  progressCard: {
    marginTop: spacing.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },

  // Metric chips above the progression chart (Heaviest / Est. 1RM / Top Reps).
  metricChips: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metricChip: {
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  metricChipActive: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  metricChipPressed: {
    backgroundColor: color.surfaceHigh,
  },
  metricChipText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: color.textSecondary,
  },
  metricChipTextActive: {
    color: color.bg,
  },

  // Weight-progression step chart.
  chartCard: {
    marginTop: spacing.md,
  },
  chartHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  chartCurrent: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(15),
    fontWeight: '600',
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  chartPlot: {
    marginTop: spacing.sm,
  },
  /** Axis reading, pinned to the exact y of the value it names. */
  axisValue: {
    position: 'absolute',
    left: 0,
    width: AXIS_W - moderateScale(6),
    textAlign: 'right',
    fontFamily: fonts.mono,
    fontSize: moderateScale(10),
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  chartFoot: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.xs,
    paddingLeft: AXIS_W,
  },
  chartDate: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(11),
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  chartDateRight: {
    textAlign: 'right',
  },
  chartDateMid: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: moderateScale(11),
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  chartNote: {
    marginTop: spacing.sm,
    fontSize: moderateScale(11),
    color: color.textMuted,
  },
  chartEmpty: {
    marginTop: spacing.lg,
    fontSize: moderateScale(13),
    lineHeight: moderateScale(19),
    color: color.textMuted,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  chevron: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronPressed: {
    backgroundColor: color.surfaceHigh,
  },
  namePill: {
    paddingVertical: moderateScale(9),
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.pill,
    maxWidth: '70%',
  },
  nameText: {
    ...type.subhead,
    fontWeight: '600',
    color: color.textPrimary,
  },
  spacer: {
    width: moderateScale(38),
  },

  // Variant chip row
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  chipSelected: {
    paddingVertical: spacing.sm,
    paddingHorizontal: moderateScale(14),
    borderRadius: radius.pill,
    backgroundColor: color.accent,
  },
  chipSelectedText: {
    fontSize: type.caption.fontSize,
    fontWeight: '600',
    color: color.bg,
  },
  step: {
    marginLeft: 'auto',
    fontFamily: fonts.mono,
    fontSize: moderateScale(12),
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },

  // PR hero card
  heroCard: {
    marginTop: spacing.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  cardEyebrow: {
    marginBottom: spacing.md,
  },
  heroTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  prLabel: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(9),
    fontWeight: '500',
    letterSpacing: 1,
    color: color.textPrimary,
    borderWidth: 1,
    borderColor: color.textPrimary,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  heroCaption: {
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
  },
  heroFigureRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  heroFigure: {
    ...type.statNumber,
    fontFamily: fonts.mono,
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  // History table card
  tableCard: {
    marginTop: spacing.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs / 2,
  },
  tableEyebrow: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowRule: {
    borderBottomWidth: 1,
    borderBottomColor: color.tableRule,
  },
  rowLeft: {
    flexShrink: 1,
  },
  rowDateLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowDate: {
    ...type.subhead,
    fontWeight: '600',
    color: color.textPrimary,
  },
  rowSub: {
    marginTop: 3,
    fontFamily: fonts.mono,
    fontSize: moderateScale(11),
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  rowValue: {
    ...type.caption,
    fontFamily: fonts.mono,
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  rowValuePr: {
    fontWeight: '600',
    color: color.textPrimary,
  },

  // The closing summary. A faint ember wash ties it to the chart it describes —
  // chrome on a card, never on a value; the sentences themselves stay ink.
  summaryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 1,
    marginBottom: spacing.md,
  },
  summaryCard: {
    marginTop: spacing.lg,
    backgroundColor: alpha(color.trend, 0.05),
    borderWidth: 1,
    borderColor: alpha(color.trend, 0.22),
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  summaryText: {
    ...type.subhead,
    lineHeight: moderateScale(23),
    color: color.textPrimary,
  },
  summaryFoot: {
    marginTop: spacing.md,
    fontSize: moderateScale(11),
    lineHeight: moderateScale(16),
    color: color.textMuted,
  },

  // Alias card + footer
  aliasCard: {
    marginTop: spacing.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
  },
  aliasText: {
    fontSize: type.caption.fontSize,
    color: color.textPrimary,
  },
  aliasWords: {
    color: color.textSecondary,
  },
  footer: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: moderateScale(12),
    lineHeight: moderateScale(19),
    color: color.textMuted,
  },
  empty: {
    ...type.subhead,
    color: color.textMuted,
    paddingVertical: spacing.xxl,
  },
});
