import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { TrendChart } from '@/components/charts';
import { ChipRow } from '@/components/chip-row';
import { Icon } from '@/components/icon';
import { FadeSlideIn, PressableScale, Stagger } from '@/components/motion';
import { AppButton, Badge, Eyebrow } from '@/components/primitives';
import { StubScreen } from '@/components/stub-screen';
import { shiftDayKey, todayKey, type DayKey } from '@/lib/db/dates';
import { getWorkoutDetail, type WorkoutSet } from '@/lib/db/insights';
import { getLiftSessions } from '@/lib/db/progression';
import { mondayOf } from '@/lib/db/stats';
import { markImportCompleted, markImported, markImportStarted } from '@/lib/funnel';
import { tap } from '@/lib/haptics';
import { pickAndImportCsv } from '@/lib/import/pick';
import { rowCountBucket } from '@/lib/onboarding';
import { recachePredictionFromLatest } from '@/lib/predict/cache';
import { fmtNumber } from '@/lib/parse/summarize';
import {
  buildProgression,
  daysBetween,
  describeDelta,
  describeStall,
  sortLifts,
  stallOf,
  STALL_RUN_MIN,
  type LiftBrief,
  type LiftProgression,
  type LiftSort,
} from '@/lib/progression';
import {
  alpha,
  color,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  shadow,
  spacing,
  TAB_BAR_CLEARANCE,
  type,
} from '@/lib/theme';
import { labelForDay, useSession } from '@/state/session-store';

/**
 * Progression (product-direction §10 — "Am I progressing, and what is the
 * evidence?"), the third tab.
 *
 * The screen is **one card per lift**, and it answers exactly one question at a
 * time by re-ordering, never by re-labelling:
 *
 *   a counted cadence line  →  four orderings  →  ranked cards
 *   →  the sets behind the latest point
 *
 * ## The 17 August shape (owner mockup)
 *
 * 1. **One reading, no chrome.** The range picker (8W / 6M / 1Y) and the metric
 *    tabs (Est. 1RM / Heaviest / Volume) are gone, and so is the summary card.
 *    The screen is eight weeks of estimated 1RM, full stop, and the header's
 *    one counted line stands in for the summary. Every figure a person reads
 *    here is now about the same window, which is the thing three simultaneous
 *    switches kept costing.
 * 2. **A fourth ordering: Stalled.** "What is stuck?" is the other half of "am
 *    I progressing?", and it should not require reading to the bottom of a list
 *    sorted the other way. It re-orders on the TAIL of each series
 *    (`stallOf`) — falling first, then held longest — and re-labels nothing.
 * 3. **Direction is a colour now, as well as a word** — reversing the §10 rule
 *    that a lift which fell drew in exactly the same blue as one that rose.
 *    Gains are `color.gain`, regressions `color.loss`, and the mockup's own
 *    caption is the guard rail: **red only when truly regressing**. A single
 *    lighter session is ink; `STALL_RUN_MIN` consecutive drops is red. A lift
 *    holding its load is ink and an em-dash, never red — maintenance is not
 *    failure. The words ("up 12%", "down 5%", "no change in 4 sessions") say
 *    the same thing beside every one of those colours, so colour is never the
 *    only carrier (§14).
 *
 * A card carries a LINE chart in **the brand blue** — straight segments between
 * real sessions, up and down (owner, 4 Aug 2026; `TrendChart`'s `shape` prop
 * restores the §10 step in one word). The line was one neutral ink until
 * 20 Aug 2026; v6 gives a recorded progression the app's one blue, which is
 * the single place a hue earns a LINE (design skill §Reuse). The rule the ink
 * was protecting is untouched: **only the terminal dot takes a direction hue**,
 * the eight weeks behind it are the shape of the record, and one dot answers
 * "and now?". Its two ends read `date · value`, so the chart's own numbers sit
 * under the chart rather than in a gutter beside it.
 *
 * Tapping a card opens the set table of the session that made its last point.
 * Lifts too shallow to chart are listed below the cards rather than dropped, so
 * nothing a person logged disappears from their own record.
 *
 * Both sheets it opens (`ExerciseSheet`, `SessionSheet`) are mounted once in
 * `_layout.tsx`, so this file only dispatches.
 */

/** Eight weeks. One window, named once — the header, the cards and the cadence
 * average all measure the same stretch because they all read this. */
const RANGE_DAYS = 56;

const SORTS: { key: LiftSort; label: string }[] = [
  { key: 'gain', label: 'Biggest gain' },
  { key: 'recent', label: 'Recent' },
  { key: 'stalled', label: 'Stalled' },
  { key: 'name', label: 'A–Z' },
];

const CHART_H = moderateScale(64);
const CHART_H_OPEN = moderateScale(104);
/** Beyond this the rep cap makes an Epley estimate dishonest (matches the
 * parser-side rule in `getE1rmSeries`). */
const E1RM_REP_CAP = 12;
/** Under two weeks of record a per-week average is arithmetic noise, so the
 * cadence line drops it rather than dividing by a fortnight it never had. */
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

/** Which way a card reads. `flat` is the ink default — it is also what a single
 * lighter session gets, because one session is not a trend (`STALL_RUN_MIN`). */
type Tone = 'up' | 'down' | 'flat';

/** "Jul 13" from a DayKey — a chart endpoint, never a full date. */
function monthDay(day: DayKey): string {
  const [, m, d] = day.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}`;
}

/**
 * The share a lift moved, as a WORD — the same ruling `describeDelta` keeps
 * (§5.1): never a leading minus. Sub-1% moves say so instead of rounding
 * themselves to "same", which would make a chip disagree with the chart above
 * it. Returns null when nothing moved: the mockup shows no chip at all there,
 * and an "up 0%" chip is noise pretending to be news.
 */
function percentText(delta: number, percent: number): string | null {
  if (delta === 0) return null;
  const dir = delta > 0 ? 'up' : 'down';
  const size = Math.abs(percent);
  if (size === 0) return dir; // a move with no starting value to be a share of
  if (size < 1) return `${dir} <1%`;
  return `${dir} ${Math.round(size)}%`;
}

/**
 * The one counted line under the title. Two facts, both distinct training days
 * off stored rows: this calendar week, and the average per week across as much
 * of the window as the record actually reaches back (so a three-week-old
 * account never reads "8-week average"). No model, no adjectives (§2, rule 6).
 */
function cadenceLine(days: string[], today: DayKey, historyDays: number): string | undefined {
  if (days.length === 0) return undefined;
  const monday = mondayOf(today);
  const thisWeek = days.filter((d) => d >= monday).length;
  const head =
    thisWeek === 0
      ? 'No sessions yet this week'
      : `${thisWeek} ${thisWeek === 1 ? 'session' : 'sessions'} this week`;
  if (historyDays < MIN_DAYS_FOR_RATE) return head;
  const weeks = Math.min(8, Math.max(1, Math.round((historyDays + 1) / 7)));
  return `${head} · ${weeks}-week average ${(days.length / weeks).toFixed(1)}`;
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
  // The whole aggregated history, once. The window and every ordering are
  // derived from it in pure code, so switching a chip costs no query.
  const rows = useMemo(() => (userId ? getLiftSessions(userId) : []), [userId, refresh]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const today = todayKey();
  const fromDay = shiftDayKey(today, -RANGE_DAYS);
  // Rows arrive oldest-first, so the first row is where the record begins.
  const historyDays = rows.length > 0 ? daysBetween(rows[0]!.day, today) : 0;

  const view = useMemo(() => buildProgression(rows, 'e1rm', fromDay), [rows, fromDay]);
  const ranked = useMemo(() => sortLifts(view.lifts, sort), [view.lifts, sort]);

  // Distinct training days inside the window — the cadence line's only input.
  const trainedDays = useMemo(
    () => Array.from(new Set(rows.filter((r) => r.day >= fromDay).map((r) => r.day))),
    [rows, fromDay],
  );
  const cadence = cadenceLine(trainedDays, today, Math.min(RANGE_DAYS, historyDays));

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
      <StubScreen title="Progression" back={false} large>
        <FadeSlideIn>
          <View style={styles.emptyCard}>
            <Eyebrow>Progression</Eyebrow>
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
    <StubScreen title="Progression" subtitle={cadence} back={false} large>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* Order — the ranking is the default, never the only way in. The
            control itself is `ChipRow`, shared with the Next tab's split days
            since 18 Aug: one pill row in the app, not two that drifted. */}
        <ChipRow
          items={SORTS.map((s) => ({ key: s.key, label: s.label, spoken: `Sort by ${s.label}` }))}
          activeKey={sort}
          onSelect={(key) => {
            setSort(key as LiftSort);
            setOpenKey(null);
          }}
          hint="Re-orders the lifts below"
        />

        {view.counted === 0 ? (
          <FadeSlideIn>
            <Text style={styles.thin} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Two more sessions of the same lift and there&apos;s a trend to show here.
            </Text>
          </FadeSlideIn>
        ) : (
          <Stagger step={55} initialDelay={60}>
            {ranked.map((lift, i) => (
              <LiftCard
                key={lift.key}
                lift={lift}
                // The banner names what the sort just claimed, and only when the
                // claim is true: a "biggest gain" that lost weight is flattery.
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
                  onPress={() => {
                    tap();
                    openExerciseSheet(lift.canonical);
                  }}
                />
              ))}
              <Text style={styles.buildingNote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Three sessions of the same lift inside eight weeks and it gets its own chart.
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
          style={styles.allLiftsRow}>
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
  leading,
  open,
  sets,
  onToggle,
  onOpenSession,
  onOpenHistory,
}: {
  lift: LiftProgression;
  leading: boolean;
  open: boolean;
  sets: WorkoutSet[];
  onToggle: () => void;
  onOpenSession: () => void;
  onOpenHistory: () => void;
}) {
  const spoken = describeDelta(lift.delta, 'kg', monthDay(lift.firstDay), fmtNumber);
  const share = percentText(lift.delta, lift.percent);
  const value = fmtNumber(lift.latest);

  // Two readings, deliberately independent. `tone` is the WINDOW — where the
  // lift went over eight weeks, which is what the chip and the delta report.
  // `stall` is the TAIL — what the last sessions did, which is what the meta
  // line and the terminal dot report. When they disagree ("up 12%" over a card
  // that says "down 2 sessions running") that disagreement is the single most
  // useful thing this screen can tell someone, so neither is allowed to
  // overwrite the other.
  const tone: Tone = lift.delta > 0 ? 'up' : lift.delta < 0 ? 'down' : 'flat';
  const stall = stallOf(lift.points);
  const stallNote = describeStall(stall);
  const regressing = stall.kind === 'down' && stall.sessions >= STALL_RUN_MIN;
  const dotTone: Tone = stall.kind === 'up' ? 'up' : regressing ? 'down' : 'flat';

  return (
    <View style={[styles.card, leading && styles.cardLeading]}>
      {leading ? (
        <Text style={styles.leadTag} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Biggest gain
        </Text>
      ) : null}
      <PressableScale
        haptic="none"
        activeScale={0.98}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        // Spelled out in full, so VoiceOver never depends on the hue that the
        // chip and the dot use to say the same thing (§14).
        accessibilityLabel={[
          lift.canonical,
          `${value} kilograms`,
          spoken,
          share ?? 'no change',
          stallNote ?? `${lift.sessions} sessions`,
          `last ${labelForDay(lift.lastDay)}`,
          lift.isBest ? 'personal record' : '',
        ]
          .filter(Boolean)
          .join(', ')}
        style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={styles.cardName}>
            <View style={styles.nameLine}>
              <Text style={styles.liftName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {lift.canonical}
              </Text>
              {/* `Badge tone="wash"` — the app's one sanctioned filled chip
                  (skill §Decided-4), the same object Next's lever is. `share`
                  is null when the window is flat (`percentText` returns null on
                  a zero delta), so this is only ever a gain or a loss and there
                  is no third, unpaired fill to express. */}
              {share ? <Badge tone="wash" wash={tone === 'up' ? 'gain' : 'loss'} label={share} /> : null}
              {lift.isBest ? (
                <View style={styles.prChip}>
                  <Text style={styles.prChipText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    PR
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.liftMeta} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {stallNote ?? `${lift.sessions} sessions · last ${labelForDay(lift.lastDay)}`}
            </Text>
          </View>
          <View style={styles.heroBox}>
            <Text style={styles.hero} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {value}
              <Text style={styles.heroUnit}> kg</Text>
            </Text>
            <Text
              style={[styles.heroDelta, styles[`ink_${tone}`]]}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {lift.delta === 0 ? '—' : spoken}
            </Text>
          </View>
        </View>

        {/* THE LINE IS BRAND BLUE (v6, skill §Reuse: "`TrendChart` brand —
            never green"). It was one neutral ink, on the 17 Aug reasoning that
            the eight weeks of history should not judge; that reasoning is
            intact and the terminal dot still carries the verdict alone. What
            changed is that the SHAPE of a recorded progression is the one place
            the app's blue earns a line, so the tint and its wash come off the
            component's own defaults rather than being overridden here.

            `ground` is the white card this sits in, so the dot is knocked out
            of the line in the surface it actually stands on. */}
        <TrendChart
          points={lift.points}
          best={lift.best}
          height={open ? CHART_H_OPEN : CHART_H}
          showPrevious={open}
          dots
          ground={color.surface}
          lastTint={TONE_INK[dotTone]}
        />

        <View style={styles.ends}>
          <Text style={styles.endLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {`${monthDay(lift.firstDay)} · ${fmtNumber(lift.first)} kg`}
          </Text>
          <Text style={styles.endLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {`${monthDay(lift.lastDay)} · ${value} kg`}
          </Text>
        </View>
      </PressableScale>

      {open ? (
        <FadeSlideIn>
          <View style={styles.cardRule} />
          <PressableScale
            haptic="none"
            activeScale={0.98}
            onPress={onOpenSession}
            accessibilityRole="button"
            accessibilityLabel={`Open the full session from ${labelForDay(lift.lastDay)}`}
            style={styles.evHead}>
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
            activeScale={0.98}
            onPress={onOpenHistory}
            accessibilityRole="button"
            accessibilityLabel={`Full history for ${lift.canonical}`}
            style={styles.opener}>
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
function BuildingRow({ lift, onPress }: { lift: LiftBrief; onPress: () => void }) {
  return (
    <PressableScale
      haptic="none"
      activeScale={0.98}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${lift.canonical}, ${lift.sessions} ${
        lift.sessions === 1 ? 'session' : 'sessions'
      }, latest ${fmtNumber(lift.latest)} kilograms`}
      style={styles.buildRow}>
      <Text style={styles.buildName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {lift.canonical}
      </Text>
      <Text style={styles.buildMeta} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {`${lift.sessions} · ${fmtNumber(lift.latest)} kg`}
      </Text>
    </PressableScale>
  );
}

/** The terminal dot's fill per tone — SVG takes a colour, not a style. */
const TONE_INK: Record<Tone, string> = {
  up: color.gain,
  down: color.loss,
  flat: color.accent,
};

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

  // The four orderings live in `components/chip-row.tsx` now — see the ChipRow
  // call above. Nothing on this screen styles a chip any more.

  // --- lift card --------------------------------------------------------------
  // A card, and an accordion like Next's: it opens onto the sets behind the
  // latest point, so the surface is what says where that disclosure begins and
  // ends. `radius.xl` 24 — a card and a sheet are the same kind of object.
  card: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    padding: spacing.lg,
    // No marginBottom: the content container's own `gap` separates the cards.
    // Carrying both stacked 16 + 12 between every pair, which read as a list
    // coming apart rather than as one stack.
    ...shadow.card,
  },
  cardLeading: {
    borderColor: alpha(color.brand, 0.4),
  },
  leadTag: {
    ...type.footnote,
    fontWeight: '700',
    // 5.97:1 on the card. The border above it is a soft outline and does not
    // have to carry the meaning on its own — the words "Biggest gain" are
    // printed inside it (skill §Colour: colour is never the only carrier).
    color: color.brand,
    marginBottom: spacing.xs,
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
    ...type.headline,
    flexShrink: 1,
    fontWeight: '700',
    color: color.textPrimary,
  },
  // The window's reading is `Badge tone="wash"` now — this screen styles no
  // chip of its own. `chip_flat` went with it and was never drawn anyway:
  // `percentText` returns null on a zero delta, so a flat window has no chip.
  // The three `ink_*` entries stay — they still colour the HERO DELTA under the
  // reading, where the word beside them carries the direction and the hue only
  // repeats it, which is what keeps a colourblind reading complete.
  ink_up: { color: color.gain },
  ink_down: { color: color.loss },
  ink_flat: { color: color.textSecondary },
  // A PR is a SHAPE, never a colour (§5.1) — an outlined mono label, so it
  // survives colourblindness and never competes with the green beside it.
  prChip: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  prChipText: {
    ...readingStyle('700'),
    fontSize: moderateScale(11),
    letterSpacing: 0.5,
    color: color.textPrimary,
  },
  liftMeta: {
    ...readingStyle('400'),
    fontSize: moderateScale(11.5),
    marginTop: 3,
    color: color.textSecondary,
  },
  heroBox: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  hero: {
    ...readingStyle('700'),
    fontSize: moderateScale(28),
    letterSpacing: -0.5,
    color: color.textPrimary,
  },
  heroUnit: {
    fontSize: type.caption.fontSize,
    fontWeight: '400',
    color: color.textSecondary,
  },
  heroDelta: {
    ...readingStyle('600'),
    fontSize: moderateScale(12.5),
    marginTop: 2,
  },
  ends: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  endLabel: {
    ...readingStyle('400'),
    fontSize: moderateScale(11),
    color: color.textSecondary,
  },

  // --- the evidence, inside an open card --------------------------------------
  cardRule: {
    height: 1,
    backgroundColor: color.border,
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
    borderCurve: 'continuous',
  },
  // THE RECORD, so it takes none of the record's chrome: the hairline under
  // every set is gone (skill §Structure) and the row breathes instead. This is
  // the same treatment `set-table.tsx` carries on Today.
  setRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  setIndex: {
    ...readingStyle('400'),
    fontSize: type.footnote.fontSize,
    // Which set it is, is information — muted is for what the eye may skip.
    color: color.textSecondary,
    width: moderateScale(42),
  },
  setValue: {
    ...readingStyle('400'),
    fontSize: type.footnote.fontSize,
    flex: 1,
    color: color.textPrimary,
  },
  setEstimate: {
    ...readingStyle('400'),
    fontSize: type.footnote.fontSize,
    color: color.textSecondary,
  },
  opener: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: moderateScale(28),
    marginHorizontal: -PRESS_BLEED,
    paddingHorizontal: PRESS_BLEED,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
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
    minHeight: moderateScale(52),
    marginHorizontal: -PRESS_BLEED,
    paddingHorizontal: PRESS_BLEED,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
  },
  buildName: {
    ...type.subhead,
    flexShrink: 1,
    color: color.textPrimary,
  },
  buildMeta: {
    ...readingStyle('400'),
    fontSize: moderateScale(11),
    // "3 · 82.5 kg" is a READING. A value in muted is a bug at the call site.
    color: color.textSecondary,
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
    borderCurve: 'continuous',
  },
  allLiftsLabel: {
    ...type.caption,
    color: color.textSecondary,
  },
  thin: {
    ...type.subhead,
    // It carries information, so it is secondary ink rather than muted.
    color: color.textSecondary,
    paddingVertical: spacing.md,
  },
  emptyCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.border,
    // A card's radius, not a button's.
    borderRadius: radius.xl,
    borderCurve: 'continuous',
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
