import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getReflection, getWorkoutById, setReflection } from '@/lib/db/workouts';
import {
  EFFORT_CHOICE_LABEL,
  EFFORT_CHOICES,
  EFFORT_HINT,
  effortChoiceOf,
  readEffort,
} from '@/lib/effort';
import { markReflectionAdded } from '@/lib/funnel';
import { tap } from '@/lib/haptics';
import { groupThousands } from '@/lib/parse/estimate';
import { lastSetTextOf } from '@/lib/parse/receipt';
import { formatDistanceTotal } from '@/lib/parse/summarize';
import {
  composeReflection,
  REFLECTION_PLACEHOLDER,
  REFLECTION_TAGS,
  reflectionCharsLeft,
  reflectionRoomFor,
  splitReflection,
} from '@/lib/reflection';
import {
  color,
  hairline,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  spacing,
  type,
} from '@/lib/theme';
import { useCurrentNote, useSession } from '@/state/session-store';

import { Icon } from './icon';
import { AppButton, Eyebrow } from './primitives';
import { PressableScale } from './motion';
import { Segmented } from './settings-rows';

/**
 * The end-of-session check-in (product-direction §8.1) — ONE sheet, opened once
 * right after Finish, and reachable again from the session summary (the resting
 * today pill) because the honest moment to answer is sometimes twenty minutes
 * later on the train home.
 *
 * ## The shape the owner drew (17 Aug 2026)
 *
 * "How did it go?", the session's own line under it, then the two questions in
 * the order the athlete can answer them: **the lifts first, the words second.**
 * That ordering reverses the 29 July build, and the reason is the record: the
 * sheet now READS what was trained and asks about THAT — one row per lift, its
 * last set printed beside the name — instead of opening on a blank field. A
 * blank field is work; three chips against a lift you finished four minutes ago
 * is recall.
 *
 * IT CARRIES TWO THINGS, and they are stored in deliberately different places:
 *
 *  1. **How each lift felt** — three answers, not four (`lib/effort.ts`). A tap
 *     APPENDS `rpe 9` into the line the user wrote, so the parser reads it like
 *     any other word and the engine gets its RIR through the one path it
 *     already has. The words are the record (§3).
 *  2. **Anything worth remembering** — the reflection, in its own column on the
 *     workout. Prose about the session, not notation inside it: appending it to
 *     `raw_text` would hand "legs felt heavy" to the parser, and a re-parse
 *     could then rewrite or lose it.
 *
 * ONLY UNRATED LIFTS ARE ASKED ABOUT. A line that already carries an RPE — one
 * the lifter typed themselves, or one marked here in an earlier visit — is not
 * asked twice. The set is FROZEN when the sheet opens (or when the parse lands,
 * if it is still in flight), so answering a row never makes it vanish under the
 * thumb mid-tap.
 *
 * THE CHIPS UNDER THE FIELD ANSWER, they do not suggest (owner, 17 Aug 2026 —
 * this reverses the July placeholder ruling). Multi-select, nothing
 * preselected, every one togglable off, and what they contribute is visible on
 * the sheet the whole time. See `lib/reflection.ts` for how they are stored.
 *
 * NOTHING HERE IS REQUIRED, and since 9 September 2026 the sheet says so in
 * words rather than in buttons. There used to be a Skip beside the ×; both, and
 * the footer button, and the swipe, all called the identical function, so the
 * only thing the extra control added was the suggestion that one of the exits
 * discarded something. None of them ever did. What is left is one way out at
 * the top, one Done at the bottom, and the permission stated twice where a
 * person is actually deciding: under the lifts ("or leave it, Recore will not
 * guess") and under the button ("You can change any of this later").
 *
 * NOT A HEALTH ASSESSMENT (§8.1, §12). Nothing read here becomes a number, a
 * chart, a streak or a verdict. Step 4 may let the guarded brief quote a recent
 * reflection; it will never let one change a load.
 *
 * ## IT IS A NATIVE FORM SHEET (6 September 2026)
 *
 * The body below is the whole of the `/check-in` route (`app/check-in.tsx`); the
 * presentation — detents, grabber, corner radius, the cream surface — is the
 * `Stack.Screen` config in `app/_layout.tsx`. Nothing inside changed with the
 * move except what the new container forces:
 *
 * - **No `<BottomSheet>` wrapper.** The grabber, the scrim and the drag are
 *   UIKit's now, so the root is a plain flex box and the ScrollView between the
 *   fixed head and the fixed footer takes `flex: 1`.
 * - **The sheet no longer floats clear of the home indicator.** A form sheet is
 *   anchored to the screen edge at every detent, so the footer pays the bottom
 *   inset itself — `bottom-sheet.tsx` used to own that gap and its callers were
 *   forbidden from adding it.
 * - **A swipe down is a route pop, and it calls nothing.** `commit` therefore
 *   also runs from an unmount cleanup; see it for why that cannot lose or
 *   duplicate a reflection.
 */
export function CheckInSheet() {
  const receipt = useSession((s) => s.receipt);
  const workoutId = useSession((s) => s.workoutId);
  const setLineEffort = useSession((s) => s.setLineEffort);
  const note = useCurrentNote();

  const [text, setText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  // Which lines this visit asks about — see "only unrated lifts" above. Null
  // until there is a parse to read it from.
  const [askLines, setAskLines] = useState<number[] | null>(null);
  // What was already stored when the sheet opened, so re-opening from the
  // receipt shows the note instead of an empty field, and so the §13 event
  // fires on a genuinely NEW reflection rather than on every edit.
  const stored = useRef<string | null>(null);

  /**
   * What is on the sheet right now, readable from a cleanup that closes over
   * nothing. Written in an effect rather than during render: the React Compiler
   * is on (`app.json` experiments) and a render-phase ref write is exactly the
   * thing it is allowed to reorder.
   *
   * IT IS DECLARED BEFORE THE LOAD EFFECT ON PURPOSE. Effects run in definition
   * order, so on the mount pass this one writes the empty initial state FIRST
   * and the load below then overwrites it with what was stored. The other order
   * leaves a mount-unmount-mount cycle (StrictMode) holding an empty draft
   * against a real `stored.current`, and the unmount commit would erase a
   * reflection nobody touched.
   */
  const latest = useRef({ text: '', tags: [] as string[], workoutId });
  useEffect(() => {
    latest.current = { text, tags, workoutId };
  });

  useEffect(() => {
    if (!workoutId) return;
    const existing = getReflection(workoutId);
    stored.current = existing;
    const parts = splitReflection(existing);
    latest.current = { text: parts.text, tags: parts.tags, workoutId };
    setText(parts.text);
    setTags(parts.tags);
  }, [workoutId]);

  /**
   * Freeze the question set. Deliberately NOT a plain derivation of the note:
   * the first tap on a row writes an RPE into that line, which would make the
   * row unrated no longer — and the row would disappear from under the finger
   * that just answered it. It is computed once per visit, from the first parse
   * this visit sees (the sheet opens before the parse lands when someone
   * finishes fast, and offline it may never land at all).
   */
  useEffect(() => {
    if (!receipt) return;
    setAskLines((prev) => {
      if (prev !== null) return prev;
      const lines = note.split('\n');
      const seen = new Set<number>();
      const next: number[] = [];
      for (const row of receipt.rows) {
        if (seen.has(row.line)) continue; // a run-on line is rated once
        seen.add(row.line);
        if (readEffort(lines[row.line] ?? '') === null) next.push(row.line);
      }
      return next;
    });
  }, [receipt, note]);

  // One entry per lift still to rate, carrying whatever marker its line has
  // right now. Read from the note rather than held in state, so the sheet and
  // the note can never disagree.
  const rows = useMemo(() => {
    if (!receipt || !askLines) return [];
    const lines = note.split('\n');
    const ask = new Set(askLines);
    const seen = new Set<number>();
    const out = [];
    for (const row of receipt.rows) {
      if (!ask.has(row.line) || seen.has(row.line)) continue;
      seen.add(row.line);
      out.push({
        line: row.line,
        exercise: row.exercise,
        lastSet: lastSetTextOf(row),
        current: effortChoiceOf(readEffort(lines[row.line] ?? '')),
      });
    }
    return out;
  }, [receipt, askLines, note]);

  /**
   * The session's own line: "2 lifts · 9,840 kg · 48 min". Every part is read
   * from the record and any part that cannot be read honestly is simply absent
   * — a run-only day totals in distance, and a span too short or too long to be
   * a session drops the duration rather than printing a number nobody lived.
   */
  const summary = useMemo(() => {
    const parts: string[] = [];
    const lifts = receipt ? new Set(receipt.rows.map((r) => r.exercise)).size : 0;
    if (lifts > 0) parts.push(`${lifts} ${lifts === 1 ? 'lift' : 'lifts'}`);
    if (receipt && receipt.volume > 0) parts.push(`${groupThousands(receipt.volume)} kg`);
    else if (receipt && receipt.distanceM > 0) parts.push(formatDistanceTotal(receipt.distanceM));

    const w = workoutId ? getWorkoutById(workoutId) : null;
    if (w) {
      const mins = Math.round(
        (new Date(w.updated_at).getTime() - new Date(w.created_at).getTime()) / 60_000,
      );
      if (mins >= 10 && mins <= 360) parts.push(`${mins} min`);
    }
    return parts.join(' · ');
    // The workout row's timestamps move with every keystroke; re-read whenever
    // the parse behind the receipt does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt, workoutId]);

  /**
   * Persist, and nothing else. Runs for Done, for the × — and, through the
   * cleanup below, for a swipe down, because all three mean the same thing:
   * keep exactly what is on the sheet.
   *
   * LEAVING IS NOT A DISCARD, by any door. Words a person typed are never
   * thrown away by the app, and leaving an untouched sheet stores nothing
   * anyway, which is what makes answering nothing free (`composeReflection`
   * resolves empty to null).
   *
   * IT IS IDEMPOTENT, which is what lets the button path and the unmount path
   * both call it: the write is guarded on the composed value differing from
   * `stored.current`, so committing twice writes once and counts once.
   */
  const commit = () => {
    const { text: t, tags: g, workoutId: id } = latest.current;
    if (!id) return;
    const next = composeReflection(g, t);
    if (next === stored.current) return;
    setReflection(id, next);
    // Counted only when a note appears where there was none. An edit is not a
    // new reflection, and a deletion is certainly not one.
    if (next !== null && stored.current === null) markReflectionAdded();
    stored.current = next;
  };

  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });

  /**
   * THE SWIPE IS A REAL WAY OUT, and it calls none of the buttons. The old
   * `<BottomSheet>` routed its drag-dismiss through `onClose`; a form sheet
   * pops the route from UIKit and tells JS nothing beyond the unmount. So the
   * unmount IS the last honest moment to keep what was typed.
   */
  useEffect(() => () => commitRef.current(), []);

  /**
   * Nothing to attach a note to. The route should not have been pushed, and an
   * empty sheet is a worse answer than no sheet: leave rather than present one.
   */
  useEffect(() => {
    if (!workoutId && router.canGoBack()) router.back();
  }, [workoutId]);

  // The sheet renders whenever there is a session to attach a note to. It must
  // NOT wait for a parse: offline, or before the edge function answers, there
  // are no lift rows and the check-in still has to work (§2 invariant 1).
  if (!workoutId) return null;

  const charsLeft = reflectionCharsLeft(text);

  const commitAndClose = () => {
    commit();
    router.back();
  };

  const toggleTag = (t: string) => {
    tap();
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  return (
    // THE SHEET DOES NOT PAY THE HOME INDICATOR TWICE (9 September 2026).
    //
    // This used to add `Math.max(insets.bottom, spacing.xxl)`, which left a
    // visible band of empty cream under the footnote — measured on the iOS 26.5
    // simulator, about 50 pt of it. The reason is that the safe-area provider
    // inside a form sheet reports the WINDOW's insets, not the card's:
    // `useSafeAreaFrame()` here returns the full 874 pt window, so
    // `insets.bottom` is the home indicator's 34 pt even though iOS 26 floats
    // the card clear of the indicator and the card has already paid it. Adding
    // it again is paying twice for one gap.
    //
    // So it is a flat, chosen number. The lowest thing in the sheet is a
    // footnote, not the button — the button sits a line above it — so even on a
    // presentation that does reach the screen edge, nothing anybody taps ends up
    // under the indicator.
    // THE SCROLL VIEW IS THE SHEET, and that is the fix (9 September 2026).
    //
    // It used to be a fixed head, a `flex: 1` ScrollView and a fixed footer
    // inside a plain `View`, and the sheet came out razkosano — the question,
    // the lifts and the button drawn on top of one another. Tinting each region
    // and photographing it on the iOS 26.5 simulator showed why in one frame:
    // **the ScrollView's own background filled the entire sheet**, top to
    // bottom, with the head and the footer painted inside it at the positions
    // Yoga had given them. A form sheet adopts the first scroll view it finds
    // and resizes it to the presentation, because that is the view it drives
    // the detent and the drag-to-dismiss from — so the layout was not fighting
    // the styles, it was fighting UIKit for ownership of that view.
    //
    // Give it the view. Everything is content now: the ×, the question, the
    // lifts, the field and the button all live in one scroll, which is what a
    // native form sheet is. Nothing needs a definite height from a parent, so
    // there is nothing left to collapse — and `fitToContents` can measure this
    // and size the sheet to it, which a `flex: 1` child could never be measured
    // for.
    //
    // The way out is never lost with the button: UIKit's grabber and its
    // downward swipe are always there, at every scroll position, and both
    // commit through the unmount like every other exit.
    <ScrollView
      style={styles.sheet}
      contentContainerStyle={[
        styles.sheetContent,
        { paddingBottom: spacing.xxl },
      ]}
      // A scroll puts the keyboard away, and an unhandled tap in here does too
      // ("handled" only spares taps a child actually took, so the chips and the
      // effort rows still answer on the first tap).
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}>
      {/* ONE way out at the top, not two (9 September 2026).
          × and Skip both called `commitAndClose` — the SAME function, the same
          outcome, one labelled as leaving and one as declining. That is three
          controls for one intent once the footer button is counted, and the
          labels were the lie rather than the count: "Skip" reads as *discard*,
          and this sheet has never discarded anything. So × stays (it is what a
          person reaches for, and the swipe does the same), the footer says what
          it does, and nothing on screen implies that leaving costs you what you
          typed. The permission not to answer is still stated, twice, in words
          that are true: the hint under the lifts and the line under the
          button. */}
      <View style={styles.topRow}>
        <Pressable
          onPress={commitAndClose}
          hitSlop={spacing.md}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={({ pressed }) => [styles.close, pressed && styles.pressedDim]}>
          {/* The size and the tone iOS gives a sheet's close button: a 28 pt
              grey disc with the × knocked out of it, not a near-black dot. */}
          <Icon name="close" size={moderateScale(28)} tint={color.textMuted} />
        </Pressable>
      </View>

      {/* The sheet's own head doubles as a way to put the keyboard down. The
          field below is MULTILINE, so its return key writes a newline rather
          than finishing — tapping the question you are answering is the
          nearest thing to "I am done typing", and it costs nothing. Not a
          control to VoiceOver (`accessible={false}`): the two lines stay two
          readable lines, and the keyboard is dismissed by the rotor there. */}
      <Pressable accessible={false} onPress={Keyboard.dismiss}>
        <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          How did it go?
        </Text>
        {summary.length > 0 ? (
          <Text style={styles.summary} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {summary}
          </Text>
        ) : null}
      </Pressable>

      <View style={styles.body}>
        {/* The lifts, when there is parsed work left to rate. Absent entirely
            before a parse lands (the offline case) and absent when every line
            already carries an effort — the check-in below still works. */}
          {rows.length > 0 ? (
          <View style={styles.section}>
            {/* An EYEBROW, not a second headline. The sheet asked its question
                once at 27 pt; "How each lift felt" and "Anything worth
                remembering" are the two answers' headers, and at `title2` they
                competed with the question and with each other. Three bold
                headings in a 60%-tall sheet is a sheet made of headings. */}
            <Eyebrow tone="secondary">How each lift felt</Eyebrow>

            {rows.map((row, i) => (
              <View
                key={`${row.line}:${row.exercise}`}
                style={[styles.lift, i > 0 && styles.liftDivided]}>
                <View style={styles.liftHead}>
                  <Text
                    style={styles.liftName}
                    numberOfLines={1}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {row.exercise}
                  </Text>
                  {row.lastSet ? (
                    <Text
                      style={styles.liftSet}
                      numberOfLines={1}
                      maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {`${row.lastSet} last set`}
                    </Text>
                  ) : null}
                </View>

                {/* ONE SEGMENTED CONTROL PER LIFT, not three pills.
                    Three full-width pills stood 44 pt tall on a hairline-
                    separated block, so a four-lift session spent four hundred
                    points saying the same three words four times — and on a
                    cream sheet each pill was `surface` on `surface` with a
                    hairline, which is an outline of a control rather than a
                    control. A segmented control is what iOS uses for pick-one-
                    of-three: a recessed track that is visibly a control at
                    rest, a thumb that says which one is chosen, and 32 pt
                    instead of 44. It is the app's own `Segmented`, the same one
                    the settings sheets use, so an answer here is picked with
                    the gesture a preference is picked with.

                    Tapping the chosen answer again still clears it — the one
                    thing a real `UISegmentedControl` will not do, and the
                    reason this is Recore's component and not UIKit's: nothing
                    on this sheet is required, so every answer has to be
                    revocable. */}
                <Segmented
                  options={EFFORT_CHOICES.map((e) => ({
                    id: e,
                    label: EFFORT_CHOICE_LABEL[e],
                  }))}
                  selected={row.current}
                  onSelect={(e) => setLineEffort(row.line, row.current === e ? null : e)}
                  labelFor={(e) => `${row.exercise}: ${EFFORT_CHOICE_LABEL[e]}, ${EFFORT_HINT[e]}`}
                />
              </View>
            ))}

            <Text style={styles.hint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              tap one — or leave it, Recore will not guess
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Eyebrow tone="secondary">Anything worth remembering</Eyebrow>

          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            maxLength={reflectionRoomFor(tags)}
            placeholder={REFLECTION_PLACEHOLDER}
            placeholderTextColor={color.textMuted}
            selectionColor={color.brand}
            cursorColor={color.brand}
            accessibilityLabel="Anything worth remembering about today. Optional."
            style={styles.input}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />

          {/* Preset answers, multi-select. What they contribute is stored as
              the reflection's own first line — the athlete's chosen words. */}
          <View style={styles.tags}>
            {REFLECTION_TAGS.map((t) => {
              const on = tags.includes(t);
              return (
                <PressableScale
                  key={t}
                  onPress={() => toggleTag(t)}
                  haptic="none"
                  activeScale={0.96}
                  accessibilityRole="button"
                  accessibilityLabel={t}
                  accessibilityState={{ selected: on }}
                  style={[styles.tag, on && styles.tagOn]}
                  pressedStyle={on ? styles.pressedOnFill : undefined}>
                  <Text
                    style={[styles.tagText, on && styles.tagTextOn]}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {t}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          {/* The promise belongs UNDER the whole answer, not between the field
              and its own chips: the chips write into the same reflection the
              field does, and a line of grey between them read as the end of
              one thing and the start of another. */}
          <Text style={styles.hint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            optional · never shown to anyone
          </Text>

          {charsLeft != null ? (
            <Text style={styles.counter} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {`${charsLeft} characters left`}
            </Text>
          ) : null}
        </View>

      </View>

      <View style={styles.footer}>
        {/* "Done", not "Save session". The session was saved when it was
            finished; this sheet only ever adds a reflection and a few RPE
            tokens, and it commits them on every exit — the button, the ×, the
            swipe. A button promising to save the session implied that leaving
            any other way would not, which was the opposite of what the code
            does. "Done" is true whether or not a word was typed, which is also
            what makes it the right label on a sheet where nothing is
            required. */}
        <AppButton label="Done" onPress={commitAndClose} />
        <Text style={styles.foot} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          You can change any of this later.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  /**
   * NO `flex: 1`, AND THAT IS THE FIX (9 September 2026).
   *
   * It had `flex: 1` and `_layout.tsx` had `contentStyle: { flex: 1 }` to give
   * it something to resolve against. Measured on the iOS 26.5 simulator with
   * `onLayout` printed onto the sheet: **presented as a form sheet, every view
   * in here reported height 0** — root, head, scroll and footer alike — so each
   * child drew its own content from the sheet's top edge and the question, the
   * lifts and the button landed on top of one another. The same screen
   * presented full-screen measured 874 / 86 / 582 / 81 and laid out perfectly,
   * which is what proves the presentation is the cause and not the styles.
   *
   * So the direction is reversed: the sheet does not take its height from the
   * container, the container takes its height from the sheet. `fitToContents`
   * in `_layout.tsx` measures what is here and sizes the presentation to it,
   * and nothing in this file needs a definite height from a parent that will
   * not give one.
   *
   * It is the better sheet for its own sake, too: a one-lift session gets a
   * short sheet and an eight-lift session a tall one, instead of both getting
   * the same 60% and one of them being mostly empty.
   */
  sheet: {
    // The colour is also on `contentStyle` in `_layout.tsx`; keeping it here
    // means no frame of system grey can show while the screen mounts.
    backgroundColor: color.surface,
  },
  sheetContent: {
    paddingHorizontal: spacing.xl,
    // Clearance under the native grabber, which replaced the old sheet's own
    // handle (it padded 8 over and 6 under).
    paddingTop: spacing.md,
  },
  topRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  close: {
    marginLeft: -spacing.xs,
  },
  pressedDim: {
    opacity: 0.5,
  },
  // `title` (27), not `largeTitle` (34). A large title is the top of a PAGE;
  // this is the top of a sheet that has to fit its question, its lifts, a
  // field and a button inside about two-thirds of a screen, and 34 pt spent
  // seven of those points on one line.
  title: {
    marginTop: spacing.md,
    ...type.title,
    color: color.textPrimary,
  },
  summary: {
    marginTop: spacing.xs,
    ...type.subhead,
    color: color.textSecondary,
  },
  // The two answers, and the air between them. It was the scroll's
  // `contentContainerStyle` gap until the scroll became the sheet itself; as a
  // wrapper it keeps the same rhythm without the head and the footer joining in.
  body: {
    marginTop: spacing.lg,
    gap: spacing.xxl,
  },
  section: {
    gap: spacing.sm,
  },

  // --- how each lift felt ---
  lift: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  liftDivided: {
    borderTopWidth: hairline,
    borderTopColor: color.border,
    paddingTop: spacing.lg,
    marginTop: spacing.md,
  },
  liftHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  liftName: {
    flexShrink: 1,
    ...type.lede,
    color: color.textPrimary,
  },
  // A READING — the load and reps this lift actually finished on — so it is
  // the app's number face, like every other reading in the app.
  liftSet: {
    flexShrink: 1,
    ...readingStyle('400'),
    fontSize: moderateScale(12),
    color: color.textSecondary,
    textAlign: 'right',
  },
  hint: {
    marginTop: spacing.xs,
    ...type.footnote,
    lineHeight: lineFor(16),
    color: color.textMuted,
  },

  // --- anything worth remembering ---
  input: {
    minHeight: moderateScale(96),
    // A FIELD, so `radius.lg` 20 (skill §Spacing) — `md` 14 is a button's.
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: color.surfaceHigh,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    textAlignVertical: 'top',
    ...type.body,
    lineHeight: lineFor(24),
    color: color.textPrimary,
  },
  tags: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  // THE CHIP HAS A GROUND NOW. It was `surface` on a `surface` sheet with a
  // hairline around it — a chip drawn as an outline of itself, and on cream
  // that hairline is the only thing saying a control is there at all. The
  // recessed tone is what the field beside it already uses, so the two read as
  // one answer with two ways in.
  tag: {
    minHeight: moderateScale(40),
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: hairline,
    borderColor: 'transparent',
    backgroundColor: color.surfaceHigh,
  },
  tagOn: {
    backgroundColor: color.brand,
    borderColor: color.brand,
  },
  tagText: {
    ...type.caption,
    color: color.textPrimary,
  },
  tagTextOn: {
    color: color.surface,
    fontWeight: '600',
  },
  /** Pressing something already chosen darkens the blue instead of washing it
   * out — the answer must not look like it is being taken away. */
  pressedOnFill: {
    opacity: 0.86,
  },
  counter: {
    ...type.caption,
    color: color.textMuted,
    textAlign: 'right',
  },
  footer: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  foot: {
    ...type.footnote,
    lineHeight: lineFor(16),
    color: color.textMuted,
    textAlign: 'center',
  },
});
