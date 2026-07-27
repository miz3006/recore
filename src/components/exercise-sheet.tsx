import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { PressableScale, Stagger } from '@/components/motion';
import { Eyebrow } from '@/components/primitives';
import { type DayKey } from '@/lib/db/dates';
import {
  getExerciseStats,
  type ExerciseSession,
  type ExerciseStats,
} from '@/lib/db/exercise-stats';
import { findExerciseByName } from '@/lib/db/exercises';
import { getAllTimePRs, getE1rmSeries } from '@/lib/db/insights';
import { tap } from '@/lib/haptics';
import {
  makeStyles,
  MAX_FONT_SCALE,
  moderateScale,
  mono,
  radius,
  spacing,
  type,
  useTheme,
} from '@/lib/theme';
import { fmtNumber } from '@/lib/parse/summarize';
import { labelForDay, useSession } from '@/state/session-store';

import { Sheet } from './sheet';
import { Icon } from './icon';

/**
 * Lift detail sheet (design frame 08 — "PR-first history"). Tap a gutter value
 * and this sheet answers "how strong am I on this lift, and how did I get
 * here?" — PR FIRST, then the settled session history.
 *
 * A chevron header + name pill, one selected chip for the exercise's real
 * modality, then a PR hero card (neutral outlined PR label, the best working
 * set as a big mono figure, e1RM beside it, a 6-bar e1RM sparkline). Below it
 * the history table: newest session first, each row a date (+ PR label the day
 * it was set) with an archival comparison subline and a right-aligned mono
 * "sets×reps · load". RECORDED work only — no lime (that belongs to planned
 * prescriptions), no chart theatre. The user's own words for the lift sit in a
 * quiet card; long-press for parse correction stays the row's job elsewhere.
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

/**
 * Progression line chart (Mobbin: Hevy's exercise chart + Tonal's dashed PR
 * reference). Plots ONE chosen metric — heaviest weight, estimated 1RM, or top
 * reps — over the last sessions: ink line + dots, the latest session
 * emphasized, dates at the ends. A single UNLABELED dashed hairline marks the
 * all-time best (folded into the domain so it's always on-screen) — never
 * green, never a second "PR" caption; the outlined mono label owns that word.
 * All series are real data; under two points it says so instead of a flat line.
 */
function ProgressionChart({
  points,
  prRef,
  title,
  unit,
  footNote,
}: {
  points: ChartPoint[];
  prRef: number | null;
  title: string;
  unit: string;
  footNote: string;
}) {
  const styles = useStyles();
  const t = useTheme();
  const [w, setW] = useState(0);

  if (points.length < 2) {
    return (
      <Text style={styles.chartEmpty} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Log a couple of sessions to see your progression here.
      </Text>
    );
  }

  const H = moderateScale(140);
  const padX = moderateScale(4);
  const padT = moderateScale(16);
  const padB = moderateScale(16);
  const values = points.map((p) => p.value);
  // Fold the PR reference into the domain so its hairline never clips.
  const domain = prRef != null ? [...values, prRef] : values;
  const min = Math.min(...domain);
  const max = Math.max(...domain);
  const span = max - min;
  const plotW = Math.max(1, w - padX * 2);
  const plotH = H - padT - padB;
  // inset 12% top & bottom so the line never glues to the frame
  const yOf = (v: number) =>
    padT + plotH * 0.12 + (1 - (span > 0 ? (v - min) / span : 0.5)) * plotH * 0.76;
  const xy = points.map((p, i) => ({ x: padX + (i / (points.length - 1)) * plotW, y: yOf(p.value) }));
  const linePts = xy.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ');
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const prY = prRef != null ? yOf(prRef) : null;
  const fmtVal = (v: number) => (unit ? `${fmtNumber(v)} ${unit}` : `${v}`);

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHead}>
        <Text style={styles.chartTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {title}
        </Text>
        <Text style={styles.chartCurrent} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {fmtVal(last.value)}
        </Text>
      </View>
      <View style={styles.chartPlot} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0 ? (
          <Svg width={w} height={H}>
            {/* All-time-best reference — one unlabeled neutral hairline. */}
            {prY != null ? (
              <Line
                x1={padX}
                y1={prY}
                x2={w - padX}
                y2={prY}
                stroke={t.rule}
                strokeWidth={1}
                strokeDasharray="3 4"
              />
            ) : null}
            <Polyline
              points={linePts}
              fill="none"
              stroke={t.ink}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {xy.map((q, i) => {
              const latest = i === xy.length - 1;
              return (
                <Circle
                  key={i}
                  cx={q.x}
                  cy={q.y}
                  r={latest ? moderateScale(4) : moderateScale(2.5)}
                  fill={latest ? t.ink : t.canvas}
                  stroke={t.ink}
                  strokeWidth={1.5}
                />
              );
            })}
          </Svg>
        ) : null}
      </View>
      <View style={styles.chartFoot}>
        <Text style={styles.chartDate} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {labelForDay(first.day)}
        </Text>
        <Text style={styles.chartMid} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {footNote}
        </Text>
        <Text style={[styles.chartDate, styles.chartDateRight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {labelForDay(last.day)}
        </Text>
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
  const styles = useStyles();
  const t = useTheme();
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

  return (
    <Sheet
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
              <Icon name="chevron-back" size={moderateScale(16)} tint={t.ink} />
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
              {/* PR hero card — best working set first. */}
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
                  {stats.e1rm != null ? (
                    <Text style={styles.heroE1rm} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      e1RM {fmtNumber(stats.e1rm)}
                    </Text>
                  ) : null}
                </View>

                {chart ? (
                  <>
                    {/* Metric chips — swap the plotted series on a fixed axis
                        (Hevy pattern). Only for weighted lifts; bodyweight
                        lifts show top reps with no toggle. */}
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
                      title={chart.title}
                      unit={chart.unit}
                      footNote={chart.foot}
                    />
                  </>
                ) : null}
              </View>

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
    </Sheet>
  );
}

const useStyles = makeStyles((t) => ({
  sheet: {
    backgroundColor: t.canvas,
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

  // Metric chips above the progression chart (Heaviest / Est. 1RM / Top Reps).
  metricChips: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  metricChip: {
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.md,
    borderRadius: radius.capsule,
    borderWidth: 1,
    borderColor: t.rule,
    backgroundColor: t.surface,
  },
  metricChipActive: {
    backgroundColor: t.ink,
    borderColor: t.ink,
  },
  metricChipPressed: {
    backgroundColor: t.surfaceHigh,
  },
  metricChipText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: t.inkMuted,
  },
  metricChipTextActive: {
    color: t.canvas,
  },

  // Weight-progression line chart.
  chartCard: {
    marginTop: spacing.md,
  },
  chartHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  chartTitle: {
    fontSize: type.callout.fontSize,
    fontWeight: '600',
    color: t.ink,
  },
  chartCurrent: {
    fontFamily: mono.semibold,
    fontSize: moderateScale(15),
    color: t.ink,
    fontVariant: ['tabular-nums'],
  },
  chartPlot: {
    marginTop: spacing.sm,
  },
  chartFoot: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.sm,
  },
  chartDate: {
    fontFamily: mono.medium,
    fontSize: moderateScale(11),
    color: t.inkFaint,
    fontVariant: ['tabular-nums'],
  },
  chartDateRight: {
    textAlign: 'right',
  },
  chartMid: {
    flex: 1,
    textAlign: 'center',
    fontSize: moderateScale(11),
    color: t.inkFaint,
  },
  chartEmpty: {
    marginTop: spacing.lg,
    fontSize: moderateScale(13),
    lineHeight: moderateScale(19),
    color: t.inkFaint,
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
    borderRadius: radius.capsule,
    borderWidth: 1,
    borderColor: t.rule,
    backgroundColor: t.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronPressed: {
    backgroundColor: t.surfaceHigh,
  },
  namePill: {
    paddingVertical: moderateScale(9),
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: t.rule,
    backgroundColor: t.surface,
    borderRadius: radius.capsule,
    maxWidth: '70%',
  },
  nameText: {
    ...type.callout,
    fontWeight: '600',
    color: t.ink,
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
    borderRadius: radius.capsule,
    backgroundColor: t.ink,
  },
  chipSelectedText: {
    fontSize: type.caption.fontSize,
    fontWeight: '600',
    color: t.canvas,
  },
  step: {
    marginLeft: 'auto',
    fontFamily: mono.medium,
    fontSize: moderateScale(12),
    color: t.inkFaint,
    fontVariant: ['tabular-nums'],
  },

  // PR hero card
  heroCard: {
    marginTop: spacing.lg,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.rule,
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
    fontFamily: mono.medium,
    fontSize: moderateScale(9),
    letterSpacing: 1,
    color: t.ink,
    borderWidth: 1,
    borderColor: t.ink,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  heroCaption: {
    fontSize: type.caption.fontSize,
    color: t.inkMuted,
  },
  heroFigureRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  heroFigure: {
    ...type.dataXL,
    fontFamily: mono.medium,
    color: t.ink,
    fontVariant: ['tabular-nums'],
  },
  heroE1rm: {
    fontFamily: mono.medium,
    fontSize: moderateScale(14),
    color: t.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  // History table card
  tableCard: {
    marginTop: spacing.lg,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.rule,
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
    borderBottomColor: t.rule,
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
    ...type.callout,
    fontWeight: '600',
    color: t.ink,
  },
  rowSub: {
    marginTop: 3,
    fontFamily: mono.medium,
    fontSize: moderateScale(11),
    color: t.inkFaint,
    fontVariant: ['tabular-nums'],
  },
  rowValue: {
    ...type.caption,
    fontFamily: mono.medium,
    color: t.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  rowValuePr: {
    fontWeight: '600',
    color: t.ink,
  },

  // Alias card + footer
  aliasCard: {
    marginTop: spacing.lg,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.rule,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
  },
  aliasText: {
    fontSize: type.caption.fontSize,
    color: t.ink,
  },
  aliasWords: {
    color: t.inkMuted,
  },
  footer: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: moderateScale(12),
    lineHeight: moderateScale(19),
    color: t.inkFaint,
  },
  empty: {
    ...type.callout,
    color: t.inkFaint,
    paddingVertical: spacing.xxl,
  },
}));
