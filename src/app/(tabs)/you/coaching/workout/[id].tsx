import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion';
import { AppButton } from '@/components/primitives';
import { RecordStrip } from '@/components/profile/record-strip';
import { SetTable } from '@/components/set-table';
import { useAuth } from '@/lib/auth/provider';
import { listComments, type Comment } from '@/lib/coaching';
import { compactKg } from '@/lib/coaching/facts';
import { factsOf, loadCoachDay, noteFor, type CoachWorkout } from '@/lib/coaching/read-workout';
import { entryNoteKey } from '@/lib/entry-note';
import { PAPER_FIELD_CSS } from '@/lib/paper-field';
import { color, hairline, MAX_FONT_SCALE, spacing, TAB_BAR_CLEARANCE, type } from '@/lib/theme';

import { sessionDate, sessionDayTitle } from '@/lib/coaching/relative';

/**
 * ONE CLIENT SESSION, READ-ONLY — the screen this whole feature exists for.
 *
 * ## Why it is not `NoteSurface`
 *
 * The spec asks for the existing workout detail rendered with a `readOnly`
 * flag. There is no such component to flag: a past session in Recore IS the
 * Today tab with `selectedDay` moved, and `NoteSurface` reads the singleton
 * `session-store`, which holds one signed-in person's local SQLite. Passing
 * another account's remote rows through it would mean giving the store a second
 * mode, and every consumer of the store would then have to know which mode it
 * was in — including the composer, the parser trigger and the ghost.
 *
 * So the REUSE HAPPENS ONE LEVEL DOWN, where it is real: `buildReceipt` (pure)
 * turns the fetched structure into `ReceiptRow`s, and `SetTable` — the exact
 * component the athlete's own ledger card uses — draws the numbers. Same
 * arithmetic, same typography, no fork.
 *
 * ## What is deliberately absent
 *
 * No check ring, no ⋯ menu, no Fix reading, no edit, no delete, no gutter
 * comparison, no ghost, no prescription. The coach's access is read-only in the
 * database (proved in `coaching-rls.sql` 5b) and the screen must not offer a
 * control the row-level policy would reject.
 *
 * ## What is deliberately present
 *
 * The client's RAW TEXT, in full, under the reading. The spec calls it the most
 * valuable context a coach gets and it is right: "last set grindy, knee a bit
 * off" is the thing an Excel sheet could never carry. Their per-entry notes and
 * their session reflection sit with it, quoted verbatim and never summarised.
 */
export default function CoachWorkoutDetail() {
  const { id, ids, name, self, openRef, openWhole } = useLocalSearchParams<{
    id: string;
    /** Every row of this training day, comma-joined, oldest first — the feed
     *  knows them and passing them costs nothing. One id is the normal case;
     *  more than one is a day the sync split before `day-id.ts` existed. */
    ids?: string;
    name?: string;
    /** '1' when this is the viewer's OWN record — the client's way in. */
    self?: string;
    /** Set by a tapped notification: open this exercise's thread on arrival. */
    openRef?: string;
    /** Set by a tapped notification about a whole-session comment. */
    openWhole?: string;
  }>();
  const router = useRouter();
  const { session } = useAuth();
  const viewerId = session?.user.id ?? '';

  const [workout, setWorkout] = useState<CoachWorkout | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  /**
   * Opening a thread NAVIGATES to a real UIKit form sheet (`/coach-thread`).
   *
   * It was a `<Modal>` rendered in place, and that had a failure mode the
   * device made obvious: UIKit refuses to present a second modal while one is
   * up, so with the first-open spotlight on screen no thread could open at all.
   * A pushed route has no such rule, and it gets detents besides.
   */
  const openThread = (ref: string | null, label: string) => {
    router.push({
      pathname: '/coach-thread',
      params: { workoutId: id, ref: ref ?? '', label, name: name ?? 'Them' },
    });
  };

  const reload = async () => {
    setComments(await listComments(id));
  };

  useEffect(() => {
    void (async () => {
      setWorkout(await loadCoachDay((ids ?? id).split(',').filter(Boolean)));
      await reload();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ids]);

  /**
   * OPEN THE THREAD A NOTIFICATION WAS ABOUT.
   *
   * This was folded into the loader's effect and it did not work — found on the
   * iOS 26.5 simulator, 10 September 2026, by deep-linking with `openWhole=1`
   * and watching nothing happen. Two things were wrong with that and both are
   * worth stating, because neither is visible in a type check:
   *
   *  1. **`useLocalSearchParams` is empty on the first render.** The loader ran
   *     once on mount and read `openWhole` as `undefined` from that render's
   *     closure. The params arrived a beat later, and by then the only effect
   *     that looked at them had already run and would not run again — its
   *     dependency was `[id]`, and `id` had not changed.
   *  2. **The screen stays mounted.** A background tab keeps its stack alive,
   *     so a second notification about a workout already on screen would not
   *     remount anything either.
   *
   * So the params are dependencies now, and the effect waits for the workout to
   * be loaded — it needs `rows` to turn the stored key ("bench press") into the
   * name the record spells ("Bench Press"), because a sheet header must print
   * the lift, not the lookup key.
   *
   * `autoOpened` makes it fire ONCE per arrival. Without it, closing the sheet
   * would re-open it on the next render for as long as the param sat in the
   * URL, which is a sheet the person cannot dismiss.
   */
  /* The latch remembers WHICH arrival it handled, not merely that it handled
     one. A plain boolean was wrong in a way only the device showed: this screen
     stays mounted in a background tab, so a second notification about a workout
     already on screen re-runs this effect with new params and a latch that says
     "done". Keying it on the params themselves means a new tap opens its
     thread and a dismissed sheet still stays dismissed. */
  const [handledArrival, setHandledArrival] = useState<string | null>(null);
  const arrival = `${id}|${openRef ?? ''}|${openWhole ?? ''}`;
  useEffect(() => {
    if (loading || handledArrival === arrival || !workout) return;
    if (openWhole === '1') {
      setHandledArrival(arrival);
      openThread(null, 'Whole session');
    } else if (openRef) {
      const match = workout.rows.find((r) => entryNoteKey(r.exercise) === openRef);
      setHandledArrival(arrival);
      openThread(openRef, match?.exercise ?? openRef);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, workout, openRef, openWhole, arrival, handledArrival]);

  /* The thread is a separate route now, so the counts on this screen go stale
     while it is up. Refreshing on focus is what a pushed-and-popped sheet costs
     that an in-place `<Modal>` did not — and it is the same cost every other
     detail screen in this app already pays. */
  useFocusEffect(
    useCallback(() => {
      if (!loading) void reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, id]),
  );

  const countFor = (ref: string | null) =>
    comments.filter((c) => (c.exerciseRef ?? null) === ref).length;

  const nameFor = (authorId: string) => (authorId === viewerId ? 'You' : (name ?? 'Client'));
  /** Whose words these are, for the two quoted blocks below. A client reading
   *  their own session must not be told what "they" wrote. */
  const mine = self === '1';
  const facts = workout ? factsOf(workout) : { lifts: 0, sets: 0, volumeKg: 0 };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Session', headerLargeTitle: true }} />
        <ActivityIndicator style={styles.loading} color={color.textMuted} />
      </>
    );
  }

  if (!workout) {
    return (
      <>
        <Stack.Screen options={{ title: 'Session', headerLargeTitle: true }} />
        <View style={styles.content}>
          <Text style={styles.empty} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            This session is no longer available. Your access may have been removed, or the client
            may have deleted it.
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      {/**
        * A LARGE TITLE, like every other screen in this stack (11 Sep 2026).
        *
        * This was the one screen in `you/` with a plain inline title, and it
        * cost two things at once. An inline bar materialises the instant it has
        * content under it, so the top 115 pt of the screen rendered a hard
        * white slab against the warm canvas below — measured on the iOS 26.5
        * simulator, `255,255,255` down to y≈115 where Today reads `247,244,237`
        * from its first row. A large title stays transparent at the top of the
        * scroll and materialises as the reading travels under it, which is what
        * `you/_layout.tsx` describes and what Clients, Join and Invite already
        * get.
        *
        * And the date is a long title. Inline, "Thursday, 10 September" sat a
        * few points from a back button reading the client's full name; as a
        * large title it has the width it needs and the back button keeps the
        * bar to itself.
        */}
      <Stack.Screen
        options={{ title: sessionDayTitle(workout.performedAt), headerLargeTitle: true }}
      />
      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}>
        {/* WHAT THE SESSION WAS, before what was in it.
            The screen used to open straight into a set table, so the first
            thing a coach saw was row 1 of exercise 1 and the size of the
            session had to be inferred by scrolling. Every finished-workout
            screen studied on Appllama (STNDRD `1573298047/oth_tckah`, Symmetry
            `6474446718/oth_sa9ac`, Boostcamp `1529354455/oth_t8187`) leads with
            exactly this — a short count of exercises, sets and volume — and
            puts the detail underneath.
            `RecordStrip` is the app's own three-up, already bare on canvas and
            already tabular, so the coach's reading of one session looks like
            the athlete's reading of their whole record. Absent when the parser
            has not read the text yet: three zeros would report an empty
            session where there is in fact one nobody has parsed. */}
        {/* THE DAY, SPELLED OUT — Today's own grammar (`TodayDateline`). The
            bar carries the short name ("Yesterday", "10 Sep") because a large
            title truncates, and the page carries the full date, so the screen
            says both and cuts neither. Same `subhead`/`textSecondary` treatment
            as Today's, because it is the same sentence about the same thing. */}
        <Text style={styles.dateline} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {sessionDate(workout.performedAt)}
        </Text>

        {facts.sets > 0 ? (
          <View style={styles.summary}>
            <RecordStrip
              stats={[
                { value: String(facts.lifts), label: facts.lifts === 1 ? 'Lift' : 'Lifts' },
                { value: String(facts.sets), label: 'Sets' },
                { value: compactKg(facts.volumeKg), label: 'Kg lifted' },
              ]}
            />
          </View>
        ) : null}

        {/* THE READING. Bare rows on canvas, exactly as the athlete's own
            ledger draws them — no cards, no rules between entries. */}
        {workout.rows.map((row, i) => {
          const ref = entryNoteKey(row.exercise);
          const note = noteFor(workout, row.exercise);
          const count = countFor(ref);
          return (
            <View key={`${ref}-${i}`} style={styles.entry}>
              <View style={styles.entryHead}>
                <Text style={styles.exercise} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {row.exercise}
                </Text>
                <PressableScale
                  onPress={() => openThread(ref, row.exercise)}
                  haptic="light"
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={
                    count ? `${count} comments on ${row.exercise}` : `Comment on ${row.exercise}`
                  }
                  style={styles.commentAffordance}>
                  <Icon name={count ? 'note-on' : 'note'} size={16} tint={count ? color.brand : color.textMuted} />
                  {count ? (
                    <Text style={styles.commentCount} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {count}
                    </Text>
                  ) : null}
                </PressableScale>
              </View>
              <SetTable table={row.table} />
              {note ? (
                <Text style={styles.note} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {note}
                </Text>
              ) : null}
            </View>
          );
        })}

        {/* THE WORDS THEMSELVES, verbatim. */}
        <View style={styles.rawBlock}>
          <Text style={styles.rawLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {mine ? 'As you wrote it' : 'As they wrote it'}
          </Text>
          <Text style={styles.raw} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {workout.rawText}
          </Text>
        </View>

        {workout.reflection ? (
          <View style={styles.rawBlock}>
            <Text style={styles.rawLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {mine ? 'Your note on the session' : 'Their note on the session'}
            </Text>
            <Text style={styles.raw} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {workout.reflection}
            </Text>
          </View>
        ) : null}

        {/* THE ACTION THIS SCREEN EXISTS FOR, at the weight of one.
            It was a 15 pt grey row with a glyph, floating in the empty
            two-thirds of the owner's screenshot — indistinguishable from a
            label, and the only thing a coach comes here to DO. It is a
            secondary `AppButton` now: the app's own control, full width, at
            the end of the reading, which is where a person finishes and has
            something to say. Secondary rather than primary because the reading
            above it is the point of the screen and a filled blue pill would
            out-shout it. */}
        <AppButton
          variant="secondary"
          label={
            countFor(null)
              ? `Comments on the whole session (${countFor(null)})`
              : mine
                ? 'Write to your coach'
                : 'Comment on the whole session'
          }
          onPress={() => openThread(null, 'Whole session')}
        />
      </ScrollView>

    </>
  );
}

const styles = StyleSheet.create({
  /**
   * THE CANVAS IS THE SCROLL VIEW'S OWN BACKGROUND (11 September 2026).
   *
   * Every screen in this folder drew the retired grouped world instead of the
   * app's paper. Sampled on the iOS 26.5 simulator: a flat `242,242,242` from
   * the status bar to the tab bar, against Today's `247,245,238 → 245,244,243`.
   * The design skill is explicit that there is no `#F2F2F7` grouped world left,
   * and the coaching stack was the last place still living in it.
   *
   * `you/_layout.tsx` already hangs a `PaperField` beside its navigator, and
   * that is exactly why this is needed: **the navigator's own container view is
   * opaque and paints over the sibling.** That file has the whole probe. The
   * answer it lands on is this one — the gradient goes on the scroll view's own
   * style, where it needs no sibling and sits under no container, and the
   * screen keeps its collapsing large title.
   */
  scroll: {
    flex: 1,
    experimental_backgroundImage: PAPER_FIELD_CSS,
  },
  content: { paddingHorizontal: spacing.xxl, paddingBottom: TAB_BAR_CLEARANCE + spacing.xxl, gap: spacing.xxl },
  loading: { paddingVertical: spacing.huge },
  empty: { ...type.body, color: color.textMuted, paddingVertical: spacing.xxl },
  /** The full date, under the bar's short one. */
  dateline: { ...type.subhead, color: color.textSecondary },
  entry: { gap: spacing.sm },
  entryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  exercise: { ...type.headline, color: color.textPrimary, flex: 1 },
  commentAffordance: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28 },
  commentCount: { ...type.caption, color: color.brand },
  /** The client's own remark about that lift, quoted and never summarised. */
  note: { ...type.subhead, color: color.textSecondary, fontStyle: 'italic' },
  rawBlock: { gap: spacing.xs, borderTopWidth: hairline, borderTopColor: color.border, paddingTop: spacing.lg },
  rawLabel: { ...type.footnote, color: color.textMuted, textTransform: 'uppercase', letterSpacing: 1.6 },
  raw: { ...type.body, color: color.textPrimary },
  /** The strip needs air under it before the first exercise — it is a
   *  different KIND of thing from the rows below, and air is what says so. */
  summary: { paddingBottom: spacing.sm },
});
