import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { StepChart } from '@/components/charts';
import { Icon } from '@/components/icon';
import { FadeSlideIn, PressableScale, Stagger } from '@/components/motion';
import { AppButton, Eyebrow } from '@/components/primitives';
import { StubScreen } from '@/components/stub-screen';
import { shiftDayKey, todayKey, type DayKey } from '@/lib/db/dates';
import { getWorkoutDetail, type WorkoutSet } from '@/lib/db/insights';
import { getLiftSessions } from '@/lib/db/progression';
import { tap } from '@/lib/haptics';
import { groupThousands } from '@/lib/parse/estimate';
import { fmtNumber } from '@/lib/parse/summarize';
import {
  buildProgression,
  daysBetween,
  describeDelta,
  type LiftProgression,
  type ProgressionMetric,
} from '@/lib/progression';
import {
  color,
  fonts,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  shadow,
  spacing,
  TAB_BAR_CLEARANCE,
  type,
} from '@/lib/theme';
import { labelForDay, useSession } from '@/state/session-store';

/**
 * Progress (CLAUDE.md §5.1 — "Am I actually improving?"), the third tab.
 *
 * The screen used to answer a different question than the one the tab bar asks:
 * it drew ONE week of volume behind a paginator. Volume is how much work got
 * done, not whether the lifter got stronger — it falls on a deload, which is
 * correct training, and the old week-over-week line reported that fall as
 * "Down 18%", the same scold §5.1 forbids a leading minus from making.
 *
 * So this is now **one card per lift**, and progression is measured per lift:
 *
 *   range (8W / 6M / 1Y)  →  metric (Est. 1RM / Heaviest / Volume)
 *   →  one true sentence  →  a card per lift  →  the sets behind the latest point
 *
 * A card carries a STEP chart (strength holds, then jumps — a curve would
 * invent the sessions in between), the latest value, and how far it moved as a
 * WORD. Tapping one opens the set table of the session that made that last
 * point: the trend and its evidence on the same surface, which is the pattern
 * the reference sweep argued for hardest.
 *
 * What this screen deliberately does NOT do is say what to lift next. Green
 * belongs to a prescription and a prescription belongs on Today; Progress is
 * the archive. Both sheets it opens (`ExerciseSheet`, `SessionSheet`) are
 * mounted once in `_layout.tsx`, so this file only dispatches.
 */

/** Ranges, shortest first. The shortest is always offered; a longer one is
 * dimmed until the record actually reaches back that far — a chart that runs
 * out of history is a chart that lies about it. */
const RANGES = [
  { key: '8W', days: 56, ago: 'eight weeks ago' },
  { key: '6M', days: 182, ago: 'six months ago' },
  { key: '1Y', days: 365, ago: 'a year ago' },
] as const;

const METRICS: { key: ProgressionMetric; label: string }[] = [
  { key: 'e1rm', label: 'Est. 1RM' },
  { key: 'weight', label: 'Heaviest' },
  { key: 'volume', label: 'Volume' },
];

const CHART_H = moderateScale(58);
const CHART_H_OPEN = moderateScale(88);
/** Beyond this the rep cap makes an Epley estimate dishonest (matches the
 * parser-side rule in `getE1rmSeries`). */
const E1RM_REP_CAP = 12;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * How far a pressed row's highlight bleeds past its content, toward the card's
 * edge — and it is rounded (`radius.sm`) on the way out. A fill drawn on the
 * row's own box is a hard-cornered grey rectangle floating inside the card's
 * padding, which reads as a mis-drawn box rather than as the row lighting up.
 * Content never moves: the margin is paid back as padding.
 */
const PRESS_BLEED = spacing.sm;

/** "Jul 13" from a DayKey — a chart endpoint, never a full date. */
function monthDay(day: DayKey): string {
  const [, m, d] = day.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}`;
}

/** Volume runs to five figures and wants thousands grouping; a load wants its
 * half-kilo. Both are kilograms, so the unit never changes. */
function formatValue(v: number, metric: ProgressionMetric): string {
  return metric === 'volume' ? groupThousands(Math.round(v)) : fmtNumber(v);
}

/**
 * The one sentence at the top. Specific, backward-looking, and never a claim
 * about Recore or about the person (§15) — it counts lifts and says the number.
 */
function verdictLine(
  improved: number,
  counted: number,
  metric: ProgressionMetric,
  ago: string,
): string {
  const subject = counted === 1 ? 'lift is' : 'lifts are';
  const moved = metric === 'volume' ? 'moving more weight' : 'heavier';
  const head = improved === 0 ? `None of ${counted}` : `${improved} of ${counted}`;
  return `${head} ${subject} ${moved} than ${ago}.`;
}

/** "26 sessions · longest gap 6 days" — decision 04: the whole week ledger,
 * compressed into the one line that carries what it was for. */
function spreadLine(sessions: number, gap: number | null): string {
  const head = `${sessions} ${sessions === 1 ? 'session' : 'sessions'}`;
  if (gap == null) return head;
  return `${head} · longest gap ${gap} ${gap === 1 ? 'day' : 'days'}`;
}

function setText(s: WorkoutSet): string {
  if (s.weightKg != null && s.reps != null) return `${fmtNumber(s.weightKg)} kg × ${s.reps}`;
  if (s.weightKg != null) return `${fmtNumber(s.weightKg)} kg`;
  if (s.reps != null) return `${s.reps} reps`;
  return '—';
}

/** The estimate beside a set, when the set can honestly carry one. */
function setEstimate(s: WorkoutSet): string {
  if (s.weightKg == null || s.reps == null || s.reps > E1RM_REP_CAP) return '';
  const e1rm = Math.round((s.weightKg * (1 + s.reps / 30)) / 0.5) * 0.5;
  return `e1RM ${fmtNumber(e1rm)}`;
}

export default function Progress() {
  const router = useRouter();
  const userId = useSession((s) => s.userId);
  const openExerciseSheet = useSession((s) => s.openExerciseSheet);
  const openSessionSheet = useSession((s) => s.openSessionSheet);

  // Cheap synchronous SQLite reads — re-run on every focus so a CSV import or a
  // session finished on Today lands here without a relaunch.
  const [refresh, setRefresh] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setRefresh((n) => n + 1);
    }, []),
  );

  const [metric, setMetric] = useState<ProgressionMetric>('e1rm');
  const [rangeIndex, setRangeIndex] = useState(0);
  /** The key of the ONE open card. An accordion, so the screen stays short. */
  const [openKey, setOpenKey] = useState<string | null>(null);

  /* eslint-disable react-hooks/exhaustive-deps */
  // The whole aggregated history, once. Every metric and every range is derived
  // from it in pure code, so switching a tab costs no query.
  const rows = useMemo(() => (userId ? getLiftSessions(userId) : []), [userId, refresh]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const today = todayKey();
  const range = RANGES[rangeIndex]!;
  const fromDay = shiftDayKey(today, -range.days);
  // Rows arrive oldest-first, so the first row is where the record begins.
  const historyDays = rows.length > 0 ? daysBetween(rows[0]!.day, today) : 0;

  const view = useMemo(() => buildProgression(rows, metric, fromDay), [rows, metric, fromDay]);

  // The open card's evidence: the counted sets of the session behind its latest
  // point. Read only while a card is open, never for the whole list.
  const evidence = useMemo(() => {
    if (!openKey) return null;
    const lift = view.lifts.find((l) => l.key === openKey);
    if (!lift) return null;
    const detail = getWorkoutDetail(lift.workoutId);
    if (!detail) return null;
    const sets = detail.exercises
      .filter((e) => e.canonical.toLowerCase() === lift.key)
      .flatMap((e) => e.sets)
      .filter((s) => s.kind !== 'warmup' && s.kind !== 'drop' && s.kind !== 'skipped');
    return { lift, sets };
  }, [openKey, view]);

  // §12.1: an empty state says what will fill it and never reports a lack.
  if (rows.length === 0) {
    return (
      <StubScreen title="Progress" back={false}>
        <FadeSlideIn>
          <View style={styles.emptyCard}>
            <Eyebrow>Progress</Eyebrow>
            <Text style={styles.emptyTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Your training, measured.
            </Text>
            <Text style={styles.emptyBody} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Log one session — or import your history — and every lift you name gets a line
              here showing where it started and where it is now.
            </Text>
            <View style={styles.emptyActions}>
              <AppButton
                label="Import from Hevy or Strong"
                variant="secondary"
                compact
                onPress={() => router.push('/you')}
              />
            </View>
          </View>
        </FadeSlideIn>
      </StubScreen>
    );
  }

  return (
    <StubScreen title="Progress" back={false}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* Range — the shortest is always live; a longer one waits for history. */}
        <View style={styles.rangeRow}>
          <View style={styles.seg}>
            {RANGES.map((r, i) => {
              const active = i === rangeIndex;
              const reachable = i === 0 || historyDays >= r.days;
              return (
                <PressableScale
                  key={r.key}
                  haptic="none"
                  activeScale={0.96}
                  disabled={!reachable}
                  onPress={() => {
                    tap();
                    setRangeIndex(i);
                    setOpenKey(null);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: !reachable }}
                  accessibilityLabel={r.key === '8W' ? 'Eight weeks' : r.key === '6M' ? 'Six months' : 'One year'}
                  style={[styles.segItem, active && styles.segItemActive]}
                  pressedStyle={active ? undefined : styles.pressed}>
                  <Text
                    style={[
                      styles.segText,
                      active && styles.segTextActive,
                      !reachable && styles.segTextOff,
                    ]}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {r.key}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
          <Text style={styles.since} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {`SINCE ${monthDay(fromDay).toUpperCase()}`}
          </Text>
        </View>

        {/* Metric — switches what every card plots, at once. */}
        <View style={styles.tabs}>
          {METRICS.map((m) => {
            const active = m.key === metric;
            return (
              <PressableScale
                key={m.key}
                haptic="none"
                activeScale={0.96}
                onPress={() => {
                  tap();
                  setMetric(m.key);
                  setOpenKey(null);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.tab, active && styles.tabActive]}>
                <Text
                  style={[styles.tabText, active && styles.tabTextActive]}
                  maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {m.label}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        {view.counted === 0 ? (
          <FadeSlideIn>
            <Text style={styles.thin} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Two more sessions of the same lift and there&apos;s a trend to show here.
            </Text>
          </FadeSlideIn>
        ) : (
          <Stagger step={55} initialDelay={60}>
            {/* The verdict — one sentence, one supporting line, no chart. */}
            <View style={styles.verdict}>
              <Text style={styles.verdictLine} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {verdictLine(view.improved, view.counted, metric, range.ago)}
              </Text>
              <Text style={styles.verdictSub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {spreadLine(view.sessions, view.longestGapDays)}
              </Text>
            </View>

            {view.lifts.map((lift) => (
              <LiftCard
                key={lift.key}
                lift={lift}
                metric={metric}
                open={openKey === lift.key}
                sets={evidence && evidence.lift.key === lift.key ? evidence.sets : []}
                onToggle={() => {
                  tap();
                  setOpenKey((k) => (k === lift.key ? null : lift.key));
                }}
                onOpenSession={() => {
                  tap();
                  openSessionSheet(lift.workoutId);
                }}
                onOpenHistory={() => {
                  tap();
                  openExerciseSheet(lift.canonical);
                }}
              />
            ))}
          </Stagger>
        )}

        <PressableScale
          haptic="none"
          activeScale={0.98}
          onPress={() => {
            tap();
            router.push('/lifts');
          }}
          accessibilityRole="button"
          accessibilityLabel="All lifts"
          style={styles.allLiftsRow}
          pressedStyle={styles.pressed}>
          <Text style={styles.allLiftsLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            All lifts
          </Text>
          <Icon name="chevron-forward" size={moderateScale(14)} tint={color.textMuted} />
        </PressableScale>
      </ScrollView>
    </StubScreen>
  );
}

function LiftCard({
  lift,
  metric,
  open,
  sets,
  onToggle,
  onOpenSession,
  onOpenHistory,
}: {
  lift: LiftProgression;
  metric: ProgressionMetric;
  open: boolean;
  sets: WorkoutSet[];
  onToggle: () => void;
  onOpenSession: () => void;
  onOpenHistory: () => void;
}) {
  const startDay = lift.points[0]!.day;
  const delta = describeDelta(lift.delta, 'kg', monthDay(startDay), (n) =>
    formatValue(n, metric),
  );
  const value = formatValue(lift.latest, metric);

  return (
    <View style={styles.card}>
      <PressableScale
        haptic="none"
        activeScale={0.99}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${lift.canonical}, ${value} kilograms, ${delta}, ${lift.sessions} sessions`}
        style={styles.summary}>
        <View style={styles.cardTop}>
          <View style={styles.cardName}>
            <View style={styles.nameLine}>
              <Text style={styles.liftName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {lift.canonical}
              </Text>
              {lift.isBest ? (
                <View style={styles.prChip}>
                  <Text style={styles.prChipText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    PR
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.liftMeta} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {`${lift.sessions} sessions · last ${labelForDay(lift.lastDay)}`}
            </Text>
          </View>
          <View style={styles.heroBox}>
            <Text style={styles.hero} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {value}
              <Text style={styles.heroUnit}> kg</Text>
            </Text>
            <Text style={styles.heroDelta} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {delta}
            </Text>
          </View>
        </View>

        <StepChart
          points={lift.points}
          best={lift.best}
          height={open ? CHART_H_OPEN : CHART_H}
          showPrevious={open}
        />

        <View style={styles.ends}>
          <Text style={styles.endLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {monthDay(startDay)}
          </Text>
          <Text style={styles.endLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {monthDay(lift.lastDay)}
          </Text>
        </View>
      </PressableScale>

      {open ? (
        <FadeSlideIn>
          <View style={styles.cardRule} />
          <PressableScale
            haptic="none"
            activeScale={0.99}
            onPress={onOpenSession}
            accessibilityRole="button"
            accessibilityLabel={`Open the full session from ${labelForDay(lift.lastDay)}`}
            style={styles.evHead}
            pressedStyle={styles.pressed}>
            <Eyebrow>{`${monthDay(lift.lastDay)} · what made it`}</Eyebrow>
            <Icon name="chevron-forward" size={moderateScale(13)} tint={color.textMuted} />
          </PressableScale>

          {sets.length === 0 ? (
            <Text style={styles.thin} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              That session&apos;s sets are still syncing.
            </Text>
          ) : (
            sets.map((s, i) => (
              <View key={`${s.position}-${i}`} style={styles.setRow}>
                <Text style={styles.setIndex} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {`Set ${i + 1}`}
                </Text>
                <Text style={styles.setValue} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {setText(s)}
                </Text>
                <Text style={styles.setEstimate} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {setEstimate(s)}
                </Text>
              </View>
            ))
          )}

          <View style={styles.cardRule} />
          <PressableScale
            haptic="none"
            activeScale={0.99}
            onPress={onOpenHistory}
            accessibilityRole="button"
            accessibilityLabel={`Full history for ${lift.canonical}`}
            style={styles.opener}
            pressedStyle={styles.pressed}>
            <Text style={styles.openerLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Full history
            </Text>
            <Icon name="chevron-forward" size={moderateScale(13)} tint={color.textMuted} />
          </PressableScale>
        </FadeSlideIn>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    marginHorizontal: -spacing.xxl, // StubScreen pads the body; the scroll owns it
  },
  content: {
    paddingHorizontal: spacing.xxl,
    // Content scrolls *behind* the tab bar (§5.2 — glass needs something to
    // refract), so the last row is padded clear of it rather than inset.
    paddingBottom: spacing.huge + TAB_BAR_CLEARANCE,
    gap: spacing.lg,
  },

  // --- range + metric chrome --------------------------------------------------
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  seg: {
    flexDirection: 'row',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.pill,
    padding: moderateScale(3),
  },
  segItem: {
    paddingVertical: spacing.sm - 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  segItemActive: {
    backgroundColor: color.accent,
  },
  segText: {
    fontFamily: fonts.mono,
    fontSize: type.footnote.fontSize,
    fontWeight: '600',
    color: color.textSecondary,
  },
  segTextActive: {
    color: color.bg,
  },
  segTextOff: {
    color: color.textMuted,
    opacity: 0.5,
  },
  since: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(10),
    letterSpacing: 1.2,
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },

  tabs: {
    flexDirection: 'row',
    gap: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: color.tableRule,
  },
  tab: {
    paddingBottom: spacing.sm,
    // minHeight, never height: the label has to grow at the Dynamic Type
    // ceiling rather than be cropped by its own tab (§5.3).
    minHeight: moderateScale(30),
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: color.accent,
  },
  tabText: {
    ...type.subhead,
    color: color.textMuted,
    fontWeight: '500',
  },
  tabTextActive: {
    color: color.textPrimary,
    fontWeight: '600',
  },

  // --- the verdict ------------------------------------------------------------
  verdict: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  verdictLine: {
    ...type.headline,
    fontWeight: '500',
    color: color.textPrimary,
  },
  verdictSub: {
    fontFamily: fonts.mono,
    fontSize: type.footnote.fontSize,
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },

  // --- lift card --------------------------------------------------------------
  card: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  summary: {
    gap: spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  cardName: {
    flexShrink: 1,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  liftName: {
    ...type.subhead,
    flexShrink: 1,
    fontWeight: '600',
    color: color.textPrimary,
  },
  // A PR is a SHAPE, never a colour (§5.1) — an outlined mono label, so it
  // survives colourblindness and never competes with the green on Today.
  prChip: {
    borderWidth: 1,
    borderColor: color.textPrimary,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  prChipText: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(11),
    fontWeight: '700',
    letterSpacing: 0.5,
    color: color.textPrimary,
  },
  liftMeta: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(10.5),
    marginTop: 3,
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  heroBox: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  hero: {
    fontFamily: fonts.mono,
    fontSize: type.title2.fontSize,
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
  },
  heroDelta: {
    ...type.footnote,
    marginTop: spacing.xs,
    color: color.textMuted,
  },
  ends: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  endLabel: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(10),
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },

  // --- the evidence, inside an open card --------------------------------------
  cardRule: {
    height: 1,
    backgroundColor: color.tableRule,
    marginVertical: spacing.md,
  },
  evHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: moderateScale(28),
    marginHorizontal: -PRESS_BLEED,
    paddingHorizontal: PRESS_BLEED,
    borderRadius: radius.sm,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderBottomWidth: 1,
    borderBottomColor: color.tableRule,
  },
  setIndex: {
    fontFamily: fonts.mono,
    fontSize: type.footnote.fontSize,
    color: color.textMuted,
    width: moderateScale(42),
    fontVariant: ['tabular-nums'],
  },
  setValue: {
    fontFamily: fonts.mono,
    fontSize: type.footnote.fontSize,
    flex: 1,
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  setEstimate: {
    fontFamily: fonts.mono,
    fontSize: type.footnote.fontSize,
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  opener: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: moderateScale(28),
    marginHorizontal: -PRESS_BLEED,
    paddingHorizontal: PRESS_BLEED,
    borderRadius: radius.sm,
  },
  openerLabel: {
    ...type.caption,
    color: color.textSecondary,
  },

  // --- tail + states ----------------------------------------------------------
  allLiftsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: moderateScale(44),
    marginHorizontal: -PRESS_BLEED,
    paddingHorizontal: PRESS_BLEED + spacing.xs,
    borderRadius: radius.sm,
  },
  allLiftsLabel: {
    ...type.caption,
    color: color.textSecondary,
  },
  thin: {
    ...type.subhead,
    color: color.textMuted,
    paddingVertical: spacing.md,
  },
  pressed: {
    backgroundColor: color.surfaceHigh,
  },
  emptyCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyTitle: {
    ...type.headline,
    fontWeight: '600',
    color: color.textPrimary,
  },
  emptyBody: {
    ...type.subhead,
    color: color.textSecondary,
  },
  emptyActions: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
});
