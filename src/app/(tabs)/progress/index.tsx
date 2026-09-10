import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Sparkline } from '@/components/charts';
import { Icon } from '@/components/icon';
import { E1RM_ACTION_LABEL, E1RM_LABEL, E1rmSheet } from '@/components/e1rm-sheet';
import { FadeSlideIn, PressableScale, Stagger } from '@/components/motion';
import { AppButton, Eyebrow, Row } from '@/components/primitives';
import { PeriodChart } from '@/components/progression/period-chart';
import { lastDayPhrase } from '@/lib/day-phrase';
import { monthDayLabel, shiftDayKey, todayKey } from '@/lib/db/dates';
import { getLiftSessions } from '@/lib/db/progression';
import { markImportCompleted, markImported, markImportStarted } from '@/lib/funnel';
import { selection, tap } from '@/lib/haptics';
import { pickAndImportCsv } from '@/lib/import/pick';
import { stagger } from '@/lib/motion';
import { rowCountBucket } from '@/lib/onboarding';
import { PAPER_FIELD_CSS } from '@/lib/paper-field';
import { groupThousands } from '@/lib/parse/estimate';
import { fmtNumber } from '@/lib/parse/summarize';
import { STALL_SESSIONS } from '@/lib/plateau';
import { recachePredictionFromLatest } from '@/lib/predict/cache';
import { getWeightUnit } from '@/lib/prefs';
import { describeDelta } from '@/lib/progression';
import { buildOverview, type LiftRow } from '@/lib/progression-overview';
import {
  buildPeriod,
  changePercent,
  metricOf,
  splitShares,
  WEEK_DAYS,
  type PeriodMetric,
  type WindowTotals,
} from '@/lib/progress-summary';
import {
  alpha,
  color,
  hairline,
  ink,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  spacing,
  TAB_BAR_CLEARANCE,
  type,
} from '@/lib/theme';
import { displayLoad, spokenUnit, type WeightUnit } from '@/lib/units';
import { labelForDay, useSession } from '@/state/session-store';

/**
 * PROGRESS — "am I actually improving?" (CLAUDE.md §5.1; rebuilt 9 September
 * 2026 on the system navigator, with a hero the tab did not have).
 *
 * ## What the rebuild changed, and why the list alone was not enough
 *
 * Until today this screen was a list and nothing else: every lift in the last
 * eight weeks as a bare row, a chip row of the athlete's own groups over the
 * top, and a hand-drawn header. It answered "which lift moved" well, and it had
 * no answer at all for the question a person actually opens the tab with —
 * *is this month more than the last one?* Twelve rows cannot say that. Only the
 * weeks themselves can, so the weeks are now the top of the screen
 * (`lib/progress-summary.ts` does the arithmetic; nothing here computes).
 *
 * The screen reads top to bottom as three questions, each answered once:
 *
 *   1. **Is it adding up?**  eight weeks as eight columns, one reading over them
 *   2. **Where does it go?**  the split, as a share of training days
 *   3. **Which lift?**       the record itself, as bare rows
 *
 * ## The chrome is UIKit's now, search included
 *
 * `StubScreen` is gone from this tab, and with it the last hand-rolled large
 * title in the app (`_layout.tsx` has the three behaviours that bought). The
 * search field went with it: it was a `TextInput` styled as a pill above the
 * list, and it is now `headerSearchBarOptions` — a real `UISearchController`
 * that hides until the page is pulled down, brings its own Cancel button, and
 * dismisses its keyboard the way every other iOS list does.
 *
 * ## The group chips became the split, and the split filters
 *
 * The old chip row was the only place the clusters appeared, and it spent a
 * full row of the screen saying nothing except "these exist". As a strip of
 * shares it says the same names AND how the training divides between them —
 * which is a fact about the record that nothing else on the screen carries —
 * and it still filters the list, which sits directly under it so the effect is
 * never off-screen. One control, one home, two jobs it was already halfway
 * doing.
 *
 * ## What did NOT arrive, and stays out
 *
 * A movers block. `lib/progression-overview.ts` records the ruling: every lift
 * in this list already carries a delta and a sparkline over a named window, and
 * a "top three movers" section would be a second answer to a question already
 * answered on the same screen. The hero is not that — it is the only thing here
 * measuring the WINDOW rather than a lift.
 */

/** Eight weeks. One window, named once — the hero, the groups, every lift row
 * and level two all measure the same stretch. */
const RANGE_WEEKS = 8;
const RANGE_DAYS = RANGE_WEEKS * WEEK_DAYS;

/** Below this many lifts a search field is furniture, not a tool — the same
 * floor the Lifts screen uses, so the two behave alike. */
const SEARCH_FLOOR = 7;

/** The chip that clears the group filter. Not a group, so it cannot collide
 * with one named after a lift. */
const ALL = '__all__';

const SPARK_W = moderateScale(54);
const SPARK_H = moderateScale(26);

/**
 * The row cadence, named once so the sparkline can ride it.
 *
 * `Stagger` below is given exactly these numbers, and each line then starts
 * `ROW_STAGGER_LEAD` after its own row's entrance began — far enough behind
 * that the row has arrived and the pen is drawing on something already there,
 * close enough that it reads as one event rather than as a chart animating by
 * itself.
 */
const ROW_STAGGER = 40;
const ROW_STAGGER_CAP = 8;
const ROW_STAGGER_LEAD = 150;

/** The three series the hero can plot, in the order the control offers them:
 * how much, how often, how many different things. */
const METRICS: { key: PeriodMetric; label: string }[] = [
  { key: 'volume', label: 'Volume' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'lifts', label: 'Lifts' },
];

/**
 * The row's second line: how far it moved, then how much record there is.
 * `describeDelta` owns the phrasing, so a deload never arrives as "−5 kg".
 *
 * A PLATEAU LEADS IT. A lift that has not moved in three sessions was reading
 * "12 sessions · last Tue" here, which is the one thing about it that is not
 * worth knowing; the plateau is the fact that changes what the athlete does.
 *
 * A delta the guard refuses is spoken as a direction and printed as no figure
 * (`deltaSuspect`). **It carries the unit the reading above it carries** — a row
 * reading `est. 1RM 308 lb` over "up 16.5 kg" would be one lift quoted in two
 * systems.
 */
function detailOf(l: LiftRow, unit: WeightUnit): string {
  const count = `${l.sessions} ${l.sessions === 1 ? 'session' : 'sessions'}`;
  // "last Today" is the same defect as "on Today": a relative word already
  // says when, so `last` falls away with it (`lib/day-phrase.ts`).
  const when = lastDayPhrase(labelForDay(l.lastDay));
  if (l.stalledAt != null) {
    return `${STALL_SESSIONS} sessions at ${fmtNumber(displayLoad(l.stalledAt, unit))} ${unit} · ${when}`;
  }
  if (l.delta == null) return `${count} · ${when}`;
  if (l.deltaSuspect) {
    return `${l.direction === 'down' ? 'falling' : 'climbing'} · ${count} · ${when}`;
  }
  return `${describeDelta(displayLoad(l.delta, unit), unit, 'the first', fmtNumber)} · ${count} · ${when}`;
}

/** The hero's reading: the figure, and the word that says what it counts. */
function readingOf(
  t: WindowTotals,
  metric: PeriodMetric,
  unit: WeightUnit,
): { value: string; word: string } {
  if (metric === 'volume') {
    return { value: groupThousands(displayLoad(t.volume, unit)), word: unit };
  }
  if (metric === 'sessions') {
    return { value: String(t.sessions), word: t.sessions === 1 ? 'day' : 'days' };
  }
  return { value: String(t.lifts), word: t.lifts === 1 ? 'lift' : 'lifts' };
}

/**
 * The line under the reading — the two facts the reading is NOT showing.
 *
 * It exists so the line is never empty. A supporting line that appears and
 * disappears as a finger moves across the chart would move the chart itself,
 * and a chart that jumps while it is being read is worse than one that says
 * less.
 */
function supportOf(t: WindowTotals, metric: PeriodMetric, unit: WeightUnit): string {
  const days = `${t.sessions} training ${t.sessions === 1 ? 'day' : 'days'}`;
  const lifts = `${t.lifts} ${t.lifts === 1 ? 'lift' : 'lifts'}`;
  const volume = `${groupThousands(displayLoad(t.volume, unit))} ${unit}`;
  if (metric === 'volume') return `${days} · ${lifts}`;
  if (metric === 'sessions') return `${volume} · ${lifts}`;
  return `${days} · ${volume}`;
}

/**
 * How this window compares with the one before it, in words.
 *
 * **No colour on it, deliberately.** Volume down eight per cent is a deload as
 * often as it is a decline, and the app does not know which — tinting it red
 * would be the model of coaching CLAUDE.md §2 rule 6 exists to keep out. The
 * sentence states the direction and stops.
 */
function comparisonOf(now: number, before: number | null): string | null {
  if (before == null) return null;
  const pct = changePercent(now, before);
  if (pct == null) return null;
  if (pct === 0) return `Level with the previous ${RANGE_WEEKS} weeks`;
  const way = pct > 0 ? 'Up' : 'Down';
  return `${way} ${Math.abs(pct)}% on the previous ${RANGE_WEEKS} weeks`;
}

export default function Progress() {
  const router = useRouter();
  const userId = useSession((s) => s.userId);
  const hydrate = useSession((s) => s.hydrate);

  // Cheap synchronous SQLite reads — re-run on every focus so a CSV import or a
  // session finished on Today lands here without a relaunch.
  const [refresh, setRefresh] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setRefresh((n) => n + 1);
    }, []),
  );

  const [metric, setMetric] = useState<PeriodMetric>('volume');
  /** The week under a finger, or null for the whole window. Transient by
   * design — `period-chart.tsx` says why it is not sticky. */
  const [week, setWeek] = useState<number | null>(null);
  const [group, setGroup] = useState<string>(ALL);
  const [query, setQuery] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  /** The explainer behind `est. 1RM`. One sheet for the whole list — the copy
   * does not vary by lift, so fifty rows do not need fifty of them. */
  const [explainE1rm, setExplainE1rm] = useState(false);

  /**
   * The athlete's display unit, re-read on every focus alongside the record.
   *
   * The setting lives in You, which is a different tab, so coming back here is
   * always a focus. Storage stays kilograms (`lib/units.ts`); this is a display
   * concern and never touches what was written down.
   */
  /* eslint-disable react-hooks/exhaustive-deps */
  const unit = useMemo<WeightUnit>(() => getWeightUnit() ?? 'kg', [refresh]);
  const rows = useMemo(() => (userId ? getLiftSessions(userId) : []), [userId, refresh]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const today = todayKey();
  const fromDay = shiftDayKey(today, -(RANGE_DAYS - 1));
  const view = useMemo(() => buildOverview(rows, fromDay), [rows, fromDay]);
  const period = useMemo(() => buildPeriod(rows, today, RANGE_WEEKS), [rows, today]);

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
          setRefresh((n) => n + 1); // re-read → the list replaces this card
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

  // §12.1: an empty state says what will fill it and never reports a lack. It
  // keeps the real screen's shell — same navigator options, same root scroll
  // view — so nothing reflows when the first session lands.
  if (rows.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Progress', headerLargeTitle: true }} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}>
          <FadeSlideIn>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Your training, measured.
              </Text>
              <Text style={styles.emptyBody} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Log one session — or import your history — and this page fills in: eight weeks of
                training at the top, then every lift you name with where it started and where it is
                now.
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
        </ScrollView>
      </>
    );
  }

  // --- the hero -------------------------------------------------------------

  const shownWeek = week != null ? period.weeks[week] : undefined;
  const totals: WindowTotals = shownWeek ?? period.now;
  const reading = readingOf(totals, metric, unit);
  const eyebrow = shownWeek
    ? `${monthDayLabel(shownWeek.start)} – ${monthDayLabel(shownWeek.end)}`
    : `Last ${RANGE_WEEKS} weeks`;
  const comparison = comparisonOf(
    metricOf(period.now, metric),
    period.before ? metricOf(period.before, metric) : null,
  );
  const support = shownWeek
    ? shownWeek.sessions === 0
      ? 'No sessions written'
      : supportOf(shownWeek, metric, unit)
    : (comparison ?? supportOf(period.now, metric, unit));

  const bars = period.weeks.map((w) => {
    const r = readingOf(w, metric, unit);
    const range = `${monthDayLabel(w.start)} to ${monthDayLabel(w.end)}`;
    return {
      value: metricOf(w, metric),
      spoken:
        w.sessions === 0
          ? `${range}, no sessions written`
          : `${range}, ${r.value} ${metric === 'volume' ? spokenUnit(unit) : r.word}, ${supportOf(
              w,
              metric,
              unit,
            )}`,
    };
  });

  // --- the split and the list ----------------------------------------------

  const split = splitShares(view.groups);
  // A group that vanishes (the record re-clustered after a new session) falls
  // back to All rather than filtering the list down to nothing.
  const activeGroup = group !== ALL && split.some((g) => String(g.id) === group) ? group : ALL;
  const needle = query.trim().toLowerCase();
  const shown = view.lifts.filter((l) => {
    if (activeGroup !== ALL) {
      const g = view.groups.find((x) => String(x.id) === activeGroup);
      if (g && !g.liftKeys.includes(l.key)) return false;
    }
    return needle === '' || l.canonical.toLowerCase().includes(needle);
  });

  const subtitle = `${view.lifts.length} ${
    view.lifts.length === 1 ? 'lift' : 'lifts'
  } · ${view.sessions} training ${view.sessions === 1 ? 'day' : 'days'}`;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Progress',
          headerLargeTitle: true,
          // UIKit's own search controller, and only once there is enough record
          // for finding to beat scrolling.
          headerSearchBarOptions:
            view.lifts.length >= SEARCH_FLOOR
              ? {
                  placeholder: 'Search your lifts',
                  // The Notes/Mail idiom: the field is there at the top of the
                  // page and gives its 52 pt back the moment the record starts
                  // moving. Pinned (`false`) it would spend that height on
                  // every screen of a list somebody is scrolling THROUGH, and
                  // finding a lift is not what this tab is mostly for.
                  hideWhenScrolling: false,
                  autoCapitalize: 'none',
                  onChangeText: (e) => setQuery(e.nativeEvent.text),
                  onCancelButtonPress: () => setQuery(''),
                }
              : undefined,
        }}
      />

      {/* THE SCROLL VIEW IS THE SCREEN'S ROOT, and that is load-bearing rather
          than tidy — `_layout.tsx` explains what UIKit does with it and what it
          cannot do without it. `automatic` hands the insets to the system. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {subtitle}
        </Text>

        {/* --- 1. IS IT ADDING UP? ------------------------------------------ */}
        <View style={styles.hero}>
          <View style={styles.metrics} accessibilityRole="tablist">
            {METRICS.map((m) => (
              <MetricTab
                key={m.key}
                label={m.label}
                active={metric === m.key}
                onPress={() => {
                  if (metric === m.key) return;
                  selection();
                  setMetric(m.key);
                }}
              />
            ))}
          </View>

          <Text style={styles.heroEyebrow} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {eyebrow.toUpperCase()}
          </Text>
          {/* ONE TEXT NODE, NOT A ROW. The unit was a sibling `Text` in a flex
              row with `flexShrink` on the number, and at the Dynamic Type
              ceiling that arrangement collapsed the number to six points beside
              a 33 pt "kg" — photographed at accessibility-extra-large on the
              iOS 26.5 simulator, 9 September 2026. Nested, iOS scales the whole
              line as one string and puts the unit on the number's own baseline,
              which is what the pair is: a reading, not two labels. */}
          <Text
            style={styles.reading}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {reading.value}
            <Text style={styles.readingUnit}> {reading.word}</Text>
          </Text>
          <Text style={styles.support} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {support}
          </Text>

          <PeriodChart
            bars={bars}
            selected={week}
            onSelect={setWeek}
            startLabel={monthDayLabel(period.from)}
            endLabel={monthDayLabel(period.to)}
          />
        </View>

        {/* --- 2. WHERE DOES IT GO? ----------------------------------------- */}
        {split.length > 1 ? (
          <View style={styles.section}>
            <Eyebrow>How your training splits</Eyebrow>
            {split.map((g) => (
              <SplitRow
                key={g.id}
                name={g.name}
                sessions={g.sessions}
                share={g.share}
                active={activeGroup === String(g.id)}
                onPress={() => {
                  selection();
                  setGroup((cur) => (cur === String(g.id) ? ALL : String(g.id)));
                }}
              />
            ))}
            {/* The grouping is derived, so it says where it came from. A label
                a person cannot account for reads as a category we imposed. */}
            <Text style={styles.note} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Grouped by what you train together, named after the lift you do most in each.
            </Text>
          </View>
        ) : null}

        {/* --- 3. WHICH LIFT? ----------------------------------------------- */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Eyebrow>Your lifts</Eyebrow>
            {activeGroup !== ALL ? (
              <Pressable
                onPress={() => {
                  tap();
                  setGroup(ALL);
                }}
                hitSlop={spacing.md}
                accessibilityRole="button"
                accessibilityLabel="Show all lifts"
                accessibilityHint="Clears the training-split filter">
                <Text style={styles.showAll} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  Show all
                </Text>
              </Pressable>
            ) : null}
          </View>

          {shown.length === 0 ? (
            <Text style={styles.thin} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {needle ? `Nothing matches “${query.trim()}”.` : 'No lifts in this group yet.'}
            </Text>
          ) : (
            <Stagger step={ROW_STAGGER} initialDelay={ROW_STAGGER_LEAD - 90}>
              {shown.map((l, i) => (
                <Row
                  key={l.key}
                  name={l.canonical}
                  // A plateau is the app's one amber state, here as everywhere.
                  tone={l.stalledAt != null ? 'attention' : 'ink'}
                  detail={detailOf(l, unit)}
                  // THE READING SAYS WHAT IT IS (4 September 2026). It is an
                  // Epley estimate off the best counted set, and printed bare it
                  // was read as the load on the bar.
                  valueLabel={l.latest != null ? E1RM_LABEL : undefined}
                  value={l.latest != null ? fmtNumber(displayLoad(l.latest, unit)) : undefined}
                  unit={l.latest != null ? unit : undefined}
                  onValuePress={l.latest != null ? () => setExplainE1rm(true) : undefined}
                  valueActionLabel={E1RM_ACTION_LABEL}
                  spoken={[
                    l.canonical,
                    l.latest != null
                      ? `estimated one rep max, ${fmtNumber(displayLoad(l.latest, unit))} ${spokenUnit(unit)}`
                      : 'no estimate yet',
                    detailOf(l, unit),
                  ].join(', ')}
                  trailing={
                    l.spark.length > 1 ? (
                      <Sparkline
                        values={l.spark}
                        width={SPARK_W}
                        height={SPARK_H}
                        tint={color.brand}
                        wash
                        // Each line draws just after its own row has landed, so
                        // the list writes itself down the screen instead of
                        // arriving with eight finished decorations on it.
                        delay={ROW_STAGGER_LEAD + stagger(i, ROW_STAGGER, ROW_STAGGER_CAP)}
                      />
                    ) : (
                      // A lift with one reading has no line to draw. The slot is
                      // held so the column of readings stays a column.
                      <View style={styles.sparkHole} />
                    )
                  }
                  onPress={() => {
                    tap();
                    router.push({ pathname: '/lift/[key]', params: { key: l.key } });
                  }}
                />
              ))}
            </Stagger>
          )}
        </View>

        <PressableScale
          haptic="none"
          activeScale={0.98}
          onPress={() => {
            tap();
            router.push('/lifts');
          }}
          accessibilityRole="button"
          accessibilityLabel="All lifts"
          accessibilityHint="Every lift you have ever logged, including outside these eight weeks"
          style={styles.allLiftsRow}>
          <Text style={styles.allLiftsLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            All lifts
          </Text>
          <Icon name="chevron-forward" size={moderateScale(14)} tint={color.textSecondary} />
        </PressableScale>
      </ScrollView>

      <E1rmSheet visible={explainE1rm} onClose={() => setExplainE1rm(false)} />
    </>
  );
}

/**
 * The hero's metric switch.
 *
 * It is a row of quiet text tabs rather than `ChipRow`, and the reason is what
 * it sits on top of. `ChipRow` is a row of white floating pills with a shadow
 * each — the right control under a large title where it is the only thing on
 * the page, which is how Next uses it. Here it would put three raised surfaces
 * immediately above a chart, and the chart is the object; three pills competing
 * with it is the "assembled from parts" look the anti-slop laws name. So the
 * selected tab is stated the cheapest way that still measures: the app's one
 * blue on the label, and the label a step heavier.
 */
function MetricTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={spacing.sm}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}>
      <Text
        style={[styles.metricTab, active && styles.metricTabOn]}
        maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * One training group: its name, how much of the record it is, and how many days
 * that was.
 *
 * The bar is INK, like the columns above it — it is data. The selected state is
 * a brand wash, like every other selected control in the app — it is a control.
 * Keeping those two languages apart is what stops a filter row from reading as
 * a second, differently-coloured chart.
 */
function SplitRow({
  name,
  sessions,
  share,
  active,
  onPress,
}: {
  name: string;
  sessions: number;
  share: number;
  active: boolean;
  onPress: () => void;
}) {
  const percent = Math.round(share * 100);
  return (
    <PressableScale
      haptic="none"
      activeScale={0.99}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${name}, ${percent} per cent of your training, ${sessions} ${
        sessions === 1 ? 'day' : 'days'
      }`}
      accessibilityHint={active ? 'Shows every lift again' : 'Shows only the lifts in this group'}
      style={[styles.splitRow, active && styles.splitRowOn]}>
      <View style={styles.splitHead}>
        <Text
          style={[styles.splitName, active && styles.splitNameOn]}
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {name}
        </Text>
        <Text style={styles.splitCount} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {sessions} {sessions === 1 ? 'day' : 'days'}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.trackFill, { width: `${Math.max(2, percent)}%` }]} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  /**
   * THE CANVAS IS THE SCROLL VIEW'S OWN BACKGROUND, and that is the whole
   * reason this screen can have both a paper canvas and a collapsing title.
   * `_layout.tsx` has the measurement.
   */
  scroll: {
    flex: 1,
    experimental_backgroundImage: PAPER_FIELD_CSS,
  },
  /**
   * ONE GUTTER, AND EVERYTHING HANGS OFF IT — `spacing.lg`, not the body's
   * usual `spacing.xxl`, because the system's large title hangs off its own
   * inset and content 8 pt further in would give the page two left edges.
   */
  content: {
    paddingHorizontal: spacing.lg,
    // The top is UIKit's now (`contentInsetAdjustmentBehavior`), but the bottom
    // is not: content scrolls BEHIND the glass tab bar so the bar has something
    // to refract (§5.2), and the last row clears it by hand.
    paddingBottom: spacing.huge + TAB_BAR_CLEARANCE,
    gap: spacing.xxl,
  },
  /** What there is to look at, in one line under the system title. It hugs the
   * title — no top gap of its own — because a large title and its supporting
   * line are one block. */
  subtitle: {
    ...type.subhead,
    // NO FIXED LINE BOX: `lineFor()` scales for the DEVICE, not for Dynamic
    // Type, so at the ×1.5 cap a 15 pt line in a 21 pt box loses its descenders.
    lineHeight: undefined,
    marginBottom: -spacing.md,
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },

  // --- the hero ----------------------------------------------------------------
  hero: {
    gap: spacing.sm,
  },
  metrics: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginBottom: spacing.xs,
  },
  metricTab: {
    ...type.subhead,
    fontWeight: '600',
    // `textSecondary`, never `textMuted`: an unselected tab is a control the
    // eye is meant to find, and muted is the ladder's rung for what it may skip.
    color: color.textSecondary,
  },
  metricTabOn: {
    color: color.brand,
    fontWeight: '700',
  },
  heroEyebrow: {
    ...type.footnote,
    ...readingStyle('600'),
    fontSize: type.footnote.fontSize,
    letterSpacing: 1.6,
    color: color.textSecondary,
  },
  /**
   * NO `lineHeight` ON THIS ONE, and it is not an oversight.
   *
   * `adjustsFontSizeToFit` and an explicit line height cannot both be honoured:
   * UIKit is asked to fit the glyphs to a box whose height is already pinned,
   * gives up, and drops straight to `minimumFontScale`. Photographed at
   * accessibility-extra-large on the iOS 26.5 simulator, 9 September 2026 —
   * "60,464 kg" rendered at about six points in the bottom-left corner of a
   * 78 pt empty box. Without it the font's own metrics size the line, which is
   * what a single reading wants anyway.
   */
  reading: {
    ...readingStyle('700'),
    fontSize: type.heroNumber.fontSize,
    letterSpacing: type.heroNumber.letterSpacing,
    color: color.textPrimary,
    marginTop: -spacing.xs,
  },
  /** The unit, INSIDE the reading. A step smaller, a step lighter and a step
   * quieter than the number — "number and unit are typographically two things"
   * (skill §Structure) — but one line, so it can never drift off the baseline
   * or steal width from the figure it belongs to. */
  readingUnit: {
    ...readingStyle('500'),
    fontSize: type.title2.fontSize,
    color: color.textSecondary,
  },
  support: {
    ...type.subhead,
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
    marginBottom: spacing.sm,
  },

  // --- sections ----------------------------------------------------------------
  section: {
    gap: spacing.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  showAll: {
    ...type.subhead,
    fontWeight: '600',
    color: color.brand,
  },
  note: {
    ...type.footnote,
    color: color.textMuted,
    marginTop: spacing.xs,
  },
  thin: {
    ...type.body,
    color: color.textSecondary,
  },

  // --- the split ---------------------------------------------------------------
  splitRow: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
    // The wash reaches into the gutter so a selected row reads as a highlighted
    // band rather than as a box inset from the page; the text stays on the
    // page's own left edge either way.
    paddingHorizontal: spacing.md,
    marginHorizontal: -spacing.md,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
  },
  splitRowOn: {
    backgroundColor: alpha(color.brand, 0.1),
  },
  splitHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  splitName: {
    ...type.headline,
    color: color.textPrimary,
    flexShrink: 1,
  },
  splitNameOn: {
    fontWeight: '700',
  },
  splitCount: {
    ...type.subhead,
    ...readingStyle('500'),
    fontSize: type.subhead.fontSize,
    color: color.textSecondary,
  },
  track: {
    height: moderateScale(5),
    borderRadius: moderateScale(2.5),
    backgroundColor: alpha(color.accent, ink.wash),
    overflow: 'hidden',
  },
  /**
   * Ink at `value`, not at full strength. Full black is what the chart above
   * spends on THIS WEEK — the one mark on the screen that means "now" — and a
   * share bar borrowing it would make three equal groups shout as loudly as the
   * week the athlete is living in.
   */
  trackFill: {
    height: '100%',
    borderRadius: moderateScale(2.5),
    backgroundColor: alpha(color.accent, ink.value),
  },

  // --- the list ----------------------------------------------------------------
  sparkHole: {
    width: SPARK_W,
    height: SPARK_H,
  },
  allLiftsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: hairline,
    borderTopColor: color.border,
  },
  allLiftsLabel: {
    ...type.headline,
    color: color.textPrimary,
  },

  // --- empty state -------------------------------------------------------------
  emptyCard: {
    gap: spacing.sm,
  },
  emptyTitle: {
    ...type.title2,
    color: color.textPrimary,
  },
  emptyBody: {
    ...type.body,
    color: color.textSecondary,
  },
  emptyMessage: {
    ...type.subhead,
    color: color.attention,
    marginTop: spacing.sm,
  },
  emptyActions: {
    marginTop: spacing.lg,
    alignItems: 'flex-start',
  },
});
