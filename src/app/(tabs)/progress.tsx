import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { TrendChart } from '@/components/charts';
import { Icon } from '@/components/icon';
import { FadeSlideIn, PressableScale, Stagger } from '@/components/motion';
import { AppButton, Eyebrow } from '@/components/primitives';
import { StubScreen } from '@/components/stub-screen';
import { shiftDayKey, todayKey, type DayKey } from '@/lib/db/dates';
import { getWorkoutDetail, type WorkoutSet } from '@/lib/db/insights';
import { getLiftSessions } from '@/lib/db/progression';
import { markImportCompleted, markImported, markImportStarted } from '@/lib/funnel';
import { tap } from '@/lib/haptics';
import { pickAndImportCsv } from '@/lib/import/pick';
import { rowCountBucket } from '@/lib/onboarding';
import { recachePredictionFromLatest } from '@/lib/predict/cache';
import { groupThousands } from '@/lib/parse/estimate';
import { fmtNumber } from '@/lib/parse/summarize';
import {
  buildProgression,
  daysBetween,
  describeDelta,
  sortLifts,
  type LiftBrief,
  type LiftProgression,
  type LiftSort,
  type ProgressionMetric,
  type ProgressionView,
} from '@/lib/progression';
import {
  alpha,
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
 * Progress (product-direction §10 — "Am I progressing, and what is the
 * evidence?"), the third tab.
 *
 * The screen is **one card per lift**, and progression is measured per lift:
 *
 *   range (8W / 6M / 1Y)  →  metric (Est. 1RM / Heaviest / Volume)
 *   →  a summary of how the whole range went  →  ranked cards
 *   →  the sets behind the latest point
 *
 * Three owner decisions, 4 Aug 2026, shape this version:
 *
 * 1. **Ranked by how far a lift moved**, biggest first (`sortLifts('gain')`),
 *    on the PERCENTAGE — kilos would rank a deadlift above a curl forever and
 *    call that a ranking. Recency and A–Z stay one tap away, because "what did
 *    I train last" is a different question and the ranking must not become the
 *    only way to find a lift.
 * 2. **A summary at the top** that says how the whole range went: how many
 *    lifts moved up, a bar showing the split, sessions, longest gap, new bests,
 *    and the single biggest move named with its number. Every one of those is
 *    counted from stored rows — no model, no adjectives (§2, rule 6).
 * 3. **Colour** (§4.2/§10): Recore blue carries active controls and the
 *    progression lines with their soft wash. A lift that fell draws in exactly
 *    the same blue as one that rose — direction is a word, never a hue, so the
 *    screen can rank without ever scolding a deload.
 *
 * A card carries a LINE chart — straight segments between real sessions, up
 * and down (owner, 4 Aug 2026, replacing the step shape §10 asks for; the
 * dots are the sessions, and `TrendChart`'s `shape` prop restores steps in one
 * word). The latest value sits beside it and how far it moved reads as a word.
 * Tapping one opens the set table of the session that made that last point. Lifts too shallow to chart are listed below the cards rather than
 * dropped, so nothing a person logged disappears from their own record.
 *
 * Both sheets it opens (`ExerciseSheet`, `SessionSheet`) are mounted once in
 * `_layout.tsx`, so this file only dispatches.
 */

/** Ranges, shortest first. The shortest is always offered; a longer one is
 * dimmed until the record actually reaches back that far — a chart that runs
 * out of history is a chart that lies about it. */
const RANGES = [
  { key: '8W', days: 56, ago: 'eight weeks ago', label: 'Eight weeks' },
  { key: '6M', days: 182, ago: 'six months ago', label: 'Six months' },
  { key: '1Y', days: 365, ago: 'a year ago', label: 'One year' },
] as const;

const METRICS: { key: ProgressionMetric; label: string; eyebrow: string }[] = [
  { key: 'e1rm', label: 'Est. 1RM', eyebrow: 'estimated 1RM' },
  { key: 'weight', label: 'Heaviest', eyebrow: 'heaviest set' },
  { key: 'volume', label: 'Volume', eyebrow: 'volume' },
];

const SORTS: { key: LiftSort; label: string }[] = [
  { key: 'gain', label: 'Biggest gain' },
  { key: 'recent', label: 'Recent' },
  { key: 'name', label: 'A–Z' },
];

const CHART_H = moderateScale(64);
const CHART_H_OPEN = moderateScale(104);
/** Beyond this the rep cap makes an Epley estimate dishonest (matches the
 * parser-side rule in `getE1rmSeries`). */
const E1RM_REP_CAP = 12;
/** Under this much history a sessions-per-week average is arithmetic noise, so
 * the tile drops its sub-line rather than dividing by a fortnight it never had. */
const MIN_DAYS_FOR_RATE = 14;

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
 * The same value for a chart's axis gutter, which is ~34pt wide: five-figure
 * volume gets one decimal and a `k` rather than being quietly clipped, and a
 * clipped number is a wrong number. Loads are short already and pass through.
 */
function axisValue(v: number, metric: ProgressionMetric): string {
  if (metric === 'volume' && v >= 10_000) return `${Math.round(v / 100) / 10}k`;
  return formatValue(v, metric);
}

/**
 * The share a lift moved, as a WORD — the same ruling `describeDelta` keeps
 * (§5.1): never a leading minus, never a colour deciding whether the number is
 * good news. Sub-1% moves say so instead of rounding themselves to "same",
 * which would make a chip disagree with the chart above it.
 */
function percentText(delta: number, percent: number): string {
  if (delta === 0) return 'same';
  const dir = delta > 0 ? 'up' : 'down';
  const size = Math.abs(percent);
  if (size === 0) return dir; // a move with no starting value to be a share of
  if (size < 1) return `${dir} <1%`;
  return `${dir} ${Math.round(size)}%`;
}

/**
 * The one sentence at the top. Specific, backward-looking, and never a claim
 * about Recore or about the person (§2, rule 6) — it counts lifts and says the
 * number.
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

/** "9 up · 2 same · 1 down" — the split under the bar, in words, so the bar's
 * colours are never the only thing carrying it (§14). */
function splitLine(view: ProgressionView): string {
  const parts: string[] = [];
  if (view.improved > 0) parts.push(`${view.improved} up`);
  if (view.unchanged > 0) parts.push(`${view.unchanged} same`);
  if (view.declined > 0) parts.push(`${view.declined} down`);
  return parts.join(' · ');
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
  const hydrate = useSession((s) => s.hydrate);
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
  const [sort, setSort] = useState<LiftSort>('gain');
  /** The key of the ONE open card. An accordion, so the screen stays short. */
  const [openKey, setOpenKey] = useState<string | null>(null);
  // The empty state's import runs RIGHT HERE — the button used to push /you
  // and leave the person to find the row themselves, which promised an action
  // it didn't perform. Same flow as /import-start and You.
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const handleEmptyImport = async () => {
    if (importBusy || !userId) return;
    tap();
    setImportBusy(true);
    setImportMessage(null);
    markImportStarted();
    try {
      const outcome = await pickAndImportCsv(userId);
      switch (outcome.status) {
        case 'done':
          if (outcome.importedDays > 0) markImported();
          markImportCompleted(rowCountBucket(outcome.sets));
          recachePredictionFromLatest(userId); // tomorrow's ghost reads the import
          hydrate(userId); // Today's store sees the history too
          setRefresh((n) => n + 1); // re-read → the cards replace this card
          return;
        case 'cancelled':
          // They closed the file picker. Not an error, not phrased as one.
          return;
        case 'invalid':
          setImportMessage(
            'That file is not a Hevy or Strong export. Look for the CSV the app emails you.',
          );
          return;
        default:
          setImportMessage('That file could not be read. You can try again.');
      }
    } finally {
      setImportBusy(false);
    }
  };

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
  const ranked = useMemo(() => sortLifts(view.lifts, sort), [view.lifts, sort]);
  // The summary's "moved most" is the biggest gainer, always — it answers a
  // question about the range, not about whatever order the list is in.
  const topMover = useMemo(() => {
    const best = sortLifts(view.lifts, 'gain')[0];
    return best && best.delta > 0 ? best : null;
  }, [view.lifts]);
  const metricLabel = METRICS.find((m) => m.key === metric)!.eyebrow;

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
            {importMessage ? (
              <Text style={styles.emptyMessage} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {importMessage}
              </Text>
            ) : null}
            <View style={styles.emptyActions}>
              <AppButton
                label={importBusy ? 'Reading your file…' : 'Import from Hevy or Strong'}
                variant="secondary"
                compact
                loading={importBusy}
                disabled={importBusy}
                onPress={() => void handleEmptyImport()}
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
                  accessibilityLabel={r.label}
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
            <SummaryCard
              view={view}
              top={topMover}
              metric={metric}
              metricLabel={metricLabel}
              rangeLabel={range.label}
              rangeAgo={range.ago}
              rangeDays={Math.min(range.days, historyDays + 1)}
            />

            {/* Order — the ranking is the default, never the only way in. */}
            <View style={styles.sortRow}>
              {SORTS.map((s) => {
                const active = s.key === sort;
                return (
                  <PressableScale
                    key={s.key}
                    haptic="none"
                    activeScale={0.96}
                    onPress={() => {
                      tap();
                      setSort(s.key);
                      setOpenKey(null);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Sort by ${s.label}`}
                    style={[styles.sortChip, active && styles.sortChipActive]}
                    pressedStyle={active ? undefined : styles.pressed}>
                    <Text
                      style={[styles.sortText, active && styles.sortTextActive]}
                      maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {s.label}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>

            {ranked.map((lift, i) => (
              <LiftCard
                key={lift.key}
                lift={lift}
                metric={metric}
                // The banner names what the sort just claimed, and only when the
                // claim is true: a "top mover" that lost weight is flattery.
                leading={i === 0 && sort === 'gain' && lift.delta > 0}
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

        {view.belowFloor.length > 0 ? (
          <FadeSlideIn>
            <View style={styles.building}>
              <Eyebrow>{`Not enough sessions yet · ${view.belowFloor.length}`}</Eyebrow>
              {view.belowFloor.map((lift) => (
                <BuildingRow
                  key={lift.key}
                  lift={lift}
                  metric={metric}
                  onPress={() => {
                    tap();
                    openExerciseSheet(lift.canonical);
                  }}
                />
              ))}
              <Text style={styles.buildingNote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Three sessions of the same lift inside this range and it gets its own chart.
              </Text>
            </View>
          </FadeSlideIn>
        ) : null}

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

/**
 * "How is it going?" — the whole range in one card, every figure counted from
 * stored sessions.
 *
 * The bar is the split (up / same / down) at a glance, and the line under it
 * says the same thing in words, because colour is never the only carrier of a
 * meaning (§14). Down segments draw in grey ink, not red: a deload is training,
 * and this screen does not grade a person.
 */
function SummaryCard({
  view,
  top,
  metric,
  metricLabel,
  rangeLabel,
  rangeAgo,
  rangeDays,
}: {
  view: ProgressionView;
  /** The biggest gainer, or null when nothing gained. */
  top: LiftProgression | null;
  metric: ProgressionMetric;
  metricLabel: string;
  rangeLabel: string;
  rangeAgo: string;
  /** Days of range actually backed by record — the divisor for the rate. */
  rangeDays: number;
}) {
  const perWeek =
    rangeDays >= MIN_DAYS_FOR_RATE ? (view.sessions / (rangeDays / 7)).toFixed(1) : null;
  const gap = view.longestGapDays;

  return (
    <View style={styles.summary}>
      <Eyebrow>{`${rangeLabel} · ${metricLabel}`}</Eyebrow>
      <Text style={styles.summaryLine} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {verdictLine(view.improved, view.counted, metric, rangeAgo)}
      </Text>

      <View
        style={styles.bar}
        accessible
        accessibilityRole="image"
        accessibilityLabel={splitLine(view)}>
        {view.improved > 0 ? (
          <View style={[styles.barSeg, styles.barUp, { flex: view.improved }]} />
        ) : null}
        {view.unchanged > 0 ? (
          <View style={[styles.barSeg, styles.barSame, { flex: view.unchanged }]} />
        ) : null}
        {view.declined > 0 ? (
          <View style={[styles.barSeg, styles.barDown, { flex: view.declined }]} />
        ) : null}
      </View>
      <Text style={styles.summarySplit} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {splitLine(view)}
      </Text>

      {top ? (
        <Text style={styles.summaryTop} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          <Text style={styles.summaryTopName}>{top.canonical}</Text>
          {` moved most — ${describeDelta(top.delta, 'kg', monthDay(top.firstDay), (n) =>
            formatValue(n, metric),
          )} since ${monthDay(top.firstDay)}.`}
        </Text>
      ) : null}

      <View style={styles.statRow}>
        <Stat
          label="Sessions"
          value={String(view.sessions)}
          sub={perWeek ? `${perWeek} / week` : undefined}
        />
        <Stat
          label="Longest gap"
          value={gap == null ? '—' : String(gap)}
          sub={gap == null ? undefined : gap === 1 ? 'day' : 'days'}
        />
        <Stat
          label="New bests"
          value={String(view.newBests)}
          sub={view.newBests === 1 ? 'lift' : 'lifts'}
        />
      </View>
    </View>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label.toUpperCase()}
      </Text>
      <Text style={styles.statValue} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {value}
      </Text>
      {sub ? (
        <Text style={styles.statSub} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

function LiftCard({
  lift,
  metric,
  leading,
  open,
  sets,
  onToggle,
  onOpenSession,
  onOpenHistory,
}: {
  lift: LiftProgression;
  metric: ProgressionMetric;
  leading: boolean;
  open: boolean;
  sets: WorkoutSet[];
  onToggle: () => void;
  onOpenSession: () => void;
  onOpenHistory: () => void;
}) {
  const delta = describeDelta(lift.delta, 'kg', monthDay(lift.firstDay), (n) =>
    formatValue(n, metric),
  );
  const share = percentText(lift.delta, lift.percent);
  const value = formatValue(lift.latest, metric);
  const up = lift.delta > 0;

  return (
    <View style={[styles.card, leading && styles.cardLeading]}>
      {leading ? (
        <Text style={styles.leadTag} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          BIGGEST GAIN
        </Text>
      ) : null}
      <PressableScale
        haptic="none"
        activeScale={0.99}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${lift.canonical}, ${value} kilograms, ${delta}, ${share}, ${lift.sessions} sessions`}
        style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={styles.cardName}>
            <View style={styles.nameLine}>
              <Text style={styles.liftName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {lift.canonical}
              </Text>
              <View style={[styles.shareChip, up && styles.shareChipUp]}>
                <Text
                  style={[styles.shareText, up && styles.shareTextUp]}
                  maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {share}
                </Text>
              </View>
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

        <TrendChart
          points={lift.points}
          best={lift.best}
          height={open ? CHART_H_OPEN : CHART_H}
          showPrevious={open}
          dots
          axis
          format={(n) => axisValue(n, metric)}
        />

        <View style={styles.ends}>
          <Text style={styles.endLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {monthDay(lift.firstDay)}
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

/** A lift with one or two sessions in range: named, counted, and openable —
 * just not charted, because two points are a line and not yet a trend. */
function BuildingRow({
  lift,
  metric,
  onPress,
}: {
  lift: LiftBrief;
  metric: ProgressionMetric;
  onPress: () => void;
}) {
  return (
    <PressableScale
      haptic="none"
      activeScale={0.99}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${lift.canonical}, ${lift.sessions} ${
        lift.sessions === 1 ? 'session' : 'sessions'
      }, latest ${formatValue(lift.latest, metric)} kilograms`}
      style={styles.buildRow}
      pressedStyle={styles.pressed}>
      <Text style={styles.buildName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {lift.canonical}
      </Text>
      <Text style={styles.buildMeta} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {`${lift.sessions} · ${formatValue(lift.latest, metric)} kg`}
      </Text>
    </PressableScale>
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
  // Blue is the active-control colour (§4.2), and the same blue draws the lines
  // below — the control and what it controls read as one system.
  segItemActive: {
    backgroundColor: color.trained,
  },
  segText: {
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
    fontSize: type.footnote.fontSize,
    fontWeight: '600',
    color: color.textSecondary,
  },
  segTextActive: {
    color: '#FFFFFF',
  },
  segTextOff: {
    color: color.textMuted,
    opacity: 0.5,
  },
  since: {
    fontFamily: fonts.reading,
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
    borderBottomColor: color.trained,
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

  // --- the summary ------------------------------------------------------------
  summary: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: alpha(color.trained, 0.22),
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  summaryLine: {
    ...type.lede,
    color: color.textPrimary,
  },
  bar: {
    flexDirection: 'row',
    gap: 3,
    marginTop: spacing.xs,
  },
  barSeg: {
    height: moderateScale(7),
    borderRadius: 4,
  },
  barUp: {
    backgroundColor: color.trained,
  },
  barSame: {
    backgroundColor: color.border,
  },
  // Grey ink, never red — a lift that fell is a fact, not a failure (§10).
  barDown: {
    backgroundColor: alpha(color.accent, 0.35),
  },
  summarySplit: {
    fontFamily: fonts.reading,
    fontSize: type.footnote.fontSize,
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  summaryTop: {
    ...type.footnote,
    color: color.textSecondary,
  },
  summaryTopName: {
    color: color.textPrimary,
    fontWeight: '600',
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: color.tableRule,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
    fontSize: moderateScale(9),
    letterSpacing: 1,
    color: color.textMuted,
  },
  statValue: {
    fontFamily: fonts.reading,
    fontSize: moderateScale(20),
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statSub: {
    fontFamily: fonts.reading,
    fontSize: moderateScale(10),
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },

  // --- sort chips -------------------------------------------------------------
  sortRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sortChip: {
    paddingVertical: spacing.sm - 3,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    minHeight: moderateScale(30),
    justifyContent: 'center',
  },
  sortChipActive: {
    backgroundColor: alpha(color.trained, 0.12),
    borderColor: alpha(color.trained, 0.45),
  },
  sortText: {
    ...type.caption,
    color: color.textSecondary,
  },
  sortTextActive: {
    color: color.trained,
    fontWeight: '600',
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
  cardLeading: {
    borderColor: alpha(color.trained, 0.35),
  },
  leadTag: {
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
    fontSize: moderateScale(9),
    letterSpacing: 1.2,
    fontWeight: '700',
    color: color.trained,
    marginBottom: spacing.sm,
  },
  cardBody: {
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
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  liftName: {
    ...type.subhead,
    flexShrink: 1,
    fontWeight: '600',
    color: color.textPrimary,
  },
  // The ranking's own reading. Blue when a lift gained, neutral when it held or
  // fell — the WORD carries the direction, so the chip never turns a deload red.
  shareChip: {
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: color.surfaceHigh,
  },
  shareChipUp: {
    backgroundColor: alpha(color.trained, 0.12),
  },
  shareText: {
    fontFamily: fonts.reading,
    fontSize: moderateScale(10.5),
    fontWeight: '600',
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  shareTextUp: {
    color: color.trained,
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
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
    fontSize: moderateScale(11),
    fontWeight: '700',
    letterSpacing: 0.5,
    color: color.textPrimary,
  },
  liftMeta: {
    fontFamily: fonts.reading,
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
    fontFamily: fonts.reading,
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
    fontFamily: fonts.reading,
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
    fontFamily: fonts.reading,
    fontSize: type.footnote.fontSize,
    color: color.textMuted,
    width: moderateScale(42),
    fontVariant: ['tabular-nums'],
  },
  setValue: {
    fontFamily: fonts.reading,
    fontSize: type.footnote.fontSize,
    flex: 1,
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  setEstimate: {
    fontFamily: fonts.reading,
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

  // --- lifts still building a record ------------------------------------------
  building: {
    gap: spacing.xs,
  },
  buildRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: moderateScale(40),
    marginHorizontal: -PRESS_BLEED,
    paddingHorizontal: PRESS_BLEED,
    borderRadius: radius.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.tableRule,
  },
  buildName: {
    ...type.subhead,
    flexShrink: 1,
    color: color.textPrimary,
  },
  buildMeta: {
    fontFamily: fonts.reading,
    fontSize: moderateScale(11),
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  buildingNote: {
    ...type.caption,
    marginTop: spacing.xs,
    color: color.textMuted,
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
  emptyMessage: {
    ...type.footnote,
    color: color.textSecondary,
  },
  emptyActions: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
});
