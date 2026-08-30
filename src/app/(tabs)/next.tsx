import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { KeyboardDoneBar } from '@/components/keyboard-done';
import { FadeSlideIn, FadeSwap, PressableScale, Stagger } from '@/components/motion';
import { GroupPills, GroupSheet } from '@/components/next/groups';
import { LiftRow } from '@/components/next/lift-row';
import { NextSkeleton } from '@/components/next/skeleton';
import { SplitChips } from '@/components/next/split-chips';
import { StubScreen } from '@/components/stub-screen';
import { ThoughtProcessCard } from '@/components/thought-process';
import { getCachedBriefSummary, refineBriefSummary } from '@/lib/brief-explain';
import { briefProse } from '@/lib/brief-prose';
import { buildBrief, planDayLines, type Brief } from '@/lib/db/brief';
import { shortDayLabel, todayKey } from '@/lib/db/dates';
import { listPlanDays, resolveTodayPlanDay } from '@/lib/db/plan';
import { getDaySessionFacts } from '@/lib/db/workouts';
import { entryNoteKey } from '@/lib/entry-note';
import { markBriefShown } from '@/lib/funnel';
import { tap } from '@/lib/haptics';
import { devWarn } from '@/lib/log';
import { groupsOf, type GroupKey } from '@/lib/next/groups';
import { getOverrides, setOverride } from '@/lib/next/overrides';
import {
  buildSections,
  lastDoneOf,
  sessionRowsOf,
  targetsLine,
  type SessionRow,
} from '@/lib/next/sections';
import { getAnswer, getKeyLifts } from '@/lib/profile-answers';
import {
  color,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  TAB_BAR_CLEARANCE,
  type,
} from '@/lib/theme';
import { useSession } from '@/state/session-store';

/**
 * Next — "What am I doing next?" (owner, 28 July 2026; rebuilt 13 August;
 * restructured on Symmetry's Workout Detail 28 August 2026).
 *
 * §16 names the prediction as the single strongest retention mechanism in the
 * product: *a reason to open the app on a training day that exists before the
 * user has done anything.*
 *
 * WHAT THIS IS NOT. The owner's first shape for it was "an AI summary you use
 * as a plan". That breaks three standing rules at once: §1.1 invariant 3 (a
 * model never picks a weight), §20 ("we never tell someone what to train, only
 * what to beat"), and the Terms, which say in as many words that Recore is a
 * calculation and not coaching. So **every figure on this screen is computed**
 * (`db/brief.ts` + the pure engine), and the only text a model may touch is the
 * prose that `explain-brief` is already allowed to REWRITE — never to author
 * (§9.1). Same history, same briefing, every time, offline.
 *
 * **And it is not a library.** Every gym app in the corpus builds this screen
 * as one — template grids, category pills, a create-workout FAB, an
 * AI-generate tile. Next is derived from the athlete's own history; nothing on
 * it is picked from a catalogue, and no pattern that implies the user CHOOSES
 * their workout belongs here.
 *
 * ## The 28 August restructure
 *
 * Symmetry's Workout Detail gave the skeleton — *title block, a compact
 * summary of what it targets, exercise rows, one pinned Start* — and Setgraph
 * gave the colour discipline, a single green carrying a whole screen on a
 * light neutral canvas. What neither reference has is the reason line under
 * every target, and that is the point of the screen:
 *
 *     Bench press                            82.5 kg × 5·5·5
 *                                             up 2.5 from Sat 8 Aug
 *
 * What the restructure removed, and why:
 *
 * | Gone | Why |
 * |---|---|
 * | `BriefLede` at the top | a paragraph competing with the numbers it summarises |
 * | the `Planned ·` eyebrow | with green dominant, a label announcing green is furniture; the session's name moved into the title block |
 * | `LiftCard` | one card per lift, opening onto a reason — see `next/lift-row.tsx` |
 * | `UnknownLifts` | a lift with no history is now a row with an em dash, in the ONE list, instead of a counted block below it |
 * | "Nothing counts until you lift it" | the pinned Start says it by doing it |
 * | the header's dateline | the title block says when it was last done, which is the useful half |
 * | `Signals` (29 Aug) | "your other lifts" are lifts the coming session does NOT name — a question across lifts, which is Progression's. It moved there folded into rows that already showed those lifts, rather than as a second list beside them |
 * | the pinned Start (29 Aug) | see below |
 *
 * ## The 29 August pass, after the owner saw it on a device
 *
 * *"Definitivno mi ni všeč dizajn."* Tiimo — iPhone App of the Year 2025, and
 * an AI co-planner, which is this screen's function in another category —
 * named the faults. Four changes:
 *
 *  1. **Cards, not bare rows**, and the reason moved LEFT under the name. Both
 *     arguments are in `next/lift-row.tsx`.
 *  2. **The decision strip** — `GOING UP · 3`, `HOLDING · 1` — counted off the
 *     engine's own levers, every pill opening the RULE behind it. The row says
 *     what changed; the pill says what rule changed it. It counts across the
 *     session and never reorders it: the order somebody trains in is a training
 *     opinion the app does not hold (§20).
 *  3. **The split switcher is back, under the title.** The owner asked to see
 *     push and pull separately — which is what these chips have always done,
 *     and the redesign draft had dropped them.
 *  4. **The pinned Start is gone.** It offered to fill Today with a checklist,
 *     and CLAUDE.md §3 is explicit: *"Training input is free text first. Touch
 *     controls repair, inspect, or enrich it; they never replace writing as the
 *     primary path."* A full-width green button making the checklist the way
 *     into a session was that rule quietly inverted. Next is a briefing you
 *     read; Today is where you write. `start-bar.tsx`, `startFromNext` and the
 *     `PlannedChecklist` mount stay on disk, unmounted, so the wire is one line
 *     if the owner wants it back.
 *
 * NO SERIF: the owner ruled one type family across the whole app (29 Aug).
 *
 * This file assembles; it decides nothing. Every placement rule lives in the
 * pure module (`lib/next/sections.ts`) or in one section component.
 */
export default function Next() {
  const router = useRouter();
  const userId = useSession((s) => s.userId);
  const openExerciseSheet = useSession((s) => s.openExerciseSheet);
  const [refresh, setRefresh] = useState(0);

  // Re-read on focus: a session finished on Today changes every block here.
  useFocusEffect(
    useCallback(() => {
      setRefresh((n) => n + 1);
    }, []),
  );

  /* eslint-disable react-hooks/exhaustive-deps */
  const brief: Brief | null = useMemo(() => (userId ? buildBrief(userId) : null), [userId, refresh]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const prose = brief ? briefProse(brief) : '';

  // The model-written upgrade (§9.1): the composed paragraph is ready
  // instantly; a validated rewrite swaps in when it lands — late or never, and
  // never blocking anything. Cached per paragraph, so a stable brief costs one
  // call ever.
  const [summary, setSummary] = useState<string | null>(() =>
    prose ? getCachedBriefSummary(prose) : null,
  );
  useEffect(() => {
    const cached = prose ? getCachedBriefSummary(prose) : null;
    setSummary(cached);
    if (!prose) return;
    // §9.3's fallback-rate counters: which phrasing was actually on screen. An
    // upgrade mid-look counts once in each column, truthfully.
    markBriefShown(cached ? 'model' : 'composed');
    refineBriefSummary(prose, (s) => {
      setSummary(s);
      markBriefShown('model');
    });
  }, [prose]);

  /**
   * FLAT MODE. The athlete answered "I don't follow a split" on onboarding
   * screen 14, and it is the one answer on that screen that changes app
   * behaviour rather than personalising copy (`flow.ts`, `drivesBranch`).
   *
   * On this screen it changes exactly one thing: they are not owed a day's
   * name, so the title block does not invent one. The rows are identical,
   * because the reason line already answers both of their questions at once —
   * "up 2.5 from Sat 8 Aug" is what to put on the bar AND how long it has
   * been. The date IS the staleness.
   */
  const flat = getAnswer('split') === 'flat';

  // Where every placement rule on this page lives. `devWarn` is how a refused
  // e1RM delta reaches a developer without reaching the athlete.
  const sections = useMemo(
    () => (brief ? buildSections(brief, { phrased: summary != null, flat, warn: devWarn }) : null),
    [brief, summary, flat],
  );

  /**
   * THE SPLIT PREVIEW (13 Aug). Next has only ever shown the day the athlete is
   * due for; the chips let them look at another day of their own split and see
   * what it would ask of them, computed by the same `planStripFor` the real
   * strip runs on.
   *
   * Looking is not answering: selecting a chip writes nothing, does not move
   * which day is due, and — since the pinned Start arrived — offers no Start
   * either. A look ahead that could be begun would be a second way to answer
   * the question the session-start path already owns (§8.2).
   */
  /* eslint-disable react-hooks/exhaustive-deps */
  const planDays = useMemo(() => (userId ? listPlanDays(userId) : []), [userId, refresh]);
  const dueId = useMemo(
    () => (userId ? (resolveTodayPlanDay(userId, todayKey())?.id ?? null) : null),
    [userId, refresh],
  );
  /** Today's own record, when there is one — the "you already trained" state. */
  const written = useMemo(
    () => (userId ? getDaySessionFacts(userId, todayKey()) : null),
    [userId, refresh],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  const [previewId, setPreviewId] = useState<string | null>(null);
  // A day deleted in /split while this screen was open must not leave a chip
  // selected that no longer exists.
  const previewDay =
    previewId && previewId !== dueId ? (planDays.find((d) => d.id === previewId) ?? null) : null;
  const dueLabel = planDays.find((d) => d.id === dueId)?.label ?? null;

  const preview = useMemo(() => {
    if (!userId || !previewDay || !brief) return null;
    // The same stalls the due day folds in, so a plateau reads identically
    // whichever day names the lift. No ghost sentence: it belongs to the
    // session actually due, and attaching it here would be a fabrication.
    const { rows } = sessionRowsOf(planDayLines(userId, previewDay), brief.stalls, null);
    return { title: previewDay.label, rows };
  }, [userId, previewDay, brief]);

  /**
   * EDIT MODE — Setgraph's placement, the owner's lighter version of Symmetry's
   * Edit Workout bar. One control in the title block turns every target into a
   * field; at rest there is no field anywhere on the page.
   */
  const [editing, setEditing] = useState(false);
  const [openGroup, setOpenGroup] = useState<GroupKey | null>(null);
  const [overrideRev, setOverrideRev] = useState(0);
  /* eslint-disable react-hooks/exhaustive-deps */
  const overrides = useMemo(() => getOverrides(), [overrideRev, refresh]);
  /* eslint-enable react-hooks/exhaustive-deps */

  /**
   * ONE LIST. A lift the record has nothing on is a row with an em dash and an
   * empty reason slot, beside the lifts that do have targets — not a separate
   * counted block underneath them. The slot below a target holds EVIDENCE for
   * that target; putting "write one session and this fills in" there would put
   * an instruction where the reader has learned to find proof. It is said
   * once, under the title block (owner, 28 August 2026).
   */
  const rows: SessionRow[] = preview ? preview.rows : (sections?.sessionRows ?? []);
  const seeded = useMemo(() => (rows.length === 0 ? keyLiftRows() : []), [rows.length]);
  const shown = rows.length > 0 ? rows : seeded;
  const missing = shown.some((r) => !r.prescription);
  const groups = groupsOf(shown);

  const hasAnything =
    sections != null &&
    brief != null &&
    (sections.sessionRows.length > 0 || brief.notes.length > 0 || sections.adherenceChip != null);

  if (!sections) {
    // No account resolved yet — the record is still being opened. The one thing
    // this must not do is show the empty state, which is a real claim about an
    // empty record rather than a way to pass the time.
    return (
      <StubScreen title="Next" back={false} large>
        <NextSkeleton />
      </StubScreen>
    );
  }

  /** THE TITLE BLOCK — what this session is, and when it was last done. */
  const title = preview ? preview.title : sections.sessionTitle;
  const lastDone = lastDoneOf(shown);
  /**
   * The title block's second line. It absorbed the counted-targets line on
   * 29 Aug: the decision strip already counts this session, and two things
   * counting the same five lifts on one screen is one of them being furniture.
   * What the strip does NOT say is what the session targets, so that is what
   * survives here.
   */
  const subtitle = !preview && written
    ? // Today is on the record, so the page below is the NEXT session and says
      // so. No congratulation, no tick — one line of provenance (§2 rule 6).
      `Today is written · ${written.lifts} ${written.lifts === 1 ? 'lift' : 'lifts'}`
    : shown.length > 0
      ? [lastDone ? `Last done ${shortDayLabel(lastDone)}` : null, targetsLine(shown)]
          .filter(Boolean)
          .join(' · ')
      : hasAnything
        ? undefined
        : 'No sessions written';

  const commit = (row: SessionRow, kg: number | null) => {
    setOverride(row.canonical ?? row.name, kg, row.loadKg);
    setOverrideRev((n) => n + 1);
  };

  return (
    <StubScreen
      title={title}
      subtitle={subtitle}
      back={false}
      large
      trailing={
        // Only where there is something to argue with. An Edit control over a
        // page of em dashes offers to change nothing.
        shown.some((r) => r.loadKg != null) ? (
          <EditPill
            on={editing}
            onPress={() => {
              tap();
              setEditing((v) => !v);
            }}
          />
        ) : undefined
      }>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* WHICH DAY AM I LOOKING AT — directly under the title, because that
            is the question it answers. The owner asked to see push and pull
            separately (29 Aug); this control has always done it. */}
        <SplitChips
          days={planDays}
          activeId={previewDay?.id ?? dueId}
          dueId={dueId}
          onSelect={(id) => {
            setPreviewId(id === dueId ? null : id);
            setEditing(false); // a different day is a different set of targets
            setOpenGroup(null);
          }}
        />

        {/* WHAT CHANGED SINCE LAST TIME. Counted off the engine's own levers;
            each pill opens the rule behind it. */}
        <GroupPills
          groups={groups}
          onOpen={(key) => {
            tap();
            setOpenGroup(key);
          }}
        />

        {/* The instruction, ONCE, and only when a row on the page is waiting
            for it. Under the title block — never in a reason slot. */}
        {missing ? (
          <Text style={styles.instruction} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {rows.length === 0
              ? 'Write a session with these and Recore has something to beat.'
              : 'One logged session each and the rest of these fill in.'}
          </Text>
        ) : null}

        {/* ONE list, ONE gap. `Stagger` renders a fragment, so without this
            wrapper every card became a direct child of the page and collected
            the page's `spacing.lg` on top of its own — 28 pt between rows of a
            list that wants 8. */}
        {shown.length > 0 ? (
          <View style={styles.list}>
          <Stagger step={55} initialDelay={60}>
            {shown.map((row, i) => (
              <LiftRow
                key={row.key || `${row.name}:${i}`}
                row={row}
                override={overrideOf(overrides, row)}
                editing={editing && !preview}
                onPress={() => {
                  tap();
                  if (row.canonical) openExerciseSheet(row.canonical);
                }}
                onCommit={(kg) => commit(row, kg)}
              />
            ))}
          </Stagger>
          </View>
        ) : (
          <FadeSlideIn>
            <Text style={styles.thin} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {preview
                ? `Nothing to progress on ${preview.title} yet. These movements need one logged session each before Recore can say what beats them.`
                : 'One more session of the same lifts and there is something here to beat.'}
            </Text>
          </FadeSlideIn>
        )}

        {/* A preview is a look at another day, and the page has to keep saying
            so — selecting a chip writes nothing and does not move which day is
            due (§8.2). */}
        {preview ? (
          <Text style={styles.foot} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {dueLabel ? `A look ahead. Today reads as ${dueLabel}.` : 'A look ahead — not the session you are due for.'}
          </Text>
        ) : null}

        {/* THE REASONING, AS AN OBJECT. It stays at the BOTTOM: the paragraph
            competed with the loads when it sat at the top, and it is not going
            back there. `FadeSwap` keeps §9.1's promise that the model's rewrite
            is VISIBLE when it lands. No paragraph, no card. */}
        {brief && (summary ?? prose) ? (
          <FadeSwap swapKey={summary ? 'model' : 'composed'}>
            <ThoughtProcessCard
              reasoning={summary ?? prose}
              sessions={brief.sessions8w}
              provenance={sections.provenance}
              adjustLabel="Adjust the plan"
              onAdjust={() => {
                tap();
                router.push('/split');
              }}
            />
          </FadeSwap>
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

      <GroupSheet
        group={groups.find((g) => g.key === openGroup) ?? null}
        onClose={() => setOpenGroup(null)}
      />

      <KeyboardDoneBar />
    </StubScreen>
  );
}

/** The athlete's number for a row, or null — void the moment the engine moves
 * off the load it displaced (`lib/next/overrides.ts`). */
function overrideOf(
  book: ReturnType<typeof getOverrides>,
  row: SessionRow,
): number | null {
  const entry = book[entryNoteKey(row.canonical ?? row.name)];
  if (!entry) return null;
  return entry.was === (row.loadKg ?? null) ? entry.kg : null;
}

/**
 * THE EMPTY STATE'S ROWS — the lifts they named in onboarding (screen 15),
 * with no targets.
 *
 * It shows the STRUCTURE the screen will fill, in their own lifts' names, and
 * claims nothing: the working weights they typed on that screen stay out of
 * the target column, because a number the athlete stated about themselves is
 * not a number the engine prescribed, and printing it there would be the page
 * inventing a prescription (§2 rule 2).
 *
 * No key lifts on file means no rows — the title block and the instruction
 * carry the page on their own.
 */
function keyLiftRows(): SessionRow[] {
  return getKeyLifts().map((name) => ({
    key: entryNoteKey(name),
    name,
    canonical: null,
    move: null,
    bestKg: null,
    last: null,
    lastDay: null,
    prescription: null,
    loadKg: null,
    scheme: null,
    beatsBest: false,
    why: null,
    watch: null,
    note: null,
  }));
}

/** The title block's one control. A pill, because everything interactive on
 * this canvas floats as one. */
function EditPill({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <PressableScale
      haptic="none"
      activeScale={0.96}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? 'Done editing targets' : 'Edit targets'}
      style={[styles.editPill, on ? styles.editPillOn : null]}>
      <Text
        style={[styles.editLabel, on ? styles.editLabelOn : null]}
        maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {on ? 'Done' : 'Edit'}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    marginHorizontal: -spacing.xxl,
  },
  content: {
    paddingHorizontal: spacing.xxl,
    // Content scrolls *behind* the tab bar and the pinned Start (§5.2 — glass
    // needs something to refract), so the last row is padded clear of both.
    paddingBottom: spacing.huge + TAB_BAR_CLEARANCE,
    gap: spacing.lg,
  },
  /** What the session targets. Counted, so it reads as a fact rather than a
   * headline: secondary ink, no scale. */
  targets: {
    ...type.subhead,
    marginTop: -spacing.xs,
    color: color.textSecondary,
  },
  list: {
    gap: spacing.sm,
  },
  /** Said once, under the title block — never in a row's reason slot. */
  instruction: {
    ...type.footnote,
    lineHeight: lineFor(16),
    marginTop: -spacing.md,
    color: color.textMuted,
  },
  sessionNote: {
    ...type.footnote,
    lineHeight: lineFor(18),
    marginTop: -spacing.sm,
    color: color.textSecondary,
  },
  foot: {
    ...type.footnote,
    marginTop: -spacing.sm,
    color: color.textMuted,
  },
  thin: {
    // It CARRIES INFORMATION — what the page would need before it could say
    // anything — so it is secondary ink, not muted (skill §Colour: "`textMuted`
    // is for what the eye may skip").
    ...type.subhead,
    color: color.textSecondary,
    paddingVertical: spacing.md,
  },
  allLiftsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: moderateScale(44),
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm + spacing.xs,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
  },
  allLiftsLabel: {
    ...type.caption,
    color: color.textSecondary,
  },
  editPill: {
    minHeight: moderateScale(32),
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
  },
  /** Selection is a CONTROL state, so it wears the brand — never the planned
   * green, which on this screen means "a load nobody has lifted yet". */
  editPillOn: {
    backgroundColor: color.brand,
    borderColor: color.brand,
  },
  editLabel: {
    ...type.caption,
    fontWeight: '600',
    color: color.textPrimary,
  },
  editLabelOn: {
    color: color.surface,
  },
});
