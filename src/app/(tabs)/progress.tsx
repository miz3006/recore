import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Sparkline } from '@/components/charts';
import { ChipRow } from '@/components/chip-row';
import { E1RM_ACTION_LABEL, E1RM_LABEL, E1rmSheet } from '@/components/e1rm-sheet';
import { Icon } from '@/components/icon';
import { FadeSlideIn, PressableScale, Stagger } from '@/components/motion';
import { AppButton, Eyebrow, Row } from '@/components/primitives';
import { StubScreen } from '@/components/stub-screen';
import { lastDayPhrase } from '@/lib/day-phrase';
import { shiftDayKey, todayKey } from '@/lib/db/dates';
import { getLiftSessions } from '@/lib/db/progression';
import { markImportCompleted, markImported, markImportStarted } from '@/lib/funnel';
import { tap } from '@/lib/haptics';
import { pickAndImportCsv } from '@/lib/import/pick';
import { stagger } from '@/lib/motion';
import { rowCountBucket } from '@/lib/onboarding';
import { fmtNumber } from '@/lib/parse/summarize';
import { STALL_SESSIONS } from '@/lib/plateau';
import { recachePredictionFromLatest } from '@/lib/predict/cache';
import { getWeightUnit } from '@/lib/prefs';
import { describeDelta } from '@/lib/progression';
import { buildOverview, type LiftRow } from '@/lib/progression-overview';
import {
  MAX_FONT_SCALE,
  alpha,
  color,
  moderateScale,
  radius,
  spacing,
  TAB_BAR_CLEARANCE,
  type,
} from '@/lib/theme';
import { displayLoad, spokenUnit, type WeightUnit } from '@/lib/units';
import { labelForDay, useSession } from '@/state/session-store';

/**
 * PROGRESSION, LEVEL ONE — "what is moving?" (28 August 2026).
 *
 * The tab is two screens now. This root answers the question ACROSS lifts;
 * `app/lift/[key].tsx` answers it inside one, with the metric cards measured off
 * Lyfta's Exercise Progress screens.
 *
 * ## Why it is two screens
 *
 * The first pass at this rebuild put the metric cards straight on the tab with a
 * chip row on top to choose the lift. That was wrong in three ways at once: the
 * row capped the app at eight visible lifts, it wrapped into three rows at the
 * Dynamic Type ceiling, and — worst — it deleted the cross-lift view without
 * replacing it, so "am I progressing?" could only be asked one exercise at a
 * time. Splitting the tab restores the overview, removes the cap, and matches
 * how the reference is actually reached: **from** an exercise, which is why it
 * has no selector.
 *
 * ## The groups are the athlete's own split
 *
 * There is no muscle column in this schema and this screen does not invent one.
 * `lib/progression-overview.ts` reuses `predict/split.ts`'s clustering — which
 * exercises are performed together — and names each group after the lift done
 * most often inside it. Somebody who benches, presses and dips on one day has a
 * push day whether or not anyone calls it that (CLAUDE.md §2.2: personalise only
 * from chosen information). One cluster means no groups and no strip.
 *
 * ## Next's "other lifts" arrived here on 29 August 2026
 *
 * Not as a block — that would have printed a second copy of rows already in
 * this list — but as two facts folded into them: a PLATEAU where the record has
 * one, and the trust guard that came with the delta it protects
 * (`lib/progression-overview.ts`). A stalled lift leads its detail line with
 * the plateau and wears `attention`, the app's colour for one everywhere else;
 * the word says it too, so the hue is never the only carrier (§14).
 *
 * ## Direction is a word here, not a colour
 *
 * The 17 Aug ruling coloured a lift's DELTA chip gain-green or loss-red. That
 * chip is gone with the card it lived on, and the bare `Row` this list is built
 * from tints the *value* rather than the delta — colouring an absolute load by
 * direction would say "116.5 kg is a gain", which is not a thing. So the
 * direction is carried by the word alone ("up 7.5 kg"), which §14 required
 * beside the colour anyway. Restoring the tinted delta means a purpose-built
 * row; it is a deliberate omission, not an oversight.
 */

/** Eight weeks. One window, named once — the counted line, the groups and every
 * lift row measure the same stretch, and so does level two. */
const RANGE_DAYS = 56;

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
 * itself. `stagger()`'s cap is what keeps a fifty-lift list from spending four
 * seconds assembling.
 */
const ROW_STAGGER = 40;
const ROW_STAGGER_CAP = 8;
const ROW_STAGGER_LEAD = 150;

/**
 * The row's second line: how far it moved, then how much record there is.
 * `describeDelta` owns the phrasing, so a deload never arrives as "−5 kg".
 *
 * A PLATEAU LEADS IT. A lift that has not moved in three sessions was reading
 * "12 sessions · last Tue" here, which is the one thing about it that is not
 * worth knowing; the plateau is the fact that changes what the athlete does,
 * and Next has ranked it that way since 12 August.
 *
 * A delta the guard refuses is spoken as a direction and printed as no figure
 * (`deltaSuspect`).
 *
 * **It carries the unit the reading above it carries.** Both figures in here are
 * loads off the same record as the row's own number — a plateau weight and a
 * move in estimated 1RM — so a row reading `est. 1RM 308 lb` over "up 16.5 kg"
 * would be one lift quoted in two systems.
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
   * always a focus — the same synchronous meta read the rows already ride on,
   * and no store to keep in step. Storage stays kilograms (`lib/units.ts`);
   * this is a display concern and never touches what was written down.
   */
  /* eslint-disable react-hooks/exhaustive-deps */
  const unit = useMemo<WeightUnit>(() => getWeightUnit() ?? 'kg', [refresh]);
  /* eslint-enable react-hooks/exhaustive-deps */

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

  /* eslint-disable react-hooks/exhaustive-deps */
  const rows = useMemo(() => (userId ? getLiftSessions(userId) : []), [userId, refresh]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const fromDay = shiftDayKey(todayKey(), -RANGE_DAYS);
  const view = useMemo(() => buildOverview(rows, fromDay), [rows, fromDay]);

  // A group that vanishes (the record re-clustered after a new session) falls
  // back to All rather than filtering the list down to nothing.
  const activeGroup = group !== ALL && view.groups.some((g) => String(g.id) === group) ? group : ALL;
  const needle = query.trim().toLowerCase();
  const shown = view.lifts.filter((l) => {
    if (activeGroup !== ALL) {
      const g = view.groups.find((x) => String(x.id) === activeGroup);
      if (g && !g.liftKeys.includes(l.key)) return false;
    }
    return needle === '' || l.canonical.toLowerCase().includes(needle);
  });

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
              Log one session — or import your history — and every lift you name gets a card
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

  const subtitle = `Last 8 weeks · ${view.lifts.length} ${
    view.lifts.length === 1 ? 'lift' : 'lifts'
  } · ${view.sessions} training ${view.sessions === 1 ? 'day' : 'days'}`;

  return (
    <StubScreen title="Progression" subtitle={subtitle} back={false} large>
      {view.lifts.length >= SEARCH_FLOOR ? (
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search your lifts"
          placeholderTextColor={color.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
          accessibilityLabel="Search your lifts"
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        />
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}>
        {view.groups.length > 0 ? (
          <View style={styles.groups}>
            <ChipRow
              items={[
                { key: ALL, label: 'All', spoken: `All ${view.lifts.length} lifts` },
                ...view.groups.map((g) => ({
                  key: String(g.id),
                  label: g.name,
                  spoken: `${g.name}, ${g.liftKeys.length} lifts, ${g.sessions} sessions`,
                })),
              ]}
              activeKey={activeGroup}
              onSelect={setGroup}
              hint="Filters the lifts below"
            />
            {/* The grouping is derived, so it says where it came from. A label
                a person cannot account for reads as a category we imposed. */}
            <Text style={styles.groupNote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Grouped by what you train together.
            </Text>
          </View>
        ) : null}

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
                // was read as the load on the bar: somebody who benched 100
                // saw 140 against their own lift and concluded the record was
                // wrong. The label is small and the figure keeps its size —
                // what changed is that the number is now named, and tapping it
                // says where it comes from.
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
    </StubScreen>
  );
}

const styles = StyleSheet.create({
  search: {
    ...type.body,
    color: color.textPrimary,
    backgroundColor: color.surfaceHigh,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
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
  groups: {
    gap: spacing.sm,
  },
  groupNote: {
    ...type.footnote,
    color: color.textMuted,
  },
  sparkHole: {
    width: SPARK_W,
    height: SPARK_H,
  },
  thin: {
    ...type.body,
    color: color.textSecondary,
  },

  // --- all lifts ---------------------------------------------------------------
  allLiftsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: alpha(color.textPrimary, 0.06),
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
