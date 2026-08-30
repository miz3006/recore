import { useEffect, useMemo, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { getLastSessionPrefill } from '@/lib/db/last-set';
import { getReflection } from '@/lib/db/workouts';
import { readEntryNote } from '@/lib/entry-note';
import { tap, tapMedium } from '@/lib/haptics';
import { DUR, SPRING } from '@/lib/motion';
import { namesMatch, typedNameOf, type ReceiptRow } from '@/lib/parse/receipt';
import { doneKeyFor } from '@/lib/parse/summarize';
import {
  COMPOSER_HINT_SESSIONS,
  hasCoachRingDone,
  hasComposerHintDone,
  hasFinishedOnce,
  markCoachRingDone,
  markComposerHintDone,
} from '@/lib/prefs';
import { reflectionTagLine, splitReflection } from '@/lib/reflection';
import { color, FIXED_FONT_SCALE, HIT, lineFor, MAX_FONT_SCALE, moderateScale, readingStyle, spacing } from '@/lib/theme';
import { useCurrentNote, useSession } from '@/state/session-store';

import { EntryActionsSheet, joinNames, type EntryAction } from './entry-actions-sheet';
import { comparisonOf, PrLabel, ReadingMark, ReadingSweep } from './gutter-value';
import { Icon } from './icon';
import { PressableScale } from './motion';
import { BODY_PADDING_H, BODY_PADDING_TOP } from './note-metrics';
import { noteInputRef, noteScrollRef } from './note-focus';
import { SetTable, worthTable } from './set-table';
import { useSessionActive } from './use-session-active';

/**
 * The composer ("Recore Light", Mobbin-referenced: Fitbod's spaced exercise
 * list + a natural-language input, like Booking's "search in your own words").
 *
 * You write a session ONE exercise at a time: type a line, press return, and it
 * settles into a structured CARD — the resolved exercise, its sets in mono,
 * marked read — while the input clears for the next. Everything you've entered
 * stacks above as clean, well-spaced blocks; when a single line carries several
 * exercises the parser splits them into a card each. Tap a card to edit its
 * line inline; LONG-PRESS it to see the line you actually wrote in place of the
 * reading, and tap it to flip back; the ⋯ opens the card's four actions (fix ·
 * note · history · delete — entry-actions-sheet.tsx); the alias echo beside an
 * auto-corrected name opens the correction sheet directly. The raw text stays the source of truth
 * (`note` is still the full log, newline-joined); the cards are a live
 * projection of the parse. No predictor — the app's one job on open is to read
 * what you did.
 *
 * ONE PROMPT PER SESSION, NOT PER CARD (owner, 11 Aug 2026). The note bubble
 * that used to sit on every card is gone; the invitation to write about
 * training now appears once, under the ledger, when the session has actually
 * ended (§8.1). Writing about a single lift survives inside the ⋯ sheet.
 */
/**
 * THE EMPTY CANVAS (owner, 12 August 2026).
 *
 * A day with nothing written on it used to greet the athlete with a plan strip,
 * a week recap card, a first-session tutorial, a checklist ring, a weekly total
 * and a floating pill — six pieces of furniture around a blank line. Now it is
 * a blank page with one sentence on it, the whole surface is the tap target
 * (Apple Notes), and every one of those pieces arrives only once there is
 * something for it to describe. The page is the product; furniture around an
 * empty page is the app talking to itself.
 */
/** Today's own placeholders, exported so the demo asks for the same thing in
 * the same words. */
export const PLACEHOLDER = 'Write your training…';
export const NEXT_PLACEHOLDER = 'Next exercise…';

/** When the parser resolved a line to a name the user did NOT type ("tricpes" →
 * "Triceps Pushdown"), echo their original word beside the card (X4) — the
 * auto-fix stays visible and tappable to correct, never a silent rename. Only
 * for a single-exercise line (a run-on line has no one typed name). */
function aliasEchoOf(rawLine: string, canonical: string): string | null {
  const typed = typedNameOf(rawLine);
  return typed && !namesMatch(typed, canonical) ? typed : null;
}

export function NoteSurface() {
  const note = useCurrentNote();
  const setNote = useSession((s) => s.setNote);
  const receipt = useSession((s) => s.receipt);
  const parsing = useSession((s) => s.parsing);
  const parsedSnapshot = useSession((s) => s.parsedSnapshot);
  const openExerciseSheet = useSession((s) => s.openExerciseSheet);
  const openFixSheet = useSession((s) => s.openFixSheet);
  const editingLine = useSession((s) => s.editingLine);
  const startEditLine = useSession((s) => s.startEditLine);
  const stopEditLine = useSession((s) => s.stopEditLine);
  const deleteNoteLine = useSession((s) => s.deleteNoteLine);
  const undone = useSession((s) => s.undone);
  const toggleDone = useSession((s) => s.toggleDone);
  const entryNotes = useSession((s) => s.entryNotes);
  const openEntryNote = useSession((s) => s.openEntryNote);
  const openCheckIn = useSession((s) => s.openCheckIn);
  const checkInOpen = useSession((s) => s.checkInOpen);
  const userId = useSession((s) => s.userId);
  const workoutId = useSession((s) => s.workoutId);
  const reduceMotion = useReducedMotion();
  // Shared with the resting pill, so the two can never disagree about whether
  // the athlete is still training (`lib/session-activity.ts`).
  const sessionActive = useSessionActive();
  // Sessions on record — the first-run hint's only condition.
  const sessionCount = useSession((s) => s.sessionCount);

  // The live half of the first-session tutorial (the FIRST SESSION card's
  // step two): one quiet line under the ledger until the user has actually
  // worked a card — toggled its ring or opened its history. The flag is the
  // retirement, so the hint is earned away, never dismissed.
  const [coachRingDone, setCoachRingDone] = useState(() => hasCoachRingDone());
  const retireCoachRing = () => {
    if (!coachRingDone) {
      markCoachRingDone();
      setCoachRingDone(true);
    }
  };

  // The ⋯ sheet's card (owner, 6 Aug). `actionsRow` outlives `actionsOpen` on
  // purpose: History and Fix reading open OTHER modals, and UIKit only allows
  // one at a time — so the chosen action fires from the sheet's onSelect
  // (after the native modal is gone) and still needs to know which card it
  // was for. The row is cleared there, never on close.
  const [actionsRow, setActionsRow] = useState<ReceiptRow | null>(null);
  /** The OTHER entries on `actionsRow`'s physical line, snapshotted the moment
   * the sheet opened — for the same reason `actionsRow` outlives `actionsOpen`:
   * a parse landing mid-sheet must not change what the athlete was warned
   * about between reading the row and confirming it. */
  const [actionsSiblings, setActionsSiblings] = useState<string[]>([]);
  const [actionsOpen, setActionsOpen] = useState(false);
  /** Which card is showing the athlete's own words instead of the reading —
   * one at a time, so flipping a second card settles the first. Held here
   * rather than inside the card only because the list owns "one at a time". */
  const [wordsKey, setWordsKey] = useState<string | null>(null);
  /**
   * DELETE ASKS FIRST, AND NAMES WHAT GOES (20 August 2026).
   *
   * Two things were wrong with the one-tap delete. It removed a PHYSICAL LINE
   * while calling itself "Delete entry", and one line can hold several entries
   * ("bench 3x8, rows 3x10" is one line, two cards) — so deleting the bench
   * silently took the rows with it. There is no fixing that by deleting less:
   * `ParsedItem` carries no offset back into the sentence, and guessing at a
   * substring of what the athlete wrote would corrupt the record (§3). The line
   * is the only honest unit, so the athlete is TOLD it is the unit — on the row
   * itself (`alsoOnLine`) and again here.
   *
   * And it never asked. `deleteNoteLine` splices out of `note`, which is
   * `raw_text`, which is the record, and there is no undo stack behind it —
   * while the far gentler "Remove reading" in the fix sheet, which deletes
   * nothing the athlete wrote, already stops to ask. Same Alert shape as that
   * one, so the app has one destructive voice.
   *
   * It runs from `onSelect`, i.e. after the sheet's native modal is gone. An
   * alert is a presentation like any other, and UIKit will refuse it over a
   * live modal exactly as it refuses a second sheet.
   */
  const confirmDeleteLine = (
    line: number,
    /** The entry the ⋯ was tapped on, when that is where this came from. The
     * inline editor deletes the line it is editing, and says so instead. */
    entry: { exercise: string; alsoOnLine: string[] } | null,
  ) => {
    const what = entry
      ? entry.alsoOnLine.length > 0
        ? `“${entry.exercise}” shares one written line with ${joinNames(entry.alsoOnLine)}, so all of them go.`
        : `The line you wrote for “${entry.exercise}” is removed from this session.`
      : 'The line you wrote is removed from this session.';
    Alert.alert(entry ? 'Delete this entry?' : 'Delete this line?', `${what} This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          tapMedium();
          deleteNoteLine(line);
        },
      },
    ]);
  };

  const runEntryAction = (action: EntryAction) => {
    const row = actionsRow;
    const siblings = actionsSiblings;
    setActionsRow(null);
    setActionsSiblings([]);
    if (!row) return;
    switch (action) {
      case 'note':
        // The athlete's own remark about THIS lift — effort (which moves the
        // next load) and words (which Next quotes back). It used to be a bubble
        // on every card; one door per card, named, is the 11 Aug ruling.
        Keyboard.dismiss(); // the sheet brings its own input
        openEntryNote({ exercise: row.exercise, setText: row.setText, line: row.line });
        break;
      case 'history':
        retireCoachRing();
        openExerciseSheet(row.exercise, row.line);
        break;
      case 'fix':
        Keyboard.dismiss(); // the correction sheet brings its own inputs
        openFixSheet(row.line);
        break;
      case 'delete':
        confirmDeleteLine(row.line, { exercise: row.exercise, alsoOnLine: siblings });
        break;
    }
  };

  const lines = note.split('\n');
  const activeIndex = lines.length - 1;
  const activeValue = lines[activeIndex] ?? '';
  const snapshotLines = useMemo(() => (parsedSnapshot ?? '').split('\n'), [parsedSnapshot]);

  // Parsed exercises grouped by the physical line they were read from — one
  // line can hold several (the parser splits a run-on into a card each).
  const rowsByLine = useMemo(() => {
    const m = new Map<number, ReceiptRow[]>();
    for (const r of receipt?.rows ?? []) {
      const list = m.get(r.line);
      if (list) list.push(r);
      else m.set(r.line, [r]);
    }
    return m;
  }, [receipt]);

  // A line's parse counts only while its text is unchanged since that parse —
  // an edited line goes back to "reading" until the next result lands.
  const parsedFresh = (i: number) => parsedSnapshot !== null && lines[i] === snapshotLines[i];

  const focusInput = () => noteInputRef.current?.focus();

  const setActive = (text: string) => setNote([...lines.slice(0, activeIndex), text].join('\n'));
  const setLineText = (i: number, text: string) =>
    setNote([...lines.slice(0, i), text, ...lines.slice(i + 1)].join('\n'));

  // "Same as last" (L6): the active line NAMES a known exercise, no numbers yet
  // → offer last session's real sets to accept verbatim. A record read, never a
  // prediction; silent with no history. Re-runs as the name is typed, never
  // once a digit appears (that's the user writing their own numbers).
  const lastPrefill = useMemo(() => {
    const v = activeValue.trim();
    if (v.length < 2 || /\d/.test(v) || !userId || !workoutId) return null;
    return getLastSessionPrefill(userId, v, workoutId);
  }, [activeValue, userId, workoutId]);

  const settleActive = (line: string) => {
    // The committed line settles above; a fresh empty line becomes the input.
    setNote([...lines.slice(0, activeIndex), line, ''].join('\n'));
    requestAnimationFrame(() => noteScrollRef.current?.scrollToEnd({ animated: !reduceMotion }));
  };

  const acceptPrefill = () => {
    if (!lastPrefill) return;
    tap();
    settleActive(`${activeValue.trim()} ${lastPrefill.entry}`);
  };

  const commit = () => {
    const value = activeValue.trim();
    if (!value) return;
    // A bare exercise name with history → return accepts last session's sets.
    if (lastPrefill) {
      acceptPrefill();
      return;
    }
    tap();
    settleActive(value);
  };

  // Every committed line (all but the one being typed) becomes a block: the
  // line under inline edit is an input, a parsed line is a card each, an
  // unresolved line is pending, prose is a quiet note.
  const blocks: React.ReactNode[] = [];
  /**
   * One exercise per block, and **nothing is drawn between two of them** (v6,
   * design skill §Structure: *"The record has no cards and no dividers."*).
   *
   * There was a hairline here, inset past the check column, and it was doing
   * two jobs: telling the eye that each line is a separate RECORD, and giving
   * the list a ledger's rhythm. The first job is done by the check marks — they
   * are a vertical run of one mark per record — and by the 24 points of air
   * between two blocks. The second job stopped being possible on the warm
   * canvas: `tableRule` measures **1.16:1** there, so the line was no longer a
   * line, it was a rumour of one.
   */
  const pushBlock = (node: React.ReactNode) => {
    blocks.push(node);
  };

  let settledCards = 0; // the coach hint only speaks once there is a card to work
  for (let i = 0; i < activeIndex; i++) {
    const raw = lines[i] ?? '';
    if (!raw.trim()) continue;
    const rows = rowsByLine.get(i);
    if (i === editingLine) {
      const line = i;
      pushBlock(
        <EditRow
          key={`edit:${i}`}
          value={raw}
          onChange={(t) => setLineText(i, t)}
          onDone={stopEditLine}
          // The SAME `deleteNoteLine`, so the same confirm — a bare one-tap
          // Delete beside an autofocused field, on a line with no undo behind
          // it, was the more accidental of the two doors, not the safer one.
          onDelete={() => confirmDeleteLine(i, null)}
          // "Fix reading" repairs the PARSE of this line (wrong name, wrong
          // numbers) without touching the written words — only offered while
          // the line has a reading to fix.
          onFix={
            rows?.length
              ? () => {
                  tap();
                  Keyboard.dismiss();
                  stopEditLine();
                  openFixSheet(line);
                }
              : null
          }
        />,
      );
      continue;
    }
    if (rows && rows.length && parsedFresh(i)) {
      const alias = rows.length === 1 ? aliasEchoOf(raw, rows[0]!.exercise) : null;
      settledCards += rows.length;
      rows.forEach((row, j) => {
        const key = doneKeyFor(row.exercise, row.setText);
        const cardKey = `${i}:${j}:${row.exercise}`;
        pushBlock(
          <ExerciseCard
            key={cardKey}
            row={row}
            order={i}
            done={!undone[key]}
            alias={alias}
            note={readEntryNote(entryNotes, row.exercise)}
            rawLine={raw.trim()}
            showWords={wordsKey === cardKey}
            reduceMotion={reduceMotion}
            onToggleWords={() => {
              tap();
              setWordsKey((k) => (k === cardKey ? null : cardKey));
            }}
            onToggle={() => {
              tap();
              retireCoachRing(); // the real action is the tutorial's step two
              toggleDone(key); // tap the check → done ↔ not done (stays recorded)
            }}
            onEdit={() => {
              tap();
              startEditLine(row.line); // tap the name → edit the line right here
            }}
            onActions={() => {
              tap();
              // The card's one visible door (owner, 6 Aug) — everything that
              // used to hide behind a gesture: edit, words, note, history, fix,
              // delete.
              setActionsRow(row);
              // The rest of this written line: delete takes the line, so the
              // sheet has to be able to name who leaves with this card.
              setActionsSiblings(rows.filter((r) => r !== row).map((r) => r.exercise));
              setActionsOpen(true);
            }}
            onFix={() => {
              tap();
              Keyboard.dismiss(); // the sheet brings its own inputs
              openFixSheet(row.line); // tap the echoed word → correct the reading
            }}
          />,
        );
      });
    } else if (parsing || !parsedFresh(i)) {
      const line = i;
      pushBlock(
        <PendingCard
          key={`p:${i}`}
          text={raw.trim()}
          reduceMotion={reduceMotion}
          onPress={() => {
            tap();
            startEditLine(line);
          }}
        />,
      );
    } else {
      const line = i;
      pushBlock(
        <NoteCard
          key={`n:${i}`}
          text={raw.trim()}
          onPress={() => {
            tap();
            startEditLine(line);
          }}
        />,
      );
    }
  }

  // The live read-out of the line you're typing right now.
  const activeRows = parsedFresh(activeIndex) ? (rowsByLine.get(activeIndex) ?? null) : null;
  const activePending = activeValue.trim().length > 0 && (parsing || !parsedFresh(activeIndex));
  const empty = note.trim().length === 0;

  // The end-of-session prompt: work on the record, the session no longer live,
  // and nothing written about it yet. Re-read from SQLite on each parse/day
  // change rather than held in state — the check-in writes it, and this row
  // must disappear the moment it does.
  /**
   * THE CANVAS TEST: has today produced a reading yet?
   *
   * Not "is the note empty" — a line typed and not yet parsed is still a blank
   * page as far as the ledger is concerned, and the furniture should not arrive
   * a beat before the card it belongs to. `settledCards` counts the cards
   * actually drawn above, so the canvas and the ledger can never both be on
   * screen.
   */
  const canvas = blocks.length === 0 && editingLine === null;

  /** Fewer than three sessions on record, and the flag not yet retired. The
   * flag is set the moment the third session exists, so the count is read once
   * and never again after that. */
  const [hintDone, setHintDone] = useState(() => hasComposerHintDone());
  useEffect(() => {
    if (!hintDone && sessionCount >= COMPOSER_HINT_SESSIONS) {
      markComposerHintDone();
      setHintDone(true);
    }
  }, [hintDone, sessionCount]);
  const showComposerHint = !hintDone && sessionCount < COMPOSER_HINT_SESSIONS;

  /**
   * THE SESSION'S OWN NOTE, READ BACK (owner, 20 Aug 2026).
   *
   * The check-in used to be write-only from this page: you answered it once,
   * the prompt row vanished, and your words lived on in a column no screen
   * printed. §8.1 calls a reflection part of the record, and a record you
   * cannot re-read is a form you filled in — so the day now prints it under
   * the lifts it is about: the chosen tags on one quiet line, the prose under
   * them, both a step smaller than a lift because they ANNOTATE the session
   * rather than report a number.
   *
   * Read on the same beat as the prompt it replaces — the check-in writes it,
   * so closing that sheet (or changing day) is what makes this current.
   */
  const reflection = useMemo(() => {
    const stored = workoutId ? getReflection(workoutId) : null;
    if (!stored || stored.trim().length === 0) return null;
    const { tags, text } = splitReflection(stored);
    return { tags: reflectionTagLine(tags), text };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId, checkInOpen, receipt]);
  const showReflectionRow = settledCards > 0 && !sessionActive && reflection === null;

  return (
    <>
    <ScrollView
      ref={noteScrollRef}
      style={styles.body}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}>
      <Pressable style={styles.fill} onPress={focusInput}>
        {blocks}

        {/* The session's check-in, printed where the session's lifts end.

            It sits ABOVE the writing line, with the cards, because it is
            written down — the air under the last block is the page's one real
            boundary ("everything above this is recorded"), and the athlete's
            words about the session belong on the recorded side of it. The
            invitation to write them stays below the line, where the unwritten
            lives.

            Tapping re-opens the same check-in, so the note is editable from
            the page that shows it and there is still exactly one place the
            words are written. */}
        {reflection ? (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(220)}>
            <Pressable
              onPress={() => {
                tap();
                Keyboard.dismiss(); // the check-in brings its own field
                openCheckIn();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Your note about this session: ${[reflection.tags, reflection.text]
                .filter((part) => part.length > 0)
                .join('. ')}`}
              accessibilityHint="Opens the check-in to edit it"
              style={({ pressed }) => [styles.reflectNote, pressed && styles.cardPressed]}>
              {reflection.tags.length > 0 ? (
                <Text style={styles.reflectTags} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {reflection.tags}
                </Text>
              ) : null}
              {reflection.text.length > 0 ? (
                <Text style={styles.reflectBody} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {reflection.text}
                </Text>
              ) : null}
            </Pressable>
          </Animated.View>
        ) : null}

        {/* WHAT IS SETTLED AND WHAT IS BEING WRITTEN are separated by AIR, not
            by a line (v6). A rule used to close the record here and it is the
            one boundary on this page that genuinely means something, so it is
            not simply dropped: the active line takes a larger top gap than any
            record-to-record gap, and the largest space on the page is the one
            that says "everything above this is written down". */}

        {/* The active line — where you write. A hollow marker until it settles;
            on a blank canvas there is no marker AND no rail at all, because a
            checklist ring with nothing to check is a control pretending to be
            one — and the empty page should open exactly like a new note in
            Apple Notes: the cursor at the top-left of the page, on the body's
            own margin, with nothing indenting it (owner, 12 Aug 2026).

            The rail arrives with the first card, and `layout` glides the line
            into its indentation instead of snapping — the same beat in which
            the canvas becomes the ledger. */}
        <Animated.View
          style={[
            styles.activeRow,
            blocks.length > 0 && styles.activeRowAfterRecord,
            canvas && styles.activeRowCanvas,
          ]}
          layout={reduceMotion ? undefined : LinearTransition.duration(DUR.slow)}>
          {canvas ? null : (
            <View style={styles.rail}>
              <View style={styles.railHollow} />
            </View>
          )}
          <Animated.View
            style={styles.activeBody}
            layout={reduceMotion ? undefined : LinearTransition.duration(DUR.slow)}>
            <NoteInput
              inputRef={noteInputRef}
              value={activeValue}
              onChangeText={setActive}
              onSubmitEditing={commit}
              onFocus={() =>
                requestAnimationFrame(() => noteScrollRef.current?.scrollToEnd({ animated: true }))
              }
              placeholder={empty ? PLACEHOLDER : NEXT_PLACEHOLDER}
            />
            {/* Live read-out of what you're typing — the parse, before you commit. */}
            {activeRows && activeRows.length ? (
              <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(180)}>
                {activeRows.map((row, j) => (
                  <View key={`ar:${j}`} style={styles.previewRow}>
                    <Text style={styles.previewName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {row.exercise}
                    </Text>
                    <Text style={styles.previewValue} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {row.setText}
                    </Text>
                  </View>
                ))}
                <Text style={styles.previewHint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {activeRows.length > 1
                    ? `return to add ${activeRows.length} exercises`
                    : 'return to add'}
                </Text>
              </Animated.View>
            ) : lastPrefill ? (
              // Last session's real sets — a dim record read to accept verbatim
              // (tap or return) or overwrite by typing your own numbers.
              <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(180)}>
                <Pressable onPress={acceptPrefill} hitSlop={spacing.xs} style={styles.prefillRow}>
                  <Text
                    style={styles.prefillReading}
                    numberOfLines={1}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {lastPrefill.reading}
                  </Text>
                </Pressable>
                <Text style={styles.previewHint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  last session · return to log the same
                </Text>
              </Animated.View>
            ) : activePending ? (
              // THE COMPOSER'S VALUE COLUMN. There are no committed words here
              // for a light to pass under — the line is still in the field
              // above, and moving anything under a cursor mid-sentence is the
              // one thing §14 rules out outright. So the working mark alone
              // waits in the column the live read-out prints its value in, and
              // the answer takes its place without moving.
              <Animated.View
                entering={reduceMotion ? undefined : FadeIn.duration(180)}
                style={styles.previewPending}
                accessibilityRole="progressbar"
                accessibilityLabel="reading, in progress">
                <ReadingMark />
              </Animated.View>
            ) : null}
          </Animated.View>
        </Animated.View>

        {/* The first-session hint — the FIRST SESSION card's step two, live.
            One muted line while there is a settled card the user has never
            worked; it retires forever on the first ring toggle or opened
            history (and stays away for anyone who has already finished a
            session). */}
        {!empty && settledCards > 0 && !coachRingDone && !hasFinishedOnce() ? (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(180)}>
            <Text style={styles.coachHint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              the ring marks a lift done — tap it if you skipped one · the ⋯ opens a lift’s
              history
            </Text>
          </Animated.View>
        ) : null}

        {/* The session's ONE reflection prompt (owner, 11 Aug 2026).
            It replaces the note bubble that sat on every card: five exercises
            used to mean five invitations to write, when §8.1 asks once, about
            the session, at the end of it. "The end" is Finish, or ninety quiet
            minutes with work on the record (`lib/session-activity.ts`) — the
            athlete who forgets to press Finish still gets asked, and nobody is
            interrupted mid-set. It opens the check-in that already exists;
            once there is a note it stops asking, because the answer is in. */}
        {showReflectionRow ? (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(220)}>
            <Pressable
              onPress={() => {
                tap();
                Keyboard.dismiss(); // the check-in brings its own field
                openCheckIn();
              }}
              accessibilityRole="button"
              accessibilityLabel="Add a note about this session"
              style={({ pressed }) => [styles.reflectRow, pressed && styles.cardPressed]}>
              <Text style={styles.reflectText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Add a note about this session
              </Text>
            </Pressable>
          </Animated.View>
        ) : null}

        {/* The one line of teaching on the canvas, and it is EARNED AWAY: it
            shows while the athlete has fewer than three sessions and then
            never again (`pref_composer_hint_done`). An example of the thing
            being asked for beats an explanation of it — and after three
            sessions an example is just a sentence in the way. */}
        {canvas && showComposerHint ? (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(240)}>
            <Text style={styles.canvasHint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              like “bench 3x8 60, felt easy”
            </Text>
          </Animated.View>
        ) : null}

        {/* The rest of the canvas is still the composer's tap target — the
            page is written on by touching it anywhere, so the empty half
            below the line must not be dead space. */}
        {canvas ? <View style={styles.canvasBottom} /> : null}
      </Pressable>
    </ScrollView>

    {/* The ⋯ sheet. It delivers the chosen action only once its own modal is
        fully gone (onSelect ← BottomSheet.onClosed) — the one moment History
        or Fix reading may present THEIR modal (UIKit's one-at-a-time rule). */}
    <EntryActionsSheet
      visible={actionsOpen}
      target={actionsRow ? { exercise: actionsRow.exercise, setText: actionsRow.setText } : null}
      // The card's own three facts travel with it: the athlete's remark (which
      // makes "Edit note" a decision instead of a guess), and the comparison
      // signal, which the header turns into a PR label or an "up 2.5 kg vs
      // last" line. All of it was already computed for the card.
      note={actionsRow ? readEntryNote(entryNotes, actionsRow.exercise) : null}
      signal={actionsRow?.signal ?? null}
      alsoOnLine={actionsSiblings}
      onClose={() => setActionsOpen(false)}
      onSelect={runEntryAction}
    />
    </>
  );
}

/**
 * THE LINE YOU WRITE ON. One definition, used by Today and by the onboarding
 * demo (28 August 2026).
 *
 * Extracted rather than copied, and every prop of the original is still set
 * here: `blurOnSubmit={false}` and `returnKeyType="next"` are what let a person
 * write three exercises without the keyboard closing between them, and the
 * autocorrect/spellcheck/capitalisation trio is what keeps "3x8" from becoming
 * "3X8" and "ohp" from becoming "OHP". Those are not defaults, they are the
 * reason writing a session feels like writing a note, and a demo that used a
 * plain `TextInput` would get every one of them wrong.
 *
 * `keyboardAppearance="light"` stays too: the app is `userInterfaceStyle:
 * "light"` and a dark keyboard under a paper canvas is the kind of detail that
 * makes a screen feel borrowed.
 */
export function NoteInput({
  inputRef,
  value,
  onChangeText,
  onSubmitEditing,
  onFocus,
  placeholder,
  autoFocus = false,
  testID,
}: {
  inputRef?: React.Ref<TextInput>;
  value: string;
  onChangeText: (text: string) => void;
  onSubmitEditing?: () => void;
  onFocus?: () => void;
  placeholder: string;
  autoFocus?: boolean;
  testID?: string;
}) {
  return (
    <TextInput
      ref={inputRef}
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmitEditing}
      onFocus={onFocus}
      blurOnSubmit={false}
      returnKeyType="next"
      placeholder={placeholder}
      placeholderTextColor={color.textMuted}
      selectionColor={color.accent}
      cursorColor={color.accent}
      keyboardAppearance="light"
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      autoFocus={autoFocus}
      allowFontScaling
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      testID={testID}
    />
  );
}

/**
 * ONE ENTRY, AS THE RECORD DRAWS IT.
 *
 * EXPORTED (28 August 2026) so the onboarding demo can render the real thing
 * rather than a lookalike. It was already the right shape for it: every value
 * arrives as a prop and every action leaves as a callback — it reads nothing
 * from `session-store` and touches no database. Making it shareable was adding
 * the word `export`, which is the whole reason this note is short.
 *
 * The card therefore has exactly one definition, one set of styles and one
 * typography, and a change to how an entry looks on Today changes how it looks
 * in the demo in the same commit. That is the point: the demo screen is not
 * allowed to drift from Today, and the cheapest way to guarantee that is for
 * there to be nothing to drift from.
 */
export function ExerciseCard({
  row,
  order,
  done,
  alias,
  note,
  rawLine,
  showWords,
  reduceMotion,
  onToggle,
  onEdit,
  onActions,
  onToggleWords,
  onFix,
}: {
  row: ReceiptRow;
  order: number;
  done: boolean;
  /** The user's original word when the parser auto-corrected it (X4). */
  alias: string | null;
  /** The athlete's own remark about this entry, or null. */
  note: string | null;
  /** The physical line this card was read from — the words themselves. */
  rawLine: string;
  /** Show those words in place of the interpreted table. */
  showWords: boolean;
  reduceMotion: boolean;
  onToggle: () => void;
  onEdit: () => void;
  /** Open the ⋯ sheet — edit, history, fix reading, delete, all named. */
  onActions: () => void;
  /** Flip between the reading and the written line, both ways. */
  onToggleWords: () => void;
  /** Open the correction sheet for this line (the alias echo's own tap). */
  onFix: () => void;
}) {
  const isPr = row.signal?.kind === 'pr';
  const sub = comparisonOf(row.signal);
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(220).delay(Math.min(order, 6) * 20)}
      style={styles.card}>
      {/* The check is its own tap target: done ↔ not-done, never deletes. */}
      <Pressable
        onPress={onToggle}
        hitSlop={spacing.sm}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        style={styles.rail}>
        <AnimatedCheck done={done} reduceMotion={reduceMotion} />
      </Pressable>
      {/* The body edits the line; everything else lives behind the visible ⋯
          (owner, 6 Aug — the long-press it replaces was a gesture nobody could
          see). While the written words are showing, a tap puts them away again
          rather than opening the editor — the way out is the way you came in. */}
      <PressableScale
        onPress={showWords ? onToggleWords : onEdit}
        onLongPress={onToggleWords}
        haptic="none"
        activeScale={0.98}
        accessibilityHint={showWords ? 'Shows the reading again' : 'Long press to show your words'}
        style={styles.cardBody}
        pressedStyle={styles.cardPressed}>
        <View style={styles.cardHead}>
          <Text
            style={[styles.exName, !done && styles.exNameUndone]}
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {row.exercise}
          </Text>
          {alias ? (
            // The echoed word is the auto-fix made visible — tapping it opens
            // the correction sheet, so a wrong guess is one tap from repaired.
            <Pressable
              onPress={onFix}
              hitSlop={spacing.sm}
              accessibilityRole="button"
              accessibilityLabel={`Recore read “${alias}” as ${row.exercise}. Fix reading`}
              style={styles.aliasWrap}>
              <Text
                style={styles.aliasEcho}
                numberOfLines={1}
                maxFontSizeMultiplier={MAX_FONT_SCALE}>
                · “{alias}”
              </Text>
            </Pressable>
          ) : null}
          {isPr ? <PrLabel animate /> : null}
        </View>
        {/* The sets settle into the mini table — one set per row, so a pyramid
            reads down a column instead of along a compressed line. A lone plain
            set keeps the one-liner (`worthTable`): a header over a single row is
            a table for the sake of being one. Behind it, on a long press, the
            words that produced it. */}
        <WordsFlip showWords={showWords} rawLine={rawLine} reduceMotion={reduceMotion}>
          {worthTable(row.table) ? (
            <SetTable table={row.table} />
          ) : (
            <Text style={styles.exValue} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {row.setText}
            </Text>
          )}
        </WordsFlip>
        {sub ? (
          <Text style={styles.exSub} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {sub}
          </Text>
        ) : null}
        {/* The remark, quoted under its own entry: the athlete's words sit in
            the record they were written about, not behind a sheet. Two lines at
            most — the whole note is one tap away behind the ⋯. */}
        {note ? (
          <Text style={styles.exNote} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {`“${note}”`}
          </Text>
        ) : null}
      </PressableScale>
      {/* The right column — now ONE glyph (owner, 11 Aug 2026).
          The note bubble that used to lead it has gone: a prompt to write about
          THIS lift, repeated down every card, asked the same question five
          times a session, and the honest moment to ask is once, at the end
          (the reflection row under the ledger). Writing about a single lift is
          still there — it moved INTO the ⋯ sheet with every other per-entry
          action, so the card carries one door instead of two. The written note
          itself still shows on the card below; that is the record, not a
          prompt. */}
      <View style={styles.sideCol}>
        <Pressable
          onPress={onActions}
          hitSlop={spacing.xs}
          accessibilityRole="button"
          // FOUR, because the sheet has four (owner, 12 Aug). "Edit line" and
          // "Show my words" left that day; VoiceOver kept announcing them.
          accessibilityLabel={`More on ${row.exercise} — fix reading, note, history, delete`}
          style={({ pressed }) => [styles.sideBtn, pressed && styles.cardPressed]}>
          <Icon name="ellipsis" size={moderateScale(17)} tint={color.textMuted} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

/**
 * The interpreted reading, and the words it was read from, in the same place
 * (owner, 11 Aug 2026).
 *
 * The card is the parser's WORK — "SET · KG · REPS", tidy and structured — and
 * the one thing it never showed is the sentence the athlete actually typed.
 * That is the record (§3), and until now the only way back to it was to open
 * the line for editing, which risks changing it. A long press flips the card
 * over to the raw line, quoted in mono; anything that dismisses it flips back.
 * Read-only, no new data: `raw_text` is already on screen's doorstep.
 *
 * NO LAYOUT JUMP. Both faces are laid out; the words sit absolutely over the
 * reading and report their height, which the wrapper reserves as a floor. So
 * flipping moves nothing on the page — a card that grew and shrank under the
 * finger would make the ledger feel unstable, and the ledger's whole promise is
 * that it holds still.
 */
function WordsFlip({
  showWords,
  rawLine,
  reduceMotion,
  children,
}: {
  showWords: boolean;
  rawLine: string;
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  const [wordsHeight, setWordsHeight] = useState(0);
  const p = useSharedValue(showWords ? 1 : 0);

  useEffect(() => {
    p.value = reduceMotion
      ? showWords
        ? 1
        : 0
      : withTiming(showWords ? 1 : 0, { duration: DUR.fast });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWords, reduceMotion]);

  const readingStyle = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  const wordsStyle = useAnimatedStyle(() => ({ opacity: p.value }));

  return (
    <View style={wordsHeight > 0 ? { minHeight: wordsHeight } : undefined}>
      {/* Whichever face is faded out is hidden from VoiceOver too — a layer at
          zero opacity is invisible to the eye and still read aloud otherwise,
          which would announce every set twice. */}
      <Animated.View
        style={readingStyle}
        accessibilityElementsHidden={showWords}
        importantForAccessibility={showWords ? 'no-hide-descendants' : 'yes'}>
        {children}
      </Animated.View>
      <Animated.View
        style={[styles.wordsLayer, wordsStyle]}
        onLayout={(e) => setWordsHeight(e.nativeEvent.layout.height)}
        // The reading underneath keeps the touches: this face is a display, and
        // the tap that dismisses it belongs to the card body.
        pointerEvents="none"
        accessibilityElementsHidden={!showWords}
        importantForAccessibility={showWords ? 'yes' : 'no-hide-descendants'}>
        <Text style={styles.words} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          “{rawLine}”
        </Text>
      </Animated.View>
    </View>
  );
}

/** The card's check: a hollow ring with an ink fill that springs in when the
 * set is marked done, and shrinks away when it's toggled back to recorded. */
function AnimatedCheck({ done, reduceMotion }: { done: boolean; reduceMotion: boolean }) {
  const s = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    s.value = reduceMotion ? (done ? 1 : 0) : withSpring(done ? 1 : 0, SPRING.snappy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: s.value }));
  return (
    <View style={styles.mark}>
      <View style={styles.markRing} />
      <Animated.View style={[styles.markFill, fill]}>
        <Text style={styles.checkMark} maxFontSizeMultiplier={FIXED_FONT_SCALE}>
          ✓
        </Text>
      </Animated.View>
    </View>
  );
}

/** Tap a line → it drops straight back into an inline editor here: rewrite or
 * fix the text (the parser re-reads it automatically on every change) or Delete
 * to drop the line. Return or tapping away saves. "Fix reading" hands the line
 * to the correction sheet instead — for when the WORDS are right and the
 * reading is wrong. */
function EditRow({
  value,
  onChange,
  onDone,
  onDelete,
  onFix,
}: {
  value: string;
  onChange: (text: string) => void;
  onDone: () => void;
  onDelete: () => void;
  /** Open the correction sheet for this line; null while it has no reading. */
  onFix: (() => void) | null;
}) {
  return (
    <View style={styles.activeRow}>
      <View style={styles.rail}>
        <View style={styles.railEditing} />
      </View>
      <View style={styles.activeBody}>
        <View style={styles.editLine}>
          <TextInput
            style={[styles.input, styles.editInput]}
            value={value}
            onChangeText={onChange}
            onSubmitEditing={onDone}
            // Defer so a tap on Delete lands before the row unmounts on blur.
            onBlur={() => setTimeout(onDone, 100)}
            autoFocus
            blurOnSubmit
            returnKeyType="done"
            selectionColor={color.accent}
            cursorColor={color.accent}
            keyboardAppearance="light"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            allowFontScaling
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />
          <Pressable
            onPress={onDelete}
            hitSlop={spacing.sm}
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.deletePressed]}>
            <Text style={styles.deleteText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Delete
            </Text>
          </Pressable>
        </View>
        <View style={styles.editHintRow}>
          <Text style={styles.previewHint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            editing · return saves · re-reads automatically
          </Text>
          {onFix ? (
            <Pressable
              onPress={onFix}
              hitSlop={{ top: spacing.md, bottom: spacing.md, left: spacing.sm, right: spacing.sm }}
              accessibilityRole="button"
              accessibilityLabel="Fix how Recore read this line">
              <Text style={styles.fixLink} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                fix reading
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/**
 * A line that has settled but has not been read back yet.
 *
 * IT IS THE SETTLED CARD, MINUS THE ANSWER. Rail, body and the ⋯ column are
 * the exercise card's own three columns at their own widths, and the athlete's
 * words sit in the name's place — so the parse landing replaces words with a
 * name and grows the reading underneath, in a shape that was already standing.
 * Before this the indicator lived in a two-column row of its own and the whole
 * block re-laid itself out at the instant the athlete was reading it, which is
 * the one moment a ledger must hold still.
 *
 * EVERYTHING THE MACHINE SAYS HERE IS ON THE WORDS' OWN ROW (owner, 29 August
 * 2026): a light passes under the line being read, and the ⋯ column — the one
 * place on this card that belongs to the app rather than to the record — waves
 * the same three dots that become its menu the moment the reading arrives.
 *
 * The words themselves are never dimmed and never move; the band passes
 * beneath them. They are `textSecondary` rather than full ink for one reason
 * only: a raw line is not a resolved name yet, and the parse is what promotes
 * it.
 */
function PendingCard({
  text,
  reduceMotion,
  onPress,
}: {
  text: string;
  reduceMotion: boolean;
  onPress: () => void;
}) {
  return (
    // ENTERING ONLY, DELIBERATELY. An exiting animation would be the obvious
    // way to cross-fade into the read card, and it is the wrong one: a view
    // that is animating out still holds its place in the layout, so for the
    // length of the fade the ledger would stand one card taller and then
    // collapse — the exact reflow this card was reshaped to remove. The
    // exchange is carried by the read card's own arrival instead.
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(DUR.fast)}>
      <Pressable
        onPress={onPress}
        accessibilityLabel={`${text} — reading`}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
        {/* The light crosses the WHOLE row, rail to ⋯ column, behind every
            other child — it is drawn first so the words always paint over it,
            and it is absolutely placed so the row measures as if it were not
            there. */}
        <ReadingSweep />
        <View style={styles.rail}>
          <View style={styles.railHollow} />
        </View>
        {/* ONE ROW, CENTRED ON THE WORDS. The ⋯ column lives inside this row
            rather than beside it, so the mark sits on the words' own optical
            centre instead of in the middle of a 36 pt button box that is
            top-aligned to a card three lines tall — which put the dots below
            the descenders, reading as a footnote to the line rather than as
            its status (owner, 29 August 2026). The slot keeps the column's
            width and the gap before it, so the mark's x is unchanged: it still
            lands exactly where the ⋯ will. */}
        <View style={styles.pendingHead}>
          <Text
            style={styles.pendingText}
            numberOfLines={2}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {text}
          </Text>
          {/* Dots in the ⋯ column, or the word when motion is off — one hook
              decides, so this row can never end up silent. */}
          <ReadingMark />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function NoteCard({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.rail} />
      <View style={styles.cardBody}>
        <Text style={styles.proseText} numberOfLines={3} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {text}
        </Text>
        <Text style={styles.proseMeta} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          kept as a note · not counted
        </Text>
      </View>
    </Pressable>
  );
}

const RAIL_W = moderateScale(34);
const MARK = moderateScale(22);

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingTop: BODY_PADDING_TOP,
    paddingHorizontal: BODY_PADDING_H,
    paddingBottom: spacing.xl,
  },
  fill: {
    flexGrow: 1,
  },

  // A block per exercise: a left rail (check / marker) + the reading.
  card: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  cardPressed: {
    opacity: 0.6,
  },
  rail: {
    width: RAIL_W,
    alignItems: 'center',
    paddingTop: 1,
  },
  mark: {
    width: MARK,
    height: MARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markRing: {
    position: 'absolute',
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    borderWidth: 1.5,
    borderColor: color.textMuted,
  },
  markFill: {
    position: 'absolute',
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: color.onInk,
    fontSize: moderateScale(12),
    fontWeight: '700',
    lineHeight: lineFor(14),
  },
  railHollow: {
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    borderWidth: 1.5,
    borderColor: color.textMuted,
  },
  railEditing: {
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    borderWidth: 1.5,
    borderColor: color.accent,
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  exName: {
    flexShrink: 1,
    fontSize: moderateScale(17),
    fontWeight: '600',
    letterSpacing: -0.2,
    color: color.textPrimary,
  },
  exNameUndone: {
    // Recorded, but not marked done yet — a touch quieter, never struck out.
    color: color.textSecondary,
  },
  aliasWrap: {
    flexShrink: 1,
  },
  aliasEcho: {
    // The user's own word, quietly echoed when the parser corrected the name.
    fontSize: moderateScale(13),
    color: color.textSecondary,
  },
  exValue: {
    ...readingStyle('400'),
    fontSize: moderateScale(14),
    color: color.textSecondary,
  },
  // The written face of the card, over the interpreted one.
  wordsLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    justifyContent: 'center',
    paddingTop: spacing.xs,
  },
  words: {
    // Quoted mono, at the reading's own size: these are the athlete's words,
    // shown exactly as typed — never re-cased, never re-spaced.
    ...readingStyle('400'),
    fontSize: moderateScale(14),
    lineHeight: lineFor(20),
    color: color.textPrimary,
  },
  exSub: {
    ...readingStyle('400'),
    fontSize: moderateScale(11.5),
    color: color.textSecondary,
  },
  // The athlete's own words under their entry. Prose, so it leaves the mono
  // voice the readings speak in — this is the one line on the card that Recore
  // did not compute.
  exNote: {
    marginTop: 2,
    fontSize: moderateScale(13),
    lineHeight: lineFor(18),
    color: color.textSecondary,
  },
  // The card's right column — one glyph since 11 Aug, kept as a column so the
  // ⋯ holds its position whatever else the card grows.
  sideCol: {
    width: moderateScale(36),
    alignItems: 'center',
    paddingTop: 1,
    gap: spacing.sm,
  },
  sideBtn: {
    width: moderateScale(36),
    height: moderateScale(36),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: moderateScale(8),
    borderCurve: 'continuous',
  },

  // Pending / prose blocks.
  /** The words in the NAME's place: `exName`'s metrics exactly, one step
   * quieter in ink because a raw line is not a resolved name yet. */
  pendingText: {
    // `flex`, not `flexShrink`: the words claim the free space so the Reduce
    // Motion word and the ⋯ slot are pushed hard against the card's right edge
    // — the same edge the settled card's glyph sits on.
    flex: 1,
    fontSize: moderateScale(17),
    fontWeight: '600',
    letterSpacing: -0.2,
    color: color.textSecondary,
  },
  /** The words' row, and the only row this card has: the line on the left,
   * whatever the app has to say about it hard against the right, and the ⋯
   * column's own slot at the end. `alignItems: 'center'` is the whole point —
   * every mark on this row centres on the line's own height. */
  pendingHead: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  proseText: {
    fontSize: moderateScale(16),
    lineHeight: lineFor(22),
    color: color.textSecondary,
  },
  proseMeta: {
    fontSize: moderateScale(12),
    color: color.textSecondary,
  },

  // The active input line.
  activeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  /** The boundary the hairline used to draw: the gap above the line being
   * written is larger than any gap between two settled records, so the page
   * still says where the record stops. */
  activeRowAfterRecord: {
    paddingTop: spacing.xxl,
  },
  /** The blank page opens like a new note: the line at the TOP, hard against
   * the body's own left margin — no rail column to indent past, no gap to sit
   * after, and none of the padding that separates one record from the next. */
  activeRowCanvas: {
    gap: 0,
    paddingTop: 0,
  },
  activeBody: {
    flex: 1,
    gap: spacing.xs,
  },
  input: {
    fontSize: moderateScale(17),
    lineHeight: lineFor(23),
    color: color.textPrimary,
    fontWeight: '400',
    padding: 0,
    minHeight: moderateScale(24),
  },
  editLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  editInput: {
    flex: 1,
  },
  deleteBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: moderateScale(8),
    borderCurve: 'continuous',
  },
  deletePressed: {
    opacity: 0.6,
  },
  deleteText: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: color.error,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  previewName: {
    flexShrink: 1,
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: color.textSecondary,
  },
  previewValue: {
    ...readingStyle('400'),
    fontSize: moderateScale(13),
    color: color.textSecondary,
  },
  previewHint: {
    marginTop: 2,
    fontSize: moderateScale(11),
    color: color.textSecondary,
  },
  editHintRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  fixLink: {
    // The repair hand-off — quiet like the hint it sits beside, but weighted
    // so it reads as a control rather than commentary.
    marginTop: 2,
    fontSize: moderateScale(11),
    fontWeight: '600',
    color: color.textSecondary,
  },
  prefillRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  prefillReading: {
    // A memory of last session, not a result — quiet mono, a step below the
    // parse echo, and never green.
    ...readingStyle('400'),
    fontSize: moderateScale(13),
    color: color.textSecondary,
  },
  previewPending: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  // The blank canvas: the rest of the page below the writing line, kept as one
  // flex spacer so the whole sheet stays the composer's tap target. It
  // collapses to nothing the moment the first card exists.
  canvasBottom: {
    flex: 1,
  },
  canvasHint: {
    // On the canvas there is no check column to clear, so the example sits on
    // the same margin as the line it is an example of.
    marginTop: spacing.sm,
    fontSize: moderateScale(13),
    lineHeight: lineFor(18),
    color: color.textMuted,
  },
  // The session's one reflection prompt — aligned with the card text, past the
  // check column, because it talks about the session those cards are.
  reflectRow: {
    marginLeft: RAIL_W + spacing.sm,
    marginTop: spacing.sm,
    minHeight: moderateScale(44),
    justifyContent: 'center',
  },
  reflectText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: color.textSecondary,
  },
  // The answer to that prompt, once it exists — same indentation as the row
  // that asked, a step smaller than a lift. Both lines are `textSecondary`:
  // they carry the athlete's own information, and muted is for what the eye
  // may skip (design skill §Colour).
  reflectNote: {
    marginLeft: RAIL_W + spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    minHeight: HIT,
    justifyContent: 'center',
    gap: 2,
  },
  reflectTags: {
    // The chips the athlete armed, in their canonical order — a label line
    // over the words, weighted so the two read as two things.
    fontSize: moderateScale(11.5),
    fontWeight: '600',
    color: color.textSecondary,
  },
  reflectBody: {
    fontSize: moderateScale(13),
    lineHeight: lineFor(18),
    color: color.textSecondary,
  },
  coachHint: {
    // Aligned with the card text, past the check column — the hint talks about
    // the marks, so it sits in their own indentation.
    marginLeft: RAIL_W + spacing.sm,
    marginTop: spacing.xs,
    fontSize: moderateScale(11),
    color: color.textSecondary,
  },
});
