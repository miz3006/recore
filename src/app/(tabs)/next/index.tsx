import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { KeyboardDoneBar } from '@/components/keyboard-done';
import { FadeSlideIn, FadeSwap, PressableScale, Stagger } from '@/components/motion';
import { GroupPills, GroupSheet } from '@/components/next/groups';
import { LiftRow } from '@/components/next/lift-row';
import { NextSkeleton } from '@/components/next/skeleton';
import { SplitChips } from '@/components/next/split-chips';
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
import { PAPER_FIELD_CSS } from '@/lib/paper-field';
import { getAnswer, getKeyLifts } from '@/lib/profile-answers';
import {
  color,
  FIXED_FONT_SCALE,
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
 * restructured on Symmetry's Workout Detail 28 August 2026; moved onto the
 * system navigator 9 September 2026).
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
 * ## THE SYSTEM DRAWS THE HEADER NOW (9 September 2026)
 *
 * *"make it more to look like native iOS app."* The information on this screen
 * was not the problem — every ruling above stands, and none of them moved. The
 * chrome around it was: a hand-built title row above a scroll view, which is
 * the one arrangement iOS itself never uses, and which cost the screen the
 * large-title collapse, the Liquid Glass bar, and the tab bar's minimize (the
 * full argument is in `_layout.tsx`). Four things changed and nothing else:
 *
 * 1. **`StubScreen` is gone from this route.** The screen's root is its own
 *    `ScrollView` with `contentInsetAdjustmentBehavior="automatic"`, so the
 *    large title's height, the safe area and the tab bar are UIKit's
 *    arithmetic rather than ours. The title collapses into the bar under the
 *    finger and grows back, interruptibly, because it is a real
 *    `UINavigationItem` and not a `Text`.
 *
 * 2. **The gutter went 24 → 16, and that is forced rather than chosen.** The
 *    system's large title hangs off its own inset, and content at 24 beside a
 *    title at 16 is two left edges — the fault You's own gutter note calls
 *    *"small enough to look like a rendering artefact and large enough to
 *    see."* There is one number now and nothing adds to it.
 *
 * 3. **The Edit pill became a bar button.** A white pill floating in a header
 *    row was the right object while the header was ours to draw; beside a
 *    system large title it is a control impersonating the navigator's own
 *    furniture. It is a tinted text button on the trailing edge now, which is
 *    what iOS puts there — and the `trailing` slot it used on `StubScreen`
 *    exists for Progress and Lifts, which still draw their own headers.
 *
 * 4. **The subtitle became the first line of content.** It was in the header
 *    box; a `UINavigationItem` has no second line, and faking one under a
 *    system title is how a screen ends up with two title systems. As content it
 *    scrolls away with the briefing it describes, which is also what it should
 *    have done all along — "Last done Sat 8 Aug · 4 lifts" is a fact about the
 *    session, not a fact about the screen.
 *
 * What did NOT come back: the pinned Start. Every reference for this screen has
 * one, the 29 August ruling removed it on a CLAUDE.md §3 argument that a native
 * header does not touch, and a redesign is not a licence to reopen a decision
 * (§0.8).
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
   * name, so the title does not invent one. The rows are identical, because the
   * reason line already answers both of their questions at once — "up 2.5 from
   * Sat 8 Aug" is what to put on the bar AND how long it has been. The date IS
   * the staleness.
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
   * EDIT MODE — the owner's lighter version of Symmetry's Edit Workout bar. One
   * bar button turns every target into a field; at rest there is no field
   * anywhere on the page.
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
   * once, under the subtitle (owner, 28 August 2026).
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
    //
    // It keeps the real screen's shell exactly: same navigator options, same
    // root scroll view, same insets. A skeleton that reflows into the finished
    // layout is the layout jump the anti-slop laws call the default failure
    // mode — *"skeletons must match the final layout's shape."*
    return (
      <>
        <Stack.Screen options={{ title: 'Next', headerLargeTitle: true }} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}>
          <NextSkeleton />
        </ScrollView>
      </>
    );
  }

  /** THE TITLE — what this session is. One string, because a
   * `UINavigationItem` holds one. */
  const title = preview ? preview.title : sections.sessionTitle;
  const lastDone = lastDoneOf(shown);
  /**
   * The line under the title, and content rather than chrome since 9 Sep. It
   * absorbed the counted-targets line on 29 Aug: the decision strip already
   * counts this session, and two things counting the same five lifts on one
   * screen is one of them being furniture. What the strip does NOT say is what
   * the session targets, so that is what survives here.
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

  // Only where there is something to argue with. An Edit control over a page of
  // em dashes offers to change nothing.
  const editable = shown.some((r) => r.loadKg != null);

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerLargeTitle: true,
          headerRight: editable
            ? () => (
                <EditButton
                  on={editing}
                  onPress={() => {
                    tap();
                    setEditing((v) => !v);
                  }}
                />
              )
            : undefined,
        }}
      />

      {/* THE SCROLL VIEW IS THE SCREEN'S ROOT, and that is load-bearing rather
          than tidy — `_layout.tsx` explains what UIKit does with it and what it
          cannot do without it. `automatic` hands the insets to the system: the
          large title's height, the safe area and the tab bar are all UIKit's
          arithmetic now, not ours. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        // Edit mode puts a decimal pad over the page. Scrolling puts it away the
        // iOS way — following the finger down rather than snapping shut — and
        // every field commits on blur, so a scroll IS a way to finish typing
        // rather than a way to lose it.
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}>
        {/* WHAT THIS SESSION IS, under the system's title. */}
        {subtitle ? (
          <Text style={styles.subtitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {subtitle}
          </Text>
        ) : null}

        {/* WHICH DAY AM I LOOKING AT — directly under the title block, because
            that is the question it answers. The owner asked to see push and
            pull separately (29 Aug); this control has always done it. */}
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
            {dueLabel
              ? `A look ahead. Today reads as ${dueLabel}.`
              : 'A look ahead — not the session you are due for.'}
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
    </>
  );
}

/** The athlete's number for a row, or null — void the moment the engine moves
 * off the load it displaced (`lib/next/overrides.ts`). */
function overrideOf(book: ReturnType<typeof getOverrides>, row: SessionRow): number | null {
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

/**
 * THE PAGE'S ONE CONTROL, on the navigation bar's trailing edge.
 *
 * It was a white pill in a hand-built header row, and that was the right object
 * while the header was ours to draw — *"everything interactive on this canvas
 * floats as one"* (skill §Structure). Beside a system large title it is not:
 * the bar is the navigator's furniture, and a bordered pill sitting in it is a
 * control impersonating a `UIBarButtonItem` rather than being one. iOS puts a
 * tinted label there, so that is what this is — the one blue, which does every
 * control job in the app (skill §Colour).
 *
 * **Done is semibold, Edit is not**, which is UIKit's own convention for the
 * pair and the only difference between them: it marks the button that ENDS a
 * mode, so the way out of edit mode is heavier than the way in.
 *
 * Not glass, and that is the rule rather than an omission: on an iOS 26 build
 * the bar itself is the material, and a second glass shape floating inside it
 * would be two materials deep with nothing between them.
 */
function EditButton({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <PressableScale
      haptic="none"
      activeScale={0.94}
      onPress={onPress}
      hitSlop={spacing.md}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? 'Done editing targets' : 'Edit targets'}
      style={styles.barButtonSlot}>
      <Text
        style={[styles.barButton, on ? styles.barButtonDone : null]}
        numberOfLines={1}
        // FIXED_FONT_SCALE, not MAX — *"only for text locked inside geometry"*
        // (skill §Typography), and a bar button is the definition of it: the
        // navigator sizes the slot and a label that outgrows it is CLIPPED, not
        // wrapped. At the accessibility sizes this read "Ed" on the iOS 26.5
        // simulator before the clamp.
        maxFontSizeMultiplier={FIXED_FONT_SCALE}>
        {on ? 'Done' : 'Edit'}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  /**
   * THE CANVAS IS THE SCROLL VIEW'S OWN BACKGROUND, and that is the whole
   * reason this screen can have both a paper canvas and a collapsing title.
   * `_layout.tsx` has the measurement: an `absoluteFill` `PaperField` sibling
   * costs UIKit the scroll view it tracks, and a hoisted one is painted over by
   * the navigator's opaque container. A background on the scroll view itself is
   * neither — no sibling to confuse the lookup, and nothing above it to hide
   * it. Same three stops as `PaperField`, derived from them.
   */
  scroll: {
    flex: 1,
    experimental_backgroundImage: PAPER_FIELD_CSS,
  },
  /**
   * ONE GUTTER, AND EVERYTHING HANGS OFF IT.
   *
   * `spacing.lg`, not the body's usual `spacing.xxl`, and it is forced rather
   * than chosen: the system's large title hangs off its own inset, and content
   * 8 pt further in would give the page two left edges — *"small enough to look
   * like a rendering artefact and large enough to see."* Nothing adds to this
   * number.
   */
  content: {
    paddingHorizontal: spacing.lg,
    // The top is UIKit's now (`contentInsetAdjustmentBehavior`), but the bottom
    // is not: content scrolls BEHIND the glass tab bar so the bar has something
    // to refract (§5.2), and the last row clears it by hand.
    paddingBottom: spacing.huge + TAB_BAR_CLEARANCE,
    gap: spacing.lg,
  },
  /**
   * What this session is, in one line, directly under the system title. It hugs
   * it — no top gap of its own — because a large title and its supporting line
   * are one block, and the page's `gap` opens underneath the pair rather than
   * inside it.
   */
  subtitle: {
    ...type.subhead,
    // NO FIXED LINE BOX. `lineFor()` scales for the DEVICE, not for Dynamic
    // Type, so at the ×1.5 cap a 15 pt line in a 21 pt box loses its
    // descenders — "Today" came back with the y cut off. `lift-row.tsx` hit the
    // same fault and documents it; here there is no column to align, so the box
    // simply goes back to the text.
    lineHeight: undefined,
    marginBottom: -spacing.xs,
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
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
  /**
   * The slot the label sits in, and it needs a stated width.
   * `RNSScreenStackHeaderSubview` measures its React child, and a bare `Text`
   * came back narrower than its own glyphs at the accessibility type sizes —
   * "Edit" rendered as "Ed", then as "E…" once it had `numberOfLines`. A
   * minimum wide enough for "Done" at the clamp fixes the measurement without
   * fixing the height, so the bar still sizes itself.
   */
  barButtonSlot: {
    minWidth: moderateScale(58),
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  /** A `UIBarButtonItem`'s label: body size, the one blue, no box. */
  barButton: {
    ...type.body,
    color: color.brand,
  },
  barButtonDone: {
    fontWeight: '600',
  },
});
