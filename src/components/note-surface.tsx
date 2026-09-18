import { useEffect, useMemo, useRef, useState } from 'react';
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
import { getReflection, getSessionEffort } from '@/lib/db/workouts';
import { canonicalName } from '@/lib/demo-read';
import { readEntryNote } from '@/lib/entry-note';
import { tap, tapMedium } from '@/lib/haptics';
import { DUR, SPRING } from '@/lib/motion';
import { gapOfTable, gapOfUnreadLine, type ReadingGap, type UnreadLineGap } from '@/lib/parse/gaps';
import { namesMatch, typedNameOf, type ReceiptRow } from '@/lib/parse/receipt';
import { PAPER_FIELD_CSS } from '@/lib/paper-field';
import {
  COMPOSER_HINT_SESSIONS,
  hasCoachRingDone,
  hasComposerHintDone,
  hasFinishedOnce,
  markCoachRingDone,
  markComposerHintDone,
} from '@/lib/prefs';
import { splitReflection } from '@/lib/reflection';
import { SESSION_EFFORT_LABEL, sessionEffortOf } from '@/lib/session-effort';
import {
  color,
  FIXED_FONT_SCALE,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  shadow,
  spacing,
  TAB_BAR_CLEARANCE,
} from '@/lib/theme';
// The navigation bar's live height, straight from the native stack — how tall
// UIKit is drawing the bar for THIS screen right now, large title and status
// bar included. `expo-router` vendors react-navigation rather than depending on
// it, so this is where the hook lives; it is typed, so a path that ever moves
// fails the typecheck rather than the page.
import { useHeaderHeight } from 'expo-router/build/react-navigation/elements';

import { useCurrentNote, useSession } from '@/state/session-store';

import { CheckInNote } from './check-in-note';
import { DaySwipe } from './day-swipe';

import { comparisonOf, PrLabel, ReadingLine, ReadingMark, WaitingMark } from './gutter-value';
import { Icon } from './icon';
import { PressableScale } from './motion';
import { BODY_PADDING_H, BODY_PADDING_TOP } from './note-metrics';
import { noteInputRef, noteScrollRef } from './note-focus';
import { SetTable, worthTable } from './set-table';
import { DELETE_ROTOR_ACTIONS, SwipeToDelete } from './swipe-to-delete';
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
 * reading, and tap it to flip back; the note glyph on the name's row opens the
 * one thing the card cannot do itself (`entry-note-sheet.tsx`); SWIPE THE ROW
 * LEFT to remove it (`swipe-to-delete.tsx`); the alias echo beside an
 * auto-corrected name opens the correction sheet directly. The raw text stays the source of truth
 * (`note` is still the full log, newline-joined); the cards are a live
 * projection of the parse. No predictor — the app's one job on open is to read
 * what you did.
 *
 * ONE PROMPT PER SESSION, NOT PER CARD (owner, 11 Aug 2026). The note bubble
 * that used to sit on every card is gone; the invitation to write about
 * training now appears once, under the ledger, when the session has actually
 * ended (§8.1). Writing about a single lift survives as the card's own glyph.
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
export function aliasEchoOf(rawLine: string, canonical: string): string | null {
  const typed = typedNameOf(rawLine);
  return typed && !namesMatch(typed, canonical) ? typed : null;
}

export function NoteSurface({
  /**
   * What the page opens with, above the record: Today passes the dateline and
   * the weekly line. It travels with the day (inside `DaySwipe`) because it
   * describes the day, and it scrolls away under the system's collapsing title
   * because it is content — the whole point of moving Today onto the navigator
   * was that a page has no lid.
   */
  header,
  /** Day-to-day swiping, off while the keyboard is up (`DaySwipe`). */
  daySwipeEnabled = false,
}: {
  header?: React.ReactNode;
  daySwipeEnabled?: boolean;
} = {}) {
  const note = useCurrentNote();
  const setNote = useSession((s) => s.setNote);
  const receipt = useSession((s) => s.receipt);
  const parsing = useSession((s) => s.parsing);
  /**
   * A READING ASKED FOR WITH NO SIGNAL TO SPEND IT ON (`session-store.ts`).
   *
   * It outlives `parsing` on purpose — the retry chain gives up after half a
   * minute and the debt does not — so it is what the page draws amber for as
   * long as the phone is underground. Never both: a line is either being read
   * or waiting to be.
   */
  const parseStalled = useSession((s) => s.parseStalled);
  const waiting = parseStalled && !parsing;
  const parsedSnapshot = useSession((s) => s.parsedSnapshot);
  const requestParse = useSession((s) => s.requestParse);
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
  const deleteCheckIn = useSession((s) => s.deleteCheckIn);
  /** Bumped by a swipe delete (and by its undo), which is the one write to the
   * check-in that happens with no sheet to close — see the reflection memo. */
  const checkInRevision = useSession((s) => s.checkInRevision);
  const userId = useSession((s) => s.userId);
  const workoutId = useSession((s) => s.workoutId);
  // Which day the page is showing — the reset below returns to the top of it.
  const selectedDay = useSession((s) => s.selectedDay);
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

  /** Which card is showing the athlete's own words instead of the reading —
   * one at a time, so flipping a second card settles the first. Held here
   * rather than inside the card only because the list owns "one at a time". */
  const [wordsKey, setWordsKey] = useState<string | null>(null);
  /**
   * THE SWIPE NO LONGER ASKS (owner, 16 September 2026).
   *
   * This file argued the opposite for a month, and the argument held while
   * both its halves did. `deleteNoteLine` splices out of `note`, which is
   * `raw_text`, which is the record (§3) — and nothing could put it back. Two
   * changes have since taken both halves away. `undo-delete.tsx` made the
   * action reversible for six seconds, and delete stopped being a tap: it is a
   * DRAG the thumb has to carry past 42 % of the screen, through a red block
   * that appears under it and a haptic when it arms. Pulling that far IS the
   * decision the dialog was asking for, and asking again on the far side of it
   * is the app declining to believe the gesture it just built.
   *
   * WHAT THE DIALOG DID THAT THE UNDO DID NOT was NAME THE SIBLINGS. One
   * written line can hold several readings ("bench 3x8, rows 3x10" is one
   * line, two cards) and the line is the only honest unit to remove —
   * `ParsedItem` carries no offset back into the sentence, and guessing at a
   * substring of what the athlete wrote would corrupt the record. That
   * sentence was not dropped, it MOVED: the names travel with the delete and
   * the pill prints every one of them, so the report of what went now arrives
   * beside the way back rather than in front of it.
   *
   * THE INLINE EDITOR'S DELETE STILL ASKS, which is not an inconsistency but
   * the same rule applied to a different door. It is a bare one-tap button
   * beside an autofocused field — the accidental door, never the deliberate
   * one — and there is no drag in front of it to have been the decision.
   *
   * It runs from a plain press, i.e. with no native modal of its own on
   * screen. An alert is a presentation like any other, and UIKit will refuse
   * it over a live modal exactly as it refuses a second sheet.
   */
  const confirmDeleteLine = (line: number, labels: string[]) => {
    Alert.alert(
      'Delete this line?',
      'The line you wrote is removed from this session. Undo is offered straight after.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            tapMedium();
            // Whatever the line was holding travels with the delete, so the
            // undo pill can say WHAT it would bring back — all of it.
            deleteNoteLine(line, labels);
          },
        },
      ],
    );
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

  /**
   * PUTTING THE PHONE DOWN IS AN ANSWER (owner, 17 September 2026).
   *
   * Since the check became the only way a written line becomes a record
   * (15 September), a line typed and then abandoned stayed unread FOR EVER:
   * the words are in `raw_text` and the record is honest, but no card ever
   * settles, the totals never count it, and the person who wrote it has no
   * idea anything is outstanding. The gesture that ends writing on this page
   * is the keyboard going down — Done on the bar, a tap on the canvas, a
   * sheet opening — so that is where the app asks for the reading it was not
   * asked for.
   *
   * It is not a second confirm. It reads what is already written, exactly as
   * the check does, and it can never overwrite or invent: `requestParse` is
   * the same call, and the words it reads are the athlete's own.
   *
   * The work is held in a ref rather than in the listener's deps, so the
   * subscription is made once instead of being torn down and rebuilt on every
   * keystroke — and it still reads the line as it stands at the moment the
   * keyboard leaves, never as it stood when the listener was made.
   */
  const readOnHide = useRef<() => void>(() => {});
  useEffect(() => {
    readOnHide.current = () => {
      if (parsing || activeValue.trim().length === 0 || parsedFresh(activeIndex)) return;
      requestParse();
    };
  });
  useEffect(() => {
    const hidden = Keyboard.addListener('keyboardDidHide', () => readOnHide.current());
    return () => hidden.remove();
  }, []);

  /**
   * WHAT A LINE WITH NO READING IS MISSING (15 September 2026) — computed once
   * per parse, off the SNAPSHOT, so the SQLite lookup behind `knownExercise`
   * never runs on a keystroke. A line only wears its entry while it still
   * matches the snapshot (`parsedFresh`), which is exactly when the diagnosis
   * is still about the text on screen. `lib/parse/gaps.ts` carries the rules
   * and the confidence bar; the one thing added here is the database's answer
   * to "is this a name this athlete's record knows".
   */
  const unreadGapByLine = useMemo(() => {
    const m = new Map<number, UnreadLineGap>();
    if (parsedSnapshot === null) return m;
    const known = (line: string): boolean => {
      const name = typedNameOf(line) || line.trim().toLowerCase();
      if (name.length < 3) return false;
      if (canonicalName(name) !== null) return true;
      if (!userId) return false;
      return getLastSessionPrefill(userId, name, workoutId) !== null;
    };
    snapshotLines.forEach((raw, i) => {
      if (raw.trim().length === 0 || rowsByLine.has(i)) return;
      const gap = gapOfUnreadLine(raw, known(raw));
      if (gap) m.set(i, gap);
    });
    return m;
  }, [parsedSnapshot, snapshotLines, rowsByLine, userId, workoutId]);

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

  /**
   * SCROLL TO THE END ONLY WHEN THERE IS AN END TO SCROLL TO (9 September 2026).
   *
   * `contentContainerStyle.flexGrow: 1` makes the page at least as tall as the
   * scroll view's FRAME — which is what keeps the blank canvas tappable from
   * top to bottom — while the keyboard's inset shrinks the visible window by
   * ~340 pt. `scrollToEnd` measures against content plus insets, so on a page
   * with nothing on it there is still a 450 pt "end" to travel to, and asking
   * for it threw the composer up under the navigation bar. Photographed on the
   * simulator: an empty note, tapped, with "Write your training…" half behind
   * the glass and the dateline gone.
   *
   * So the two sizes are measured and the scroll only happens when the content
   * genuinely overflows. A page that fits does not move, which is also what
   * Apple Notes does when you tap a blank note.
   */
  const contentH = useRef(0);
  const viewH = useRef(0);
  const scrollToEndIfLong = (animated: boolean) => {
    if (contentH.current > viewH.current + 1) noteScrollRef.current?.scrollToEnd({ animated });
  };

  /**
   * A NEW DAY OPENS AT THE TOP OF ITS PAGE (owner, 10 September 2026).
   *
   * One scroll view holds every day — swiping does not push a screen, it swaps
   * the content underneath — so the offset the last day was left at survived
   * into the next one. Swipe back from a page you had scrolled and yesterday
   * arrived already scrolled past its own first lift, with the title collapsed
   * and nothing on screen to explain why. Reaching yesterday is the commonest
   * thing a lifter does after writing a session up late, and it landed them
   * mid-page.
   *
   * WHY THE TOP IS NOT `y: 0`. `contentInsetAdjustmentBehavior="automatic"`
   * leaves the large title's space as an *adjusted* content inset, so the page
   * rests at a NEGATIVE offset — `y: 0` puts the dateline behind the navigation
   * bar, which is the same wrong place reached a different way (photographed on
   * the iOS 26.5 simulator). UIKit owns that inset and never hands it to
   * JavaScript: `contentInset` on a scroll event is the raw prop, which is zero
   * here, and `scrollTo` clamps a negative y against that same zero — hence
   * `scrollToOverflowEnabled` on the scroll view, which is not overflow so much
   * as permission to reach the top.
   *
   * So the resting offset is MEASURED, not assumed. The content has no top
   * padding, so the first pixel of the page sits at window y = −contentOffset;
   * taken once while the page is still untouched, that y IS the offset the top
   * rests at — whatever the navigation bar, the status bar and Dynamic Type
   * make of it. A reading outside a sane range is refused and the reset falls
   * back to `0`, because a page one bar too low is a great deal better than a
   * page thrown into empty space.
   */
  const headerHeight = useHeaderHeight();
  const restOffset = useRef(0);
  useEffect(() => {
    // The tallest the bar has been is the bar with its large title out, which
    // is the state the page rests in. Written from an effect, never during a
    // render: the React Compiler is on (`app.json` experiments) and a
    // render-phase ref write is exactly what it is allowed to reorder.
    if (-headerHeight < restOffset.current) restOffset.current = -headerHeight;
  }, [headerHeight]);

  const shownDay = useRef(selectedDay);
  useEffect(() => {
    if (shownDay.current === selectedDay) return;
    shownDay.current = selectedDay;
    // Not animated: the swipe is already carrying one page out and the next one
    // in, and a scroll animation under that reads as a second, slower gesture
    // nobody made.
    //
    // TWICE, one frame apart, and the second one is not superstition. Arriving
    // at the top brings the large title back out, which grows the adjusted
    // inset by exactly the title's height — and UIKit keeps the CONTENT still
    // while that happens by moving the offset the same distance, so the page
    // ends up that far below its own top (measured: asked for −168, landed at
    // −220). The bar has settled a frame later, and the identical instruction
    // then means what it says.
    const toTop = () => noteScrollRef.current?.scrollTo({ y: restOffset.current, animated: false });
    toTop();
    requestAnimationFrame(toTop);
  }, [selectedDay]);

  const settleActive = (line: string) => {
    // The committed line settles above; a fresh empty line becomes the input.
    setNote([...lines.slice(0, activeIndex), line, ''].join('\n'));
    requestAnimationFrame(() => scrollToEndIfLong(!reduceMotion));
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
  /**
   * Was the block just above a settled exercise card? A pure-prose line that
   * follows one is the athlete's COMMENT about it (owner, 16 September 2026:
   * *"če napiše nekaj v vrstico in to prepoznaš kot komentar, zapiši to pod
   * tisti workout lepo"*), and it renders as a quote tucked under that card
   * instead of a free-standing "kept as a note" row. Consecutive comment
   * lines keep the flag, so they stack under the same card; anything else —
   * an unread line, an amber gap, an edit row — breaks the attachment,
   * because tucking a quote under a card it does not follow would be the
   * ledger mis-attributing the athlete's words.
   */
  let afterCard = false;
  /** Rank among the lines currently being READ — what staggers their beams so a
   * dump is analysed top to bottom instead of all at once (`ReadingSweep`). It
   * counts pending cards, not physical lines: a page with two settled entries
   * and one pending line has ONE beam, and it starts immediately. */
  let pendingOrder = 0;
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
          // THE ONE DOOR THAT STILL ASKS (16 September 2026). A bare one-tap
          // Delete beside an autofocused field is the accidental door, and
          // unlike the swipe there is no drag in front of it to be the
          // decision. The names of whatever the line was holding go with it
          // either way, so the undo pill reads the same whichever door was
          // used — the line under edit is not always one entry.
          onDelete={() => confirmDeleteLine(i, rows?.map((r) => r.exercise) ?? [])}
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
      afterCard = false; // a line open for editing is not something to hang a quote on
      continue;
    }
    if (rows && rows.length && parsedFresh(i)) {
      const alias = rows.length === 1 ? aliasEchoOf(raw, rows[0]!.exercise) : null;
      settledCards += rows.length;
      rows.forEach((row, j) => {
        const key = row.doneKey;
        const cardKey = `${i}:${j}:${row.exercise}`;
        // The rest of this written line. Delete can only ever take the LINE —
        // the words are the record (§3) and nothing maps one card back to its
        // slice of a run-on sentence — so the undo pill has to be able to name
        // who leaves with this card.
        const siblings = rows.filter((r) => r !== row).map((r) => r.exercise);
        // Straight through, no dialog: the drag was the decision and the pill
        // is the report. No haptic here either — the gesture already fired its
        // own when it armed, and a second one on the same action would read as
        // a second thing happening. VoiceOver's copy of this door is announced
        // by the pill instead (`undo-delete.tsx`).
        const removeEntry = () => deleteNoteLine(row.line, [row.exercise, ...siblings]);
        pushBlock(
          /* SWIPE THE ROW LEFT TO REMOVE IT (owner, 16 September 2026) — the
             gesture that replaced the ⋯ menu's Delete row. It rests on
             `undo-delete.tsx`: a line of `raw_text` is the record, and this is
             only a safe gesture because the pill offers it straight back. */
          <SwipeToDelete key={cardKey} onDelete={removeEntry} reduceMotion={reduceMotion}>
            <ExerciseCard
              row={row}
              order={i}
              done={!undone[key]}
              gap={gapOfTable(row.exercise, row.table)}
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
              onNote={() => {
                tap();
                Keyboard.dismiss(); // the sheet brings its own input
                // The athlete's own remark about THIS lift, which Next quotes
                // back beside it. One tap, no menu in the way.
                openEntryNote({
                  exercise: row.exercise,
                  setText: row.setText,
                  line: row.line,
                  signal: row.signal ?? null,
                });
              }}
              onDelete={removeEntry}
              onFix={() => {
                tap();
                Keyboard.dismiss(); // the sheet brings its own inputs
                openFixSheet(row.line); // tap the echoed word → correct the reading
              }}
            />
          </SwipeToDelete>,
        );
      });
      afterCard = true; // a comment line below this one belongs to this card
    } else if (parsing || !parsedFresh(i)) {
      const line = i;
      pushBlock(
        <PendingCard
          key={`p:${i}`}
          text={raw.trim()}
          // The beam and the dots claim WORK, and work only happens while a
          // parse is genuinely in flight. A settled line waiting for the
          // checkmark is not being read — it is the athlete's text, at rest,
          // wearing the check that asks (16 Sep 2026) until they tap it.
          reading={parsing}
          // Asked for, and no connection to ask over. The card keeps its shape
          // and turns its marks amber — `PendingCard`'s `waiting` carries why.
          waiting={waiting}
          order={parsing ? pendingOrder++ : 0}
          reduceMotion={reduceMotion}
          onPress={() => {
            tap();
            startEditLine(line);
          }}
          onConfirm={() => {
            tap();
            requestParse();
          }}
        />,
      );
      afterCard = false; // an unread line is not a reading to comment on
    } else {
      const line = i;
      const gap = unreadGapByLine.get(i) ?? null;
      /**
       * A COMMENT BELONGS UNDER THE LIFT IT IS ABOUT (owner, 16 September
       * 2026). Prose that the parser read as prose — no gap to name, nothing
       * countable in it — and that FOLLOWS a settled card is the athlete
       * talking about that card: "felt heavy today" under the squat. It is
       * quoted under the card instead of standing as its own "kept as a note"
       * row, which said the truth (it is not counted) in the least useful
       * place. Nothing about the record changes: the line is still its own
       * physical line in `raw_text`, still tappable into the editor, still
       * exported — only where it is DRAWN moves.
       *
       * Prose with no card above it (a mood on a blank page, a day header)
       * keeps the standalone note, because there is nothing for it to hang
       * under.
       */
      if (gap === null && afterCard) {
        pushBlock(
          <CommentLine
            key={`c:${i}`}
            text={raw.trim()}
            reduceMotion={reduceMotion}
            onPress={() => {
              tap();
              startEditLine(line);
            }}
          />,
        );
        continue; // consecutive comments keep stacking under the same card
      }
      pushBlock(
        <NoteCard
          key={`n:${i}`}
          text={raw.trim()}
          gap={gap}
          onPress={() => {
            tap();
            startEditLine(line);
          }}
        />,
      );
      afterCard = false;
    }
  }

  // The live read-out of the line you're typing right now.
  const activeRows = parsedFresh(activeIndex) ? (rowsByLine.get(activeIndex) ?? null) : null;
  // The composer's working mark exists only while a parse is genuinely in
  // flight. Typing is not parsing (15 Sep 2026): an unconfirmed line shows
  // nothing under the field — the raw text is the whole statement until the
  // checkmark asks for its reading.
  const activePending = parsing && activeValue.trim().length > 0 && !parsedFresh(activeIndex);
  /** The same fact about the line being typed: asked for, and underground. */
  const activeWaiting = waiting && activeValue.trim().length > 0 && !parsedFresh(activeIndex);
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
   * cannot re-read is a form you filled in — so the day prints it under the
   * lifts it is about.
   *
   * WHAT IS ASSEMBLED HERE is everything the sheet stores about the session as
   * a whole — the rating (`session_effort`), the armed chips and the typed
   * words — and `check-in-note.tsx` decides how the three are drawn. This hook
   * reads; that file designs.
   *
   * Read on the same beat as the prompt it replaces — the check-in writes it,
   * so closing that sheet (or changing day) is what makes this current. Plus
   * `checkInRevision`, for the one write that has no sheet behind it: the swipe
   * that deletes the block, and the undo that puts it back.
   */
  const reflection = useMemo(() => {
    const stored = workoutId ? getReflection(workoutId) : null;
    /**
     * THE SESSION'S RATING READS BACK ON THE SAME BLOCK (10 September 2026).
     *
     * It is the third thing the check-in carries and it arrived with the same
     * problem the chips had in August: written once, printed nowhere. A word,
     * not the stored CR-10 number — see `CheckInNote`.
     */
    const effort = workoutId ? sessionEffortOf(getSessionEffort(workoutId)) : null;
    const rating = effort ? SESSION_EFFORT_LABEL[effort] : null;
    const words = stored && stored.trim().length > 0 ? splitReflection(stored) : null;
    if (!rating && !words) return null;
    // The tags stay an ARRAY here: `CheckInNote` prints them as the chips they
    // were tapped as, and joining them into "a · b" first would throw away the
    // one thing that makes them readable as answers.
    return { rating, tags: words?.tags ?? [], text: words?.text ?? '' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId, checkInOpen, receipt, checkInRevision]);
  /**
   * The invitation below the line is about WORDS, so a session that was rated
   * and not written about still gets it. Gating on `reflection === null` would
   * have taken the prompt away the moment somebody tapped "Hard" and left —
   * the one session where they most obviously have not written anything yet.
   */
  const wroteSomething =
    (reflection?.tags.length ?? 0) > 0 || (reflection?.text.length ?? 0) > 0;
  const showReflectionRow = settledCards > 0 && !sessionActive && !wroteSomething;

  return (
    <>
    {/* THE SCROLL VIEW IS THE SCREEN'S ROOT, and that is load-bearing rather
        than tidy: `app/(tabs)/today/_layout.tsx` explains what UIKit does with
        it (the collapsing large title, the glass bar, the tab-bar minimize) and
        what it cannot do without it. Everything that used to sit in a row above
        this — the wordmark, the day pill, the weekly line — is either a bar
        button or content inside it now. */}
    <ScrollView
      ref={noteScrollRef}
      /* Lets `scrollTo` reach the page's real top: the resting offset is
         negative and RN clamps a negative y to zero without this. See the
         day-change reset above. */
      scrollToOverflowEnabled
      style={styles.body}
      contentContainerStyle={styles.content}
      // `automatic` hands the insets to the system: the large title's height,
      // the safe area and the tab bar are UIKit's arithmetic now, not ours.
      contentInsetAdjustmentBehavior="automatic"
      /**
       * THE KEYBOARD IS UIKIT'S TOO (9 September 2026).
       *
       * Today used to wrap the whole page in a `KeyboardAvoidingView`, which
       * measures the keyboard in JavaScript and pads a container to match. It
       * cannot be frame-accurate — the padding lands a frame or two after the
       * keyboard, which is the small shear you see under a cursor when a note
       * app is not native — and it needed the page NOT to be a root scroll
       * view, which is the one thing this page now has to be.
       *
       * `automaticallyAdjustKeyboardInsets` is the same job done by the
       * scroll view itself: content inset and indicator inset track the
       * keyboard on the UI thread, and the line being written stays visible
       * without anything in React knowing the keyboard exists.
       */
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      // Both sizes, so `scrollToEndIfLong` can tell a page that overflows from
      // one that only looks like it does (see the note on that helper).
      onLayout={(e) => {
        viewH.current = e.nativeEvent.layout.height;
      }}
      onContentSizeChange={(_w, h) => {
        contentH.current = h;
      }}
      showsVerticalScrollIndicator={false}>
      {/* Swipe left/right to move between days — the thumb's own shortcut to
          yesterday. It lives inside the scroll view now (see above) and is
          disabled while the keyboard is up: mid-sentence a horizontal drag is
          the user placing a cursor, not asking for another day. */}
      <DaySwipe enabled={daySwipeEnabled}>
      <Pressable style={styles.fill} onPress={focusInput}>
        {header}
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
            words are written; SWIPING IT LEFT removes it (17 September 2026),
            the same gesture, the same undo pill and the same reasoning as the
            entries above — the drag is the decision, `undo-delete.tsx` is the
            way back. Both halves go together, because the block is one answer,
            and the invitation to write another returns below the line as soon
            as it has. */}
        {reflection ? (
          <SwipeToDelete
            onDelete={() => deleteCheckIn()}
            reduceMotion={reduceMotion}>
            <CheckInNote
              rating={reflection.rating}
              tags={reflection.tags}
              text={reflection.text}
              railWidth={RAIL_W}
              railGap={RAIL_GAP}
              reduceMotion={reduceMotion}
              onPress={() => {
                tap();
                Keyboard.dismiss(); // the check-in brings its own field
                openCheckIn();
              }}
              // No haptic of its own: the gesture already ticked when it armed,
              // and the pill is the report. VoiceOver reaches it on the rotor.
              onDelete={() => deleteCheckIn()}
            />
          </SwipeToDelete>
        ) : null}

        {/* WHAT IS SETTLED AND WHAT IS BEING WRITTEN are separated by AIR, not
            by a line (v6). A rule used to close the record here and it is the
            one boundary on this page that genuinely means something, so it is
            not simply dropped: the active line takes a larger top gap than any
            record-to-record gap, and the largest space on the page is the one
            that says "everything above this is written down". */}

        {/* THE ACTIVE LINE — where you write, and the one line of teaching
            under it. `Composer` is the whole of it, and it is a shared
            component for the same reason `NoteInput` and `ExerciseCard` are:
            the onboarding demo has to BE the composer, not resemble it. */}
        <Composer
          inputRef={noteInputRef}
          value={activeValue}
          onChangeText={setActive}
          onSubmitEditing={commit}
          placeholder={empty ? PLACEHOLDER : NEXT_PLACEHOLDER}
          canvas={canvas}
          afterRecord={blocks.length > 0}
          rows={activeRows}
          pending={activePending}
          waiting={activeWaiting}
          prefill={
            lastPrefill ? { reading: lastPrefill.reading, onAccept: acceptPrefill } : null
          }
          onConfirm={
            !parsing && activeValue.trim().length > 0 && !parsedFresh(activeIndex)
              ? () => {
                  tap();
                  requestParse();
                }
              : null
          }
          hint={canvas && showComposerHint ? COMPOSER_HINT : null}
          reduceMotion={reduceMotion}
        />

        {/* The first-session hint — the FIRST SESSION card's step two, live.
            One muted line while there is a settled card the user has never
            worked; it retires forever on the first ring toggle (and stays away
            for anyone who has already finished a session).

            Its second half used to name the ⋯ and the history behind it. Both
            are gone (16 Sep 2026), and what replaced one of them is a GESTURE,
            which is the one thing on this card a person cannot discover by
            looking — so the sentence now spends its second half there. */}
        {!empty && settledCards > 0 && !coachRingDone && !hasFinishedOnce() ? (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(180)}>
            <Text style={styles.coachHint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              the ring marks a lift done — tap it if you skipped one · swipe a lift left to
              remove it
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
            <PressableScale
              onPress={() => {
                tap();
                Keyboard.dismiss(); // the check-in brings its own field
                openCheckIn();
              }}
              haptic="none"
              activeScale={ROW_SCALE}
              wash
              washStyle={styles.rowWash}
              accessibilityRole="button"
              accessibilityLabel="Add a note about this session"
              style={styles.reflectRow}>
              <Text style={styles.reflectText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Add a note about this session
              </Text>
            </PressableScale>
          </Animated.View>
        ) : null}

        {/* The rest of the canvas is still the composer's tap target — the
            page is written on by touching it anywhere, so the empty half
            below the line must not be dead space. */}
        {canvas ? <View style={styles.canvasBottom} /> : null}
      </Pressable>
      </DaySwipe>
    </ScrollView>

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
  /**
   * Hand the bar over the keyboard to UIKIT (10 September 2026).
   *
   * With a `nativeID` here and an `InputAccessoryView` carrying the same one,
   * iOS attaches the bar to the keyboard itself — which means the keyboard
   * frame every listener and every scroll view sees INCLUDES it, and the line
   * being written is scrolled clear of it by the system rather than by
   * arithmetic. Today still tracks its toolbar by hand and pays for it with a
   * `bottom: keyboardHeight` and a clearance constant; the onboarding demo does
   * not, and this prop is the difference. Unset changes nothing.
   */
  inputAccessoryViewID,
  testID,
  multiline = false,
}: {
  inputRef?: React.Ref<TextInput>;
  value: string;
  onChangeText: (text: string) => void;
  onSubmitEditing?: () => void;
  onFocus?: () => void;
  placeholder: string;
  autoFocus?: boolean;
  inputAccessoryViewID?: string;
  testID?: string;
  /** The composer sets this — see its paste note. A single-line field is kept
   * for every other caller. */
  multiline?: boolean;
}) {
  return (
    <TextInput
      ref={inputRef}
      style={styles.input}
      value={value}
      multiline={multiline}
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
      inputAccessoryViewID={inputAccessoryViewID}
      allowFontScaling
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      testID={testID}
    />
  );
}

/** Today's own line of teaching on an empty page, exported so the demo asks in
 * the same words and the two can never drift apart. */
export const COMPOSER_HINT = 'like “bench 3x8 60, felt easy”';

/**
 * HOW LONG A HAND HAS TO BE STILL BEFORE THE APP DECIDES THE LINE IS WRITTEN
 * (owner, 17 September 2026).
 *
 * Typing is not a request for anything, and until this constant existed both
 * surfaces answered mid-word: Today put its check on the page at the first
 * character — a control offered beside `b` — and the onboarding demo re-read
 * the line on every keystroke, so the reading under it rewrote itself from
 * `3` to `8·8·8` to `60 kg × 8·8·8` while the athlete was still
 * writing it. The one moment that screen exists for was being spent three
 * letters at a time.
 *
 * 700 ms is the gap between words a person is still writing and a person who
 * has stopped. Long enough to sit through a thought mid-sentence, short enough
 * that putting the phone down and looking at it is not a wait.
 *
 * EXPORTED, and one number: the check and the reading are the same judgement
 * about the same hand, made on two screens that must not disagree about when
 * somebody has finished a line.
 */
export const WRITING_PAUSE_MS = 700;

/**
 * THE LINE BEING WRITTEN. One definition, used by Today and by the onboarding
 * demo (10 September 2026).
 *
 * Extracted for exactly the reason `NoteInput` and `ExerciseCard` were, and the
 * owner's sentence about the demo screen is the whole argument: *"Anything that
 * makes it behave differently from Today is a bug."* The field alone was never
 * the composer — the composer is the field PLUS the rail that arrives with the
 * first card, the live read-out of the line being typed, the blue line under it
 * while it is read, and the one example sentence on an empty page. A demo that
 * imported the field and rebuilt the other four would have looked right on the
 * day it was written and drifted from then on.
 *
 * Every value arrives as a prop and nothing is read from `session-store`, so
 * the same component serves a page backed by SQLite and a page backed by
 * nothing at all.
 */
/**
 * THE CHECK THAT ASKS FOR A READING — the one control an unread line carries,
 * and since 16 September 2026 the only way a written line becomes a record.
 *
 * IT IS A SHAPE NOW, NOT A GLYPH. It shipped as a bare blue checkmark drawn
 * straight onto the paper, and on this canvas that is not a control: §Structure
 * says the record is ink and *everything interactive floats as a white pill*,
 * so a mark with nothing around it is read as a STATUS — "this line is done" —
 * which is the exact opposite of what it means. Every confirm affordance on the
 * phone is a shape with a glyph inside it, and the workout apps that solved
 * this column first (Strong draws its per-set check as a filled tile under a
 * ✓ header) did not draw a loose glyph either.
 *
 * So it takes the app's OWN accessory-button shape, one scale down from the
 * keyboard row's 40: a white circle with `shadow.card`, the colour on the glyph
 * and never on the circle (§Structure), brand blue on white at 5.97:1. The
 * shadow is not decoration — a white pill on `canvas` is 1.05:1 by tone, so it
 * is the only thing that separates the control from the page.
 *
 * 28 pt, so the pill sits on a line of text without making the row taller than
 * the words in it, and the 44 pt target comes back as `hitSlop` (28 + 2 × 8),
 * which costs no layout. No wash: the press dip IS the feedback on a floating
 * pill, and a highlight inside a shadowed circle fights its own edge.
 *
 * ONE COMPONENT FOR BOTH PLACES IT STANDS — the unread card and the line being
 * written. The owner's ruling is that those are the same control in the same
 * column, and two copies of it would be two things to keep in step.
 */
function ConfirmMark({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      haptic="none"
      activeScale={0.9}
      hitSlop={spacing.sm}
      accessibilityRole="button"
      accessibilityLabel="Read my note"
      style={styles.confirmMark}>
      <Icon name="check" size={moderateScale(15)} tint={color.brand} />
    </PressableScale>
  );
}

export function Composer({
  inputRef,
  value,
  onChangeText,
  onSubmitEditing,
  placeholder,
  /** Nothing has been read on this page yet — no rail and no marker, and the
   * cursor opens on the body's own margin like a new note in Apple Notes. */
  canvas,
  /** There is a record above this line, so it takes the page's largest gap —
   * the one boundary that means "everything above this is written down". */
  afterRecord,
  /** The live read-out of what is in the field right now: the parse, before it
   * is committed. Null while there is nothing to say about it. */
  rows,
  /** The line is being read — the blue line under the field and the working
   * mark in the value column. */
  pending,
  /**
   * The line's reading is owed and the phone cannot reach the service. Same
   * slot, same geometry, amber and still — see `PendingCard`'s `waiting`, whose
   * two marks this matches so the state looks the same wherever the athlete is
   * looking (which is the whole reason the mark moved onto the line).
   */
  waiting = false,
  /** Last session's real sets, offered for the exercise being named (Today
   * only: it takes a history to read one from). */
  prefill,
  /**
   * The check that starts the parse, on the line being written (owner, 16
   * September 2026 — the same ruling that put it on `PendingCard`): it sits
   * right-aligned exactly where the reading dots will stand, and the dots
   * replace it only once it is tapped. Null while there is nothing unread —
   * or on the demo, which confirms nothing.
   */
  onConfirm,
  /** One example sentence under the line, on an empty page. */
  hint,
  /** Makes that sentence the tap target that writes itself into the line. */
  onHintPress,
  /** The `nativeID` of an `InputAccessoryView` to hang on the keyboard — see
   * `NoteInput`. */
  inputAccessoryViewID,
  reduceMotion,
}: {
  inputRef?: React.Ref<TextInput>;
  value: string;
  onChangeText: (text: string) => void;
  onSubmitEditing: () => void;
  placeholder: string;
  canvas: boolean;
  afterRecord: boolean;
  rows: { exercise: string; setText: string }[] | null;
  pending: boolean;
  waiting?: boolean;
  prefill: { reading: string; onAccept: () => void } | null;
  onConfirm?: (() => void) | null;
  hint?: string | null;
  onHintPress?: (() => void) | null;
  inputAccessoryViewID?: string;
  reduceMotion: boolean;
}) {
  /**
   * THE LINE AS IT STOOD WHEN THE WRITING LAST STOPPED — the check's one
   * condition (`WRITING_PAUSE_MS`).
   *
   * It is a pause, NOT a judgement about whether the line reads yet. The
   * offline grammar has an opinion and it is not allowed to hold this door:
   * the real parser reads names and shapes that grammar cannot, so a check
   * withheld until a small regex approves would be a line nobody can ask to
   * have read — a dead end on the one screen that must not have one (§3).
   *
   * Once it has arrived on a line it STAYS, however much more is typed. It is
   * an affordance, and an affordance that blinks out every time the hand moves
   * is worse than one offered early.
   */
  const [atRest, setAtRest] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setAtRest(value), WRITING_PAUSE_MS);
    return () => clearTimeout(t);
  }, [value]);
  /** Something is written, and the hand has been still since it was. An empty
   * field withdraws the check on the keystroke that empties it — there is
   * nothing left to read, and that answer needs no pause. */
  const confirm = value.trim().length > 0 && atRest.trim().length > 0 ? onConfirm : null;

  return (
    <>
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
          afterRecord && styles.activeRowAfterRecord,
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
          {/* THE LINE AND THE ONE MARK IT CARRIES, ON THE SAME ROW (owner,
              17 September 2026 — the 16 September ruling `PendingCard` already
              keeps: *"kljukica mora biti desno v isti vrstici … tam kjer so
              tiste tri pikice"*).

              It was under the field, right-aligned, and on an empty canvas
              that is not "on the line": with one short word written and no
              record above it, the pill stood alone in the middle of the page,
              a full line below the words it belongs to and directly on top of
              the example sentence — a floating button with nothing to be about
              (photographed on the owner's device, 17 September 2026).

              So the check stands where it stands on the card it settles into:
              the words on the left, the app's one slot hard against the right
              of the same line. The reading dots take that same slot the moment
              it is tapped, so the tap and the work it starts trade places
              without anything moving — which is the whole reason the slot
              exists. */}
          <View style={styles.activeLine}>
            <View style={styles.activeField}>
              <NoteInput
                inputRef={inputRef}
                value={value}
                /**
                 * MULTILINE, WITH RETURN HANDLED BY HAND (15 Sep 2026). The field
                 * looks and acts single-line, but a single-line UITextField
                 * FLATTENS a multi-line paste — the owner pasted a whole session
                 * and every affordance that works on physical lines (edit,
                 * delete, fix) then opened the entire note as one line; the
                 * exercise cards masked it because the parser reads several
                 * exercises out of one line by design. Multiline keeps the pasted
                 * newlines, `setActive` writes them into the note verbatim, and
                 * the note re-derives into real lines.
                 *
                 * The return key therefore arrives as a trailing "\n" instead of
                 * `onSubmitEditing`, and it MUST keep meaning commit — the bare-
                 * name prefill accept rides on it — so exactly that shape is
                 * turned back into a submit here. A "\n" anywhere else is a
                 * paste (or a mid-line return, which splits the line — the same
                 * thing a paste does) and passes through as text.
                 */
                multiline
                onChangeText={(raw) => {
                  // Windows/Notes clipboards carry \r\n; one newline spelling
                  // before anything downstream splits on "\n".
                  const text = raw.replace(/\r\n?/g, '\n');
                  if (text === `${value}\n`) {
                    onSubmitEditing();
                    return;
                  }
                  onChangeText(text);
                }}
                onSubmitEditing={onSubmitEditing}
                /**
                 * NO SCROLL ON FOCUS. It was here to compensate for the
                 * `KeyboardAvoidingView` that used to wrap this page; with
                 * `automaticallyAdjustKeyboardInsets` the scroll view brings its
                 * own first responder into view, on the UI thread, which is the
                 * whole reason that prop replaced the wrapper.
                 */
                placeholder={placeholder}
                inputAccessoryViewID={inputAccessoryViewID}
              />
            </View>
            {pending ? (
              <Animated.View
                entering={reduceMotion ? undefined : FadeIn.duration(180)}
                style={styles.composerMark}
                accessibilityRole="progressbar"
                accessibilityLabel="reading, in progress">
                <ReadingMark />
              </Animated.View>
            ) : waiting ? (
              <Animated.View
                entering={reduceMotion ? undefined : FadeIn.duration(180)}
                style={styles.composerMark}>
                <WaitingMark />
              </Animated.View>
            ) : confirm ? (
              <Animated.View
                entering={reduceMotion ? undefined : FadeIn.duration(180)}
                style={styles.composerMark}>
                <ConfirmMark onPress={confirm} />
              </Animated.View>
            ) : null}
          </View>
          {/* Live read-out of what you're typing — the parse, before you commit. */}
          {rows && rows.length ? (
            <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(180)}>
              {rows.map((row, j) => (
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
                {rows.length > 1
                  ? `return to add ${rows.length} exercises`
                  : 'return to add'}
              </Text>
            </Animated.View>
          ) : prefill ? (
            // Last session's real sets — a dim record read to accept verbatim
            // (tap or return) or overwrite by typing your own numbers.
            <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(180)}>
              <PressableScale
                onPress={prefill.onAccept}
                haptic="none"
                hitSlop={spacing.xs}
                activeScale={ROW_SCALE}
                wash
                washStyle={styles.rowWash}
                style={styles.prefillRow}>
                <Text
                  style={styles.prefillReading}
                  numberOfLines={1}
                  maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {prefill.reading}
                </Text>
              </PressableScale>
              <Text style={styles.previewHint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                last session · return to log the same
              </Text>
            </Animated.View>
          ) : pending ? (
            // THE BLUE LINE UNDER THE FIELD, and nothing else down here since
            // the dots moved up onto the line itself (17 September 2026).
            //
            // It does not break §14's rule about moving what somebody has
            // written, because it is under the FIELD rather than under the
            // cursor: nothing the athlete has written moves, is dimmed, or is
            // crossed. It is the same mark the settled row wears while it is
            // being read, so the working state looks the same wherever the
            // athlete happens to be looking.
            <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(180)}>
              <View style={styles.composerLine}>
                <ReadingLine />
              </View>
            </Animated.View>
          ) : null}
        </Animated.View>
      </Animated.View>

      {/* THE ONE LINE OF TEACHING, under the line it is teaching.
          On Today it is EARNED AWAY — it shows while the athlete has fewer than
          three sessions and then never again (`pref_composer_hint_done`),
          because an example of the thing being asked for beats an explanation
          of it, and after three sessions an example is just a sentence in the
          way. In the onboarding demo it is always on: nobody there has a
          session yet.

          It renders here rather than after the coach hint and the reflection
          row, which is where Today's JSX used to put it, and the order is
          unchanged in practice: this line needs an EMPTY canvas and both of
          those need a settled card, so no two of the three are ever on screen
          at the same time.

          `onHintPress` makes the sentence the tap target as well as the
          example — the demo's "use this example", on the line that already
          names one, rather than a second control standing beside it. Today
          passes none: an athlete on their third session does not need the app
          to type for them. */}
      {hint ? (
        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(240)}>
          {onHintPress ? (
            <PressableScale
              onPress={onHintPress}
              haptic="none"
              activeScale={ROW_SCALE}
              wash
              washStyle={styles.rowWash}
              hitSlop={spacing.xs}
              accessibilityRole="button"
              accessibilityLabel={`Write this example for me: ${hint}`}>
              <Text style={styles.canvasHint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {hint}
              </Text>
            </PressableScale>
          ) : (
            <Text style={styles.canvasHint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {hint}
            </Text>
          )}
        </Animated.View>
      ) : null}
    </>
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
  gap = null,
  alias,
  note,
  rawLine,
  showWords,
  reduceMotion,
  onToggle,
  onEdit,
  onNote,
  onDelete,
  onToggleWords,
  onFix,
}: {
  row: ReceiptRow;
  order: number;
  done: boolean;
  /**
   * What this reading is provably missing (`lib/parse/gaps.ts`) — "bench 120"
   * has a load and no reps, and the record must say so rather than stand as a
   * complete-looking card the totals quietly skip. Amber, because it is an
   * input problem and not an error; absent for every complete reading, which
   * is nearly all of them. The parser never fills the gap (§3) — this line is
   * how the athlete finds it, and the card's ordinary tap-to-edit is the fix.
   */
  gap?: ReadingGap | null;
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
  /**
   * Write about this entry. The card's ONE glyph since 16 September 2026, and
   * the only thing behind it: null on a surface with nowhere to keep a note
   * (the onboarding demo), where the button is simply absent rather than
   * present and dead.
   */
  onNote: (() => void) | null;
  /**
   * Remove this entry, for VoiceOver. The finger's door is the row's own
   * swipe-left (`SwipeToDelete`), which no screen reader can find — so the card
   * publishes the same action on the rotor, the way iOS publishes its own swipe
   * actions. Null wherever the row is not swipeable, so the two can never
   * disagree about whether delete exists.
   */
  onDelete: (() => void) | null;
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
      {/* The check is its own tap target: done ↔ not-done, never deletes.
          It DIPS rather than washing: the target is a 22 pt ring, and a grey
          box fading up around a circle would read as a button appearing under
          it. A ring that takes the finger is the whole feedback it needs. */}
      <PressableScale
        onPress={onToggle}
        haptic="none"
        activeScale={0.88}
        hitSlop={MARK_HIT}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        style={styles.rail}>
        <AnimatedCheck done={done} reduceMotion={reduceMotion} />
      </PressableScale>
      {/* The body edits the line. While the written words are showing, a tap
          puts them away again rather than opening the editor — the way out is
          the way you came in. */}
      <PressableScale
        onPress={showWords ? onToggleWords : onEdit}
        onLongPress={onToggleWords}
        haptic="none"
        activeScale={0.98}
        wash
        washStyle={styles.bodyWash}
        accessibilityHint={showWords ? 'Shows the reading again' : 'Long press to show your words'}
        // Delete, on the rotor, because the gesture that carries it cannot be
        // seen. It sits on the BODY rather than on a wrapper: iOS attaches
        // custom actions to the focused accessibility element, and the body is
        // the element VoiceOver lands on when it reads this entry out.
        accessibilityActions={onDelete ? DELETE_ROTOR_ACTIONS : undefined}
        onAccessibilityAction={
          onDelete
            ? (e) => {
                if (e.nativeEvent.actionName === 'delete') onDelete();
              }
            : undefined
        }
        style={styles.cardBody}>
        {/* THE GLYPH SITS ON THE NAME'S OWN ROW (9 September 2026), which is
            the 29 August ruling the pending card already carries, finally
            applied to the card it settles into. Measured before the change: the
            glyph's optical centre was **7.1 pt below the ring's** and 9.1 pt
            below the name's, because a 36 pt button top-aligned to a card five
            sets tall centres on nothing. Inside this row it centres on the line
            it is about — and the body reclaims the 44 pt the side column was
            holding, which is what stopped "Triceps Pushdown" truncating at
            17 pt. */}
        <View style={styles.cardHead}>
          <View style={styles.headText}>
          <Text
            style={[styles.exName, !done && styles.exNameUndone]}
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {row.exercise}
          </Text>
          {alias ? (
            // The echoed word is the auto-fix made visible — tapping it opens
            // the correction sheet, so a wrong guess is one tap from repaired.
            <PressableScale
              onPress={onFix}
              haptic="none"
              activeScale={0.94}
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
            </PressableScale>
          ) : null}
          {isPr ? <PrLabel animate /> : null}
          </View>
          {/* THE CARD'S ONE GLYPH IS THE NOTE (owner, 16 September 2026).
              It was a ⋯ opening a four-row menu, and three of those rows were
              doors to somewhere else. History is the Progress tab's entire job
              and was a second, worse way in. Fixing a reading already has two
              better doors on this very card — the body's own tap opens the
              line for editing, and a mis-read word carries the echo beside the
              name that opens the correction sheet. Delete became the gesture
              the rest of the phone uses (`SwipeToDelete`). What was left was
              the one thing the card genuinely cannot do by itself, so it stops
              being a menu and becomes the action: writing about this lift.

              Outline while there is nothing written, filled once there is —
              the state IS the glyph, so a card with a remark on it says so at
              the same size it says everything else. The remark itself prints
              under the card wearing THIS SAME BUBBLE (`Remark`), so the door
              and what comes through it are one mark; this is the way in to
              change it. */}
          {onNote ? (
            <PressableScale
              onPress={onNote}
              haptic="none"
              activeScale={0.9}
              // The target the 25 pt box no longer carries: 25 + 2 × 12 = 49.
              hitSlop={spacing.md}
              wash
              washStyle={styles.btnWash}
              accessibilityRole="button"
              accessibilityLabel={
                note ? `Edit your note on ${row.exercise}` : `Write a note on ${row.exercise}`
              }
              style={styles.sideBtn}>
              <Icon
                name={note ? 'note-on' : 'note'}
                size={moderateScale(17)}
                tint={note ? color.textSecondary : color.textMuted}
              />
            </PressableScale>
          ) : null}
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
        {gap ? (
          // The word carries the meaning and the amber only marks it (design
          // skill §Colour) — and it names the fix, because the card's own tap
          // already opens the line for exactly that edit.
          <Text
            style={styles.gapHint}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            accessibilityLabel={
              gap === 'reps' ? 'Reps missing — tap to add them' : 'Weight missing — tap to add it'
            }>
            {gap === 'reps' ? '? reps · add reps' : '? kg · add weight'}
          </Text>
        ) : null}
        {sub ? (
          <Text style={styles.exSub} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {sub}
          </Text>
        ) : null}
        {/* WHAT THE ATHLETE WROTE BESIDE THE NUMBERS (owner, 16 September
            2026). The parser has been lifting these out of the line since
            v6 — "bench 100x5, tehnika super" — and the card printed the
            numbers and dropped the sentence. Quoted here in exactly the voice
            a remark written on its OWN line gets (`CommentLine`), so the two
            ways of writing the same thing look the same on the page.

            No pressable of its own: the card body already opens this line in
            the editor, which is where these words live (`raw_text`) and the
            one place they can be changed. */}
        {row.comments.map((comment, ci) => (
          <Remark key={`cm:${ci}`} text={comment} />
        ))}
        {/* The remark, under its own entry: the athlete's words sit in the
            record they were written about, not behind a sheet. Two lines at
            most — the whole note is one tap away, on the glyph above, which is
            the same bubble this line is marked with. */}
        {note ? <Remark text={note} numberOfLines={2} /> : null}
      </PressableScale>
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
export function EditRow({
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
          {/* DELETE IS THE GLYPH, NOT THE WORD (owner, 16 September 2026).
              It was the word "Delete" in red beside the field — the only
              control on this page spelled out in letters, and a label is what
              a mark needs only when the mark is ambiguous. The trash is not:
              it is the destructive mark on this phone, and iOS spends red on
              exactly one row of a menu to say so (Ulysses, Daylio, Mail — all
              the same outline trash in red, every other glyph ink).

              It is also the SAME GLYPH THE SWIPE SHOWS (`swipe-to-delete.tsx`),
              which matters more than the word did: one action has one mark, so
              the two doors to it are recognisably one thing.

              A BARE GLYPH, not a pill — the shape is the urgency on this page.
              The confirm check takes a white pill because nothing is recorded
              until it is pressed; this asks for nothing, so it rests as ink the
              way the note bubble does two rows up.

              THE LABEL MOVES TO VOICEOVER RATHER THAN DISAPPEARING. The word
              was the accessible name; with it gone the button needs one
              stated, or a screen reader reaches an unnamed control on the one
              row where the mistake is unrecoverable. */}
          <PressableScale
            onPress={onDelete}
            haptic="none"
            activeScale={0.94}
            // 20 pt glyph + 2 × 4 padding = 28, and the target is restored
            // without layout: 28 + 2 × 8 = 44 (§14).
            hitSlop={spacing.sm}
            wash
            washStyle={styles.btnWash}
            accessibilityRole="button"
            accessibilityLabel="Delete this line"
            style={styles.deleteBtn}>
            <Icon name="trash" size={moderateScale(20)} tint={color.error} />
          </PressableScale>
        </View>
        <View style={styles.editHintRow}>
          <Text style={styles.previewHint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            editing · return saves · re-reads automatically
          </Text>
          {onFix ? (
            <PressableScale
              onPress={onFix}
              haptic="none"
              activeScale={0.94}
              hitSlop={{ top: spacing.md, bottom: spacing.md, left: spacing.sm, right: spacing.sm }}
              accessibilityRole="button"
              accessibilityLabel="Fix how Recore read this line">
              <Text style={styles.fixLink} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                fix reading
              </Text>
            </PressableScale>
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
export function PendingCard({
  text,
  reading = true,
  waiting = false,
  order,
  reduceMotion,
  onPress,
  onConfirm = null,
}: {
  text: string;
  /**
   * Is a parse genuinely in flight? The beam and the dots claim WORK, and
   * since the checkmark ruling (15 Sep 2026) an unread line usually sits with
   * no parse running — the athlete simply has not asked yet. Then the card is
   * the words at rest: same shape, same hollow ring, nothing moving and
   * nothing claiming to read. Defaulted true for the onboarding demo, whose
   * pending moment really is a read in progress.
   */
  reading?: boolean;
  /**
   * THE READING WAS ASKED FOR AND THERE IS NO SIGNAL (owner, 17 September
   * 2026: *"oznaci tudi to vrstico da je v obdelavi … z oranzno/rumeno
   * barvo"*).
   *
   * The third state this card has, and the one that was missing: not being
   * read, not idle either. The request is queued in `needs_parse` and owed;
   * what is absent is a connection to spend it on. So the card keeps the words
   * exactly as they are and turns its two marks amber — the rail ring and the
   * three still dots — which says *asked, and waiting* without claiming work
   * that is not happening. Never true at the same time as `reading`:
   * `session-store.ts` owns the flag (`parseStalled`) and `net-state.ts` is
   * the only thing that can end it.
   */
  waiting?: boolean;
  /** Rank among the lines being read — the beam's stagger. */
  order: number;
  reduceMotion: boolean;
  onPress: () => void;
  /**
   * THE CHECK LIVES ON THE LINE (owner, 16 September 2026: *"kljukica mora
   * biti desno v isti vrstici … tam kjer so tiste tri pikice"*). While the
   * line is unread and idle, the ⋯ column — the one slot on this card that
   * belongs to the app — holds the checkmark that starts the parse, and the
   * reading dots take that same slot only AFTER it is tapped. This
   * supersedes the 15 September placement beside the status line. Null (the
   * onboarding demo) leaves the slot empty at rest, as before.
   */
  onConfirm?: (() => void) | null;
}) {
  return (
    // ENTERING ONLY, DELIBERATELY. An exiting animation would be the obvious
    // way to cross-fade into the read card, and it is the wrong one: a view
    // that is animating out still holds its place in the layout, so for the
    // length of the fade the ledger would stand one card taller and then
    // collapse — the exact reflow this card was reshaped to remove. The
    // exchange is carried by the read card's own arrival instead.
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(DUR.fast)}>
      <PressableScale
        onPress={onPress}
        haptic="none"
        activeScale={ROW_SCALE}
        wash
        washStyle={styles.rowWash}
        accessibilityLabel={
          reading
            ? `${text} — reading`
            : waiting
              ? `${text} — saved on this phone, waiting for a connection to be read`
              : `${text} — not read yet`
        }
        style={styles.card}>
        <View style={styles.rail}>
          <View style={[styles.railHollow, waiting && styles.railHollowWaiting]} />
        </View>
        {/* ONE ROW, CENTRED ON THE WORDS. The ⋯ column lives inside this row
            rather than beside it, so the mark sits on the words' own optical
            centre instead of in the middle of a 36 pt button box that is
            top-aligned to a card three lines tall — which put the dots below
            the descenders, reading as a footnote to the line rather than as
            its status (owner, 29 August 2026). The slot keeps the column's
            width and the gap before it, so the mark's x is unchanged: it still
            lands exactly where the ⋯ will. */}
        {/* THE WORDS AND THEIR OWN LINE, in one column (10 September 2026).
            The blue line used to cross the whole card at its foot, which is a
            rule between two records — the one thing §Structure forbids on this
            page. Here it is a child of the text column, so the words size it:
            it starts where they start, ends where they end, and cannot be read
            as a divider because it does not reach where one would be. */}
        <View style={styles.pendingHead}>
          <View style={styles.pendingBody}>
            <Text
              style={styles.pendingText}
              numberOfLines={2}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {text}
            </Text>
            {/* Inside the WORDS' column, not the row's: it has to stop where
                the text stops, or it runs on under the ⋯ and is a rule again. */}
            {reading ? <ReadingLine flow order={order} /> : null}
          </View>
          {/* The ⋯ column: the CHECK while the line waits for its reading,
              the dots while one is in flight — same slot, so the tap and the
              work it starts trade places without anything moving. */}
          <View style={styles.pendingMark}>
            {reading ? (
              <ReadingMark />
            ) : waiting ? (
              // The check is NOT offered here, and that is the honest choice:
              // tapping it would ask for a reading the phone cannot fetch, and
              // a control whose only outcome is the state you are already in is
              // a control that lies. The reading is already asked for — this
              // mark says so, and it goes when the signal comes back.
              <WaitingMark />
            ) : onConfirm ? (
              <ConfirmMark onPress={onConfirm} />
            ) : null}
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

/**
 * What the meta line under an unread line says, by what the line is missing
 * (`lib/parse/gaps.ts`). Prose keeps its old quiet sentence; the three GAP
 * states are amber, because each names an input problem the athlete can fix
 * with the tap this card already answers — and each is a statement, not an
 * alarm: the words above it are untouched and nothing was invented from them.
 */
const NOTE_META: Record<UnreadLineGap, string> = {
  'no-exercise': 'no exercise named · not counted',
  'no-sets': 'no sets yet · not counted',
  unread: 'sets not read · not counted',
};

/**
 * THE ATHLETE'S REMARK, UNDER THE LIFT IT IS ABOUT (owner, 16 September 2026).
 *
 * A prose line written after an exercise line — "felt heavy today", "koleno
 * malo teži" — used to render as its own row captioned "kept as a note · not
 * counted". True, and in the wrong place: the words are about the card above
 * them, and the ledger read as though the athlete had said something
 * unrelated in the middle of their session.
 *
 * So it hangs under that card: no rail mark of its own (it is not a separate
 * record), indented onto the card's own text column so it reads as a
 * continuation of it, in the same quiet voice — the bubble and the ink of
 * `Remark` — that the per-entry note speaks in. The gap above it is tight and
 * the gap below it is the record's own, which is what makes it look attached
 * rather than merely nearby.
 *
 * It is NOT the per-entry note (`workouts.entry_notes`): these words live in
 * `raw_text` like every other line the athlete wrote, and tapping them opens
 * that line in the editor. Nothing here is a projection the parser owns —
 * this component only decides where the line is printed.
 */
/**
 * THE ATHLETE'S OWN WORDS, WHEREVER THEY WERE WRITTEN (16 September 2026).
 *
 * Three surfaces print a remark about one lift — words typed inside the line
 * ("bench 100x5, tehnika super"), a prose line written under it, and the note
 * kept in `entry_notes` — and all three were drawn as curly-quoted grey text.
 * Quotation marks were doing a job punctuation should not have to do: saying
 * *whose voice this is*. They are also the only curly quotes on the page, and
 * they cost the line two characters of width on a surface where an exercise
 * name already truncates.
 *
 * The mark does it instead, and it is THE SAME BUBBLE the card's own note
 * button wears — so the door and what comes through it share a glyph, and a
 * person who taps the bubble sees a bubble appear under the entry. Muted,
 * because the mark only labels the line and the prose carries the meaning
 * (§Colour: *colour marks, ink speaks*); `textSecondary` for the words, which
 * are information.
 *
 * It also settles a real ambiguity on a dense card. The footer already holds
 * the app's own computed lines — the comparison, the amber gap — in the reading
 * face, and the remark is sans; the voices were distinct but only to someone
 * looking for it. A glyph in front of one of them is distinct at a glance.
 */
function Remark({ text, numberOfLines }: { text: string; numberOfLines?: number }) {
  return (
    <View style={styles.remark}>
      {/* A box on the text's own line height, so the bubble sits on the FIRST
          line's optical centre whether the remark runs to one line or three —
          a glyph aligned to the top of a wrapping paragraph drifts. */}
      <View style={styles.remarkGlyph}>
        <Icon name="note" size={moderateScale(12)} tint={color.textMuted} />
      </View>
      <Text
        style={styles.remarkText}
        numberOfLines={numberOfLines}
        maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {text}
      </Text>
    </View>
  );
}

function CommentLine({
  text,
  reduceMotion,
  onPress,
}: {
  text: string;
  reduceMotion: boolean;
  onPress: () => void;
}) {
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(DUR.fast)}>
      <PressableScale
        onPress={onPress}
        haptic="none"
        activeScale={ROW_SCALE}
        wash
        washStyle={styles.rowWash}
        accessibilityRole="button"
        accessibilityHint="Opens this line for editing"
        accessibilityLabel={`Your note: ${text}`}
        style={styles.commentRow}>
        <Remark text={text} />
      </PressableScale>
    </Animated.View>
  );
}

export function NoteCard({
  text,
  gap = null,
  onPress,
}: {
  text: string;
  /** Why this line has no reading, when that is a fixable gap rather than
   * ordinary prose. Null = a note, kept as ever. */
  gap?: UnreadLineGap | null;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      haptic="none"
      activeScale={ROW_SCALE}
      wash
      washStyle={styles.rowWash}
      style={styles.card}>
      <View style={styles.rail} />
      <View style={styles.cardBody}>
        <Text style={styles.proseText} numberOfLines={3} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {text}
        </Text>
        <Text
          style={[styles.proseMeta, gap ? styles.proseMetaWarn : null]}
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {gap ? NOTE_META[gap] : 'kept as a note · not counted'}
        </Text>
      </View>
    </PressableScale>
  );
}

/**
 * THE RECORD HANGS OFF ONE LEFT EDGE (9 September 2026).
 *
 * Measured on the iPhone 17 Pro simulator before the change: the page title's
 * left edge sat at **16.7 pt** and the check ring's at **22.3 pt** — the ring
 * was 5.7 pt inside the margin every other thing on the page starts on, which
 * is the "small enough to look like a rendering artefact and large enough to
 * see" mistake Next's own gutter note names. It came from a rail 12 pt wider
 * than the mark it holds, centring the ring inside its own column.
 *
 * The rail IS the mark now, and the air that used to be spare width inside it
 * is the gap after it instead — so the ring starts on the margin, and the
 * record's text starts one honest indent in (16.7 + 22 + 12 = 50.7 pt, which is
 * Apple Notes' own checklist indent to within a point).
 */
const MARK = moderateScale(22);
/** The pending line's own text box — see `pendingText`. */
const PENDING_LINE = lineFor(22);
/**
 * The confirm pill's diameter (`ConfirmMark`). 28 so it centres on a line of
 * text without making the row taller than the words, and so `spacing.sm` of
 * hitSlop on each side restores exactly the 44 pt target: 28 + 2 × 8.
 */
const CONFIRM_PILL = moderateScale(28);
/**
 * ONE LINE OF THE COMPOSER, as the field sets it. Read by the field's own
 * `lineHeight` and by the mark beside it, which centres on the FIRST line of
 * whatever is in the field — so the two cannot drift, and a pasted session ten
 * lines long still wears its check next to line one, exactly where the card it
 * settles into will draw it.
 */
const COMPOSER_LINE = lineFor(23);
/** One line box for a remark — the glyph's slot and the prose's line height are
 * the same number, which is what puts the bubble on the first line's centre. */
const REMARK_LINE = lineFor(18);
const RAIL_W = MARK;
/** Ring → text. It absorbed the 12 pt the rail gave back, so the text did not
 * move when the ring did. */
const RAIL_GAP = spacing.md;
/** The ring's own target with the rail this narrow: 22 + 2 × 12 = 46 ≥ 44. */
const MARK_HIT = spacing.md;

/**
 * A RECORD ROW DOES NOT DIP (6 September 2026).
 *
 * The ledger's rows answer a press with the wash alone. A full-bleed row that
 * shrinks 2 % drags its check mark and its ⋯ inward with it, which reads as the
 * whole page flexing rather than as one line being held — and the record's own
 * promise is that it holds still. Small controls inside the row (the ring, the
 * ⋯, Delete) still dip, because a control is an object you push and a row is a
 * surface you touch.
 */
const ROW_SCALE = 1;

const styles = StyleSheet.create({
  /**
   * THE CANVAS IS THE SCROLL VIEW'S OWN BACKGROUND, and that is the whole
   * reason this page can have both warm paper and a collapsing title.
   * `app/(tabs)/today/_layout.tsx` carries the measurement: an `absoluteFill`
   * `PaperField` sibling costs UIKit the scroll view it tracks, and a hoisted
   * one is painted over by the navigator's opaque container. A background on
   * the scroll view itself is neither. Same three stops as `PaperField`,
   * derived from them.
   */
  body: {
    flex: 1,
    experimental_backgroundImage: PAPER_FIELD_CSS,
  },
  content: {
    flexGrow: 1,
    // No top padding: UIKit's `contentInsetAdjustmentBehavior` already leaves
    // the large title's space, and the dateline hugs the title under it.
    paddingHorizontal: BODY_PADDING_H,
    /**
     * The bottom is NOT UIKit's. Content scrolls behind the glass tab bar so
     * the bar has something to refract (§5.2), and — since the accessory bar
     * became an overlay rather than a row under the page — the last line has to
     * clear that too. `huge` is the bar's own two-row height rounded up; with
     * the keyboard open UIKit adds its inset underneath this, so the same
     * number clears the bar in both states.
     */
    paddingBottom: spacing.huge + TAB_BAR_CLEARANCE,
  },
  fill: {
    flexGrow: 1,
  },

  // A block per exercise: a left rail (check / marker) + the reading.
  card: {
    flexDirection: 'row',
    gap: RAIL_GAP,
    paddingVertical: spacing.md,
  },
  /**
   * THE PRESSED ROW IS WASHED, NOT FADED (6 September 2026).
   *
   * Every touchable on this page used to answer with `opacity: 0.6` — a hard
   * cut down and a hard cut back, applied through a React state flip, which is
   * `:active { opacity: .6 }` with extra steps. Two things were wrong with it
   * beyond the mechanism: it faded the RECORD, and the record is the one thing
   * on this screen that must never look like it is going away; and it could
   * not fade, so a fast tap was a blink.
   *
   * The wash is the design system's `surfaceHigh` rising behind the content on
   * the UI thread (`PressableScale`), so the paper darkens under the finger and
   * the ink stays exactly where it is. It bleeds past the text horizontally the
   * way a list-row highlight does, and it insets vertically so two adjacent
   * records never touch.
   */
  rowWash: {
    top: spacing.xs,
    bottom: spacing.xs,
    left: -spacing.sm,
    right: -spacing.sm,
  },
  /** The card BODY is one column of three, so its wash reaches out toward the
   * rail and the ⋯ — the entry is held, not the middle of it. */
  bodyWash: {
    top: -spacing.xs,
    bottom: -spacing.xs,
    left: -spacing.sm,
    right: -spacing.sm,
  },
  /** A control's wash is its own box, at its own radius. */
  btnWash: {
    borderRadius: moderateScale(8),
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
  /** The ring of a line whose reading is owed and cannot be fetched. Amber at
   * the SAME 1.5 pt the idle ring wears: §Motion's rule that a border never
   * grows applies to a border that changes colour too — the mark restates
   * itself, it does not get louder. */
  railHollowWaiting: {
    borderColor: color.warning,
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
  /** Name, echo and PR on the left; the ⋯ hard against the page's right
   * margin. `center` is what puts the glyph on the name's own optical line. */
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  /** Everything the row SAYS, taking the free width so the note glyph is
   * pushed to the edge rather than sitting wherever the name happens to end. */
  headText: {
    flex: 1,
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
  /**
   * THE ECHO GIVES WAY FIRST. Both this and the name shrank at the same rate,
   * so a long pair truncated BOTH — "Triceps Pushdo… · “tricpes pushdow…”",
   * two half-words where one whole one and one half would do. The name is the
   * record; the echo is a footnote on how the parser got there.
   */
  aliasWrap: {
    flexShrink: 3,
  },
  aliasEcho: {
    // The user's own word, quietly echoed when the parser corrected the name.
    fontSize: moderateScale(13),
    color: color.textSecondary,
  },
  /**
   * The one-line reading a single set keeps instead of a table.
   *
   * It is the SAME FACT a table row holds, so since 11 September 2026 it is
   * printed with the same authority: the record's ink at the reading size the
   * table uses, not a 14 pt grey aside. A card with one set was the smallest
   * type on the page and the hardest thing on it to read.
   */
  exValue: {
    ...readingStyle('500'),
    fontSize: moderateScale(16),
    color: color.textPrimary,
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
  /** The missing half of an incomplete reading — "? reps · add reps". The
   * reading voice at the comparison line's size, in `warning` amber: an input
   * gap, marked and named, on the card whose tap already fixes it. */
  gapHint: {
    marginTop: 2,
    ...readingStyle('500'),
    fontSize: moderateScale(11.5),
    color: color.warning,
  },
  /**
   * THE ATHLETE'S OWN WORDS UNDER THEIR ENTRY (see `Remark`). Prose, so it
   * leaves the reading voice the numbers speak in — this is the one line on the
   * card that Recore did not compute — and it wears the note bubble rather than
   * a pair of curly quotes, so the mark says whose voice it is and the
   * punctuation goes back to being punctuation.
   *
   * `flex-start` on the row, not `center`: a remark that wraps to three lines
   * must keep its mark on the FIRST one, beside where the sentence starts.
   */
  remark: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs + 2,
    marginTop: 3,
  },
  /** `minHeight`, never `height`, around a glyph that sits on a label's line
   * (design skill §Typography) — the reader's text size grows the line and a
   * fixed box would hold the bubble above it. */
  remarkGlyph: {
    minHeight: REMARK_LINE,
    justifyContent: 'center',
  },
  remarkText: {
    // The words take the rest of the row, so a long remark wraps under itself
    // rather than pushing the card wider than the record it belongs to.
    flex: 1,
    fontSize: moderateScale(13),
    lineHeight: REMARK_LINE,
    color: color.textSecondary,
  },
  /**
   * The remark hanging under its card. Indented onto the card's own text column
   * (`RAIL_W + RAIL_GAP` — the rail is deliberately empty: a comment is not a
   * second record and must not grow a second check mark), and the vertical
   * rhythm does the attaching: it sits close under the card it belongs to
   * (`spacing.xs` up, against the `spacing.md` a card row pays) so the eye
   * groups the two without a bracket, a line or a card around them.
   */
  commentRow: {
    marginTop: -spacing.xs,
    paddingLeft: RAIL_W + RAIL_GAP,
    paddingBottom: spacing.xs,
  },
  /* (`commentText` and `exNote` were one style written twice — "one voice for
     the athlete's own remark, wherever it was written". That voice is a
     COMPONENT now, `Remark`, so the two cannot drift and the glyph in front of
     the words arrives on all three surfaces at once.) */
  /**
   * THE GLYPH IS ALIGNED BY ITSELF, NOT BY ITS BOX (9 September 2026).
   *
   * `alignItems: 'center'` in a 36 pt button put the glyph's right edge at
   * **374.3 pt** while the dateline's "1 session" ended at **384.3** — the only
   * two things on the right of the page, 10 pt apart, which is exactly the kind
   * of raggedness that reads as "nothing lines up" without being nameable.
   *
   * `flex-end` puts the button's own right edge on the margin and the glyph
   * against it. The measurement above was taken with SF's `ellipsis`, which
   * draws its dots 1.7 pt inside its box and so landed them on 384.3 exactly.
   * The glyph is the note bubble now (16 Sep 2026) and Ionicons sets its own
   * inset, so the box is still on the margin but the number is the ellipsis's,
   * not this glyph's — worth re-measuring on device the next time this column
   * is touched.
   */
  /**
   * …AND IT IS SIZED BY THAT GLYPH, NOT BY A TARGET.
   *
   * A 36 × 36 button inside the name's row makes the ROW 36 tall, and the name
   * then centres in a box 15 pt taller than itself — measured straight after
   * the move: the ring at the card's top edge and the name's optical centre
   * **6.2 pt** below it. Trading one misalignment for another.
   *
   * So the box is the glyph plus a little air (≈25 pt), the row is the name's
   * own height again, and the 44 pt target comes from `hitSlop`, which costs no
   * layout. `paddingRight: 0` puts the glyph's box on the page margin.
   */
  sideBtn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xs,
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
    // SPELLED OUT because something now has to match it (10 Sep 2026). The ⋯
    // column is aligned to the WORDS' optical centre (owner, 29 Aug), and the
    // words' column grew a line under them, so `alignItems: 'center'` on the
    // row would centre the mark on text-plus-line instead. A stated line box is
    // a number both can use, and the design system asks for one anyway.
    lineHeight: PENDING_LINE,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: color.textSecondary,
  },
  /**
   * The mark's column — so whatever stands in it sits on the words' own centre
   * whatever is stacked below them.
   *
   * IT IS THE PILL'S HEIGHT, NOT THE LINE'S, AND THAT IS A YOGA FACT (measured
   * on the iPhone 17 Pro, 16 September 2026). The slot used to be exactly one
   * text line tall with `justifyContent: 'center'`, which is correct for the
   * reading dots and wrong for anything TALLER than the line: Yoga clamps an
   * oversized child to the top of a fixed-height box instead of overflowing it
   * both ways, so the 28 pt confirm pill hung with its centre at **152.5 pt**
   * against the check ring's **149.2** and the words' own ink centre at
   * **148.0** — 3–4 pt of droop, which is exactly the "too small to name and
   * too large to miss" error this file's other alignment notes are about.
   *
   * Taking the pill's height and paying the difference back as a negative
   * margin puts the slot's centre exactly where the one-line slot's was, so
   * **the dots do not move at all** — which is the whole point of the column:
   * the tap and the work it starts trade places without anything shifting.
   */
  pendingMark: {
    height: CONFIRM_PILL,
    marginTop: (PENDING_LINE - CONFIRM_PILL) / 2,
    justifyContent: 'center',
  },
  /**
   * THE CONFIRM PILL (see `ConfirmMark`). A white circle on the warm canvas is
   * **1.05:1 by tone**, so `shadow.card` is not decoration here — it is the
   * only thing that separates the control from the page (`elevation.ts`). No
   * `borderCurve`: a full circle has no squircle to continue.
   */
  confirmMark: {
    width: CONFIRM_PILL,
    height: CONFIRM_PILL,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  /**
   * THE LINE BEING WRITTEN, AS A ROW: the field takes the width, and the app's
   * one slot stands at the end of it (see the composer's note).
   *
   * `flex-start` so the mark holds line ONE when the field grows — a pasted
   * session is several lines tall and its check belongs where the check on the
   * card it becomes will be, not beside the last thing typed.
   */
  activeLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  /** The words' own column. `flex: 1` and nothing else: the field is as wide
   * as the line minus whatever the mark is holding, and as wide as the whole
   * line when it is holding nothing. */
  activeField: {
    flex: 1,
  },
  /**
   * THE MARK'S SLOT ON THAT ROW — the check, then the dots, in the same place.
   *
   * Centred on the first LINE rather than on the row, by the arithmetic
   * `pendingMark` uses one card down: a 28 pt pill in a 23 pt line box is
   * hung by a negative top margin, never by `justifyContent` on a box the
   * pill is taller than — Yoga clamps an oversized child and leaves it
   * sitting low, which is the defect this whole change is about.
   */
  composerMark: {
    height: CONFIRM_PILL,
    marginTop: (COMPOSER_LINE - CONFIRM_PILL) / 2,
    justifyContent: 'center',
  },
  /** The words' row, and the only row this card has: the line on the left,
   * whatever the app has to say about it hard against the right, and the ⋯
   * column's own slot at the end. `alignItems: 'center'` is the whole point —
   * every mark on this row centres on the line's own height. */
  /** The words' own column, and the reason the line is the width it is: the
   * text and the line that says it is being read, stacked, taking the flex the
   * text used to take on its own. Everything to the right of it — the ⋯ column
   * — stays outside, so the line stops where the words do. */
  pendingBody: {
    flex: 1,
  },
  /** The pending row: the words' column, then the ⋯ column. `alignItems`
   * centres the mark on the WORDS rather than on the column, which is now
   * taller than they are — the line lives under them. */
  pendingHead: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  /** An input gap is amber (`warning`) — a problem with the line, never an
   * error state; the word beside it carries the meaning (§Colour). */
  proseMetaWarn: {
    color: color.warning,
  },

  // The active input line.
  activeRow: {
    flexDirection: 'row',
    gap: RAIL_GAP,
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
    lineHeight: COMPOSER_LINE,
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
  /**
   * The edit row's delete. Sized by its glyph and aligned by it, exactly as
   * `sideBtn` is: `paddingRight: 0` puts the trash's own box on the page
   * margin, so it stands in the SAME COLUMN as the settled card's note bubble
   * and the unread line's confirm pill — one right edge for everything the app
   * puts beside a record, whichever state that record is in.
   *
   * (`deleteText` went with the word it styled.)
   */
  deleteBtn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: moderateScale(8),
    borderCurve: 'continuous',
    /**
     * IT CENTRES ON THE WRITTEN LINE, NOT ON THE FIELD'S BOX. `editLine` sets
     * `alignItems: 'center'`, which centres the glyph on the TextInput's box —
     * and a field's ink does not sit in the middle of its own line box, because
     * the room below a descender is not the room above a cap. Measured on the
     * iPhone 17 Pro: the trash's ink centre at **339.2 pt** against the typed
     * line's **342.8**. The word "Delete" hid it; two pieces of text read as
     * aligned on their baselines, and a glyph beside text does not.
     *
     * The pair shifts the glyph down by exactly `spacing.xs` (a one-sided
     * margin would only move a centred item by half of it), which is 3.6 pt
     * rounded to the token the rest of this row is spaced with.
     */
    marginTop: spacing.xs,
    marginBottom: -spacing.xs,
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
  /**
   * The blue line's room under the composer's field. `ReadingLine` pins itself
   * to the FOOT of this box, so the height is the air between the words and the
   * line — not the line's own thickness.
   */
  composerLine: {
    height: spacing.sm,
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
    marginLeft: RAIL_W + RAIL_GAP,
    marginTop: spacing.sm,
    minHeight: moderateScale(44),
    justifyContent: 'center',
  },
  reflectText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: color.textSecondary,
  },
  // The answer to that prompt, once it exists, is `check-in-note.tsx` — a
  // quoted block in the record's own rail column. Its styles live with it.
  coachHint: {
    // Aligned with the card text, past the check column — the hint talks about
    // the marks, so it sits in their own indentation.
    marginLeft: RAIL_W + RAIL_GAP,
    marginTop: spacing.xs,
    fontSize: moderateScale(11),
    color: color.textSecondary,
  },
});
