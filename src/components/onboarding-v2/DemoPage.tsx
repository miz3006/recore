import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { EntryActionsSheet, joinNames, type EntryAction } from '@/components/entry-actions-sheet';
import {
  aliasEchoOf,
  Composer,
  EditRow,
  ExerciseCard,
  NEXT_PLACEHOLDER,
  NoteCard,
  PendingCard,
  PLACEHOLDER,
} from '@/components/note-surface';
import { TodayDateline } from '@/components/today-header';
import { longDayLabel, todayKey } from '@/lib/db/dates';
import { DEMO_EXAMPLE, demoEntryOfItem, demoParseText, type DemoEntry } from '@/lib/demo-parse';
import { tap, tapMedium } from '@/lib/haptics';
import { READING_STEP_MS } from '@/lib/motion/index';
import { buildReceipt, type ReceiptRow } from '@/lib/parse/receipt';
import { MAX_FONT_SCALE, spacing, type } from '@/lib/theme';

import { v2color, v2metrics } from './tokens';

/**
 * THE TODAY PAGE, IN ONBOARDING — screen 6, the aha moment (owner, 10
 * September 2026: *"redesign it and make it look like the today page 1:1 …
 * and all the features that are already on the today page, but for
 * onboarding"*).
 *
 * ## What changed, and why it had to
 *
 * The screen was already built out of Today's parts — `NoteInput` and
 * `ExerciseCard`, imported rather than copied — and it still was not Today. It
 * was a text box with a ledger under it: you typed a whole session into one
 * field, and a list of cards appeared below. Today does not work like that at
 * all. On Today you write ONE line, press return, and it settles into the
 * record while the field clears for the next one, and that exchange — words in,
 * reading out, field ready again — is the entire product. A person who finished
 * onboarding had been shown the components and not the thing.
 *
 * So this page is the page. Same title block, same dateline, same empty canvas
 * that is one big tap target, same composer with the rail that arrives with the
 * first card, same live read-out of the line being typed, same settling beat,
 * same cards with their rings and their ⋯, same long-press to see your own
 * words, same inline editor, same delete confirm.
 *
 * ## The four things that are NOT the same, and each has a reason
 *
 * 1. **The parse is `demoParseText`**, the offline grammar, never the edge
 *    function. This screen runs before there is a network call to make or an
 *    account to make it for — see `LiveLedger` and FINDINGS §21. It is also
 *    synchronous, which is why the reading beat below is timed rather than
 *    awaited.
 * 2. **Nothing is written to SQLite.** The record lives in `note` for the
 *    length of the screen and is handed up as an answer (`demoText`,
 *    `demoEntries`), which is what the later screens and the first-session seed
 *    read.
 * 3. **The ⋯ offers two of its four rows** — fix and delete. There is no
 *    history to look up and nowhere to keep a note yet, and a row that does
 *    nothing when tapped is worse than a shorter menu (`EntryActionsSheet.only`).
 *    "Fix" opens the inline editor rather than the correction sheet, which is
 *    the half of fixing that needs no store behind it: your own words, editable,
 *    re-read on return.
 * 4. **The page gutter is the funnel's 24, not Today's 16.** Today's 16 is
 *    UIKit's own layout margin, which its large title hangs off; this screen
 *    draws no navigation bar and sits under the flow's back circle and progress
 *    rail, which stand at 24. One left edge per screen beats matching a number
 *    whose reason is not present here.
 */

/** The reading is instant — the grammar is a regex, not a request — so the beat
 * the line spends being READ is the spec's, not the machine's: §3 asks for
 * "the structured reading resolves underneath row by row, ~120ms apart", and
 * `LiveLedger` has staggered on exactly this constant since August. It buys the
 * one moment the whole screen is for: the blue line passing under your own
 * words before the reading takes their place. */
const READ_BEAT_MS = READING_STEP_MS;

export interface DemoRecord {
  /** Every committed line, verbatim and newline-joined — the record (§3). */
  text: string;
  /** The readings that carry a load or reps, in the shape the later screens
   * expect. A reading with neither is the grammar echoing words back, and is
   * not stored as an answer. */
  entries: DemoEntry[];
}

export function DemoPage({
  /** The record as this screen was left, when somebody walks back into it. */
  initialText,
  /**
   * One quiet line under the dateline saying what to do — the flow's own
   * subline, standing where Today's weekly line stands.
   *
   * IT IS EARNED AWAY, not hidden and shown. It was tied to the keyboard first,
   * like Today's weekly line, and that was wrong twice over: it reflowed the
   * page every time the keyboard moved, and when it came back the page was
   * scrolled past its own title, so an instruction about writing sat alone
   * under the progress rail with no page around it. It now goes when the first
   * line settles and never returns — the same rule as the composer's example,
   * and the moment it goes is a moment the page is reflowing anyway.
   */
  instruction,
  /** How much the RESTING footer covers, so the last card can be scrolled
   * clear of it. The bar over the keyboard needs no number: it is a real
   * `InputAccessoryView`, so iOS puts it inside the keyboard frame and the
   * scroll view insets itself around both. */
  bottomInset,
  /** The `nativeID` of the screen's accessory bar. */
  accessoryViewID,
  /**
   * How much of the page is covered from the bottom while somebody is writing:
   * the keyboard's own reported height, which **includes the accessory bar**
   * because the bar is attached to the keyboard rather than floating over it.
   * One number, reported by the system — that is the whole reason the bar is an
   * `InputAccessoryView` (see the screen).
   */
  covered,
  /** Fires on every change to the record, committed lines only. */
  onRecord,
  /** Fires once per committed line with what the grammar made of it — the
   * screen's analytics, kept at the call site where the flow's other events
   * live. */
  onLineRead,
  inputRef,
}: {
  initialText: string;
  instruction: string;
  bottomInset: number;
  accessoryViewID: string;
  covered: number;
  onRecord: (record: DemoRecord) => void;
  onLineRead: (readings: number, source: 'typed' | 'example') => void;
  inputRef: React.RefObject<TextInput | null>;
}) {
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const viewH = useRef(0);

  /**
   * THE WHOLE PAGE IS ONE STRING, exactly as it is on Today: every line the
   * person has committed, newline-joined, with the line they are typing right
   * now as the last one. The cards are a projection of it and never the other
   * way round (CLAUDE.md §3) — which is also what makes "delete" a splice and
   * "edit" an in-place replacement, with no second model to keep in step.
   */
  const [note, setNote] = useState(() => (initialText ? `${initialText}\n` : ''));
  /** Rings the person has un-ticked. Keyed by the reading's own `doneKey`. */
  const [undone, setUndone] = useState<Set<string>>(new Set());
  /** Which card is showing the written words instead of the reading — one at a
   * time, so flipping a second card settles the first. */
  const [wordsKey, setWordsKey] = useState<string | null>(null);
  const [editingLine, setEditingLine] = useState<number | null>(null);
  /** The line that has just settled and is still being read — one beat, then
   * the card takes its place (see `READ_BEAT_MS`). */
  const [readingLine, setReadingLine] = useState<number | null>(null);
  const [actionsRow, setActionsRow] = useState<ReceiptRow | null>(null);
  const [actionsSiblings, setActionsSiblings] = useState<string[]>([]);
  const [actionsOpen, setActionsOpen] = useState(false);

  const lines = note.split('\n');
  const activeIndex = lines.length - 1;
  const activeValue = lines[activeIndex] ?? '';

  // The real receipt builder on the offline grammar's result. No signals: there
  // is no history to compare against, so the gutter stays silent rather than
  // labelled — exactly as it will on their real first day (`LiveLedger`).
  const receipt = useMemo(() => buildReceipt(demoParseText(note), []).rows, [note]);

  const rowsByLine = useMemo(() => {
    const m = new Map<number, ReceiptRow[]>();
    for (const r of receipt) {
      const list = m.get(r.line);
      if (list) list.push(r);
      else m.set(r.line, [r]);
    }
    return m;
  }, [receipt]);

  /** The record, and the answer made from it — committed lines only, so a
   * half-typed line is never stored as something the person wrote. */
  const committed = useMemo(() => lines.slice(0, activeIndex), [lines, activeIndex]);
  const committedText = useMemo(() => committed.join('\n').trim(), [committed]);

  useEffect(() => {
    const items = demoParseText(committedText).items;
    const entries = items
      .map((item) => demoEntryOfItem(item, committedText.split('\n')[item.line] ?? committedText))
      // A reading with no load and no reps is not a reading; it is the grammar
      // echoing the words back. Do not dress that up as an answer.
      .filter((e) => e.weightKg != null || e.reps.length > 0);
    onRecord({ text: committedText, entries });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committedText]);

  const focusInput = useCallback(() => inputRef.current?.focus(), [inputRef]);

  /** Where the line being written sits inside the page, measured. */
  const composerBox = useRef({ y: 0, h: 0 });
  /**
   * `covered` AS A REF, because everything else `revealComposer` reads is one.
   *
   * It is called from timers and from `requestAnimationFrame`, which hold the
   * function they were handed — so a value read straight off props is the value
   * as it was when that callback was created, and the callback that matters
   * most is created BEFORE the keyboard exists, when the answer is zero. The
   * page then computed a negative shortfall and scrolled nowhere, on exactly
   * the screen that needed it. Photographed, twice, on 10 September 2026.
   */
  const coveredRef = useRef(covered);
  useEffect(() => {
    coveredRef.current = covered;
  }, [covered]);

  /**
   * BRING THE LINE BEING WRITTEN BACK INTO VIEW — measured, not guessed.
   *
   * Today scrolls to the END of the page after a commit, guarded on the page
   * actually overflowing, and neither half of that works here. `scrollToEnd`
   * travels to the bottom of the CONTENT, which on a `flexGrow: 1` page is the
   * bottom of the frame plus its trailing padding — so on a page with one card
   * on it, it threw the title off the top. And the guard (content taller than
   * the frame) is never true on a short page, so the case that actually needs
   * help — two cards, the composer pushed down to exactly where the bar is —
   * got none. Both states were photographed on the simulator, 10 September 2026.
   *
   * So the composer measures itself and the page scrolls by the shortfall and
   * no further: the smallest offset that puts the bottom of the line, plus a
   * line of air, above whatever the keyboard is covering. With nothing covered
   * it computes a negative offset and does nothing, which is the right answer
   * for an empty page opening like a new note.
   */
  const revealComposer = (animated: boolean) => {
    const { y, h } = composerBox.current;
    const target = y + h + spacing.md - (viewH.current - coveredRef.current);
    if (target > 1) scrollRef.current?.scrollTo({ y: target, animated });
  };

  const setActive = (text: string) => setNote([...lines.slice(0, activeIndex), text].join('\n'));
  const setLineText = (i: number, text: string) =>
    setNote([...lines.slice(0, i), text, ...lines.slice(i + 1)].join('\n'));

  /** The committed line settles above; a fresh empty line becomes the input. */
  const commit = useCallback(() => {
    const value = activeValue.trim();
    if (!value) return;
    tap();
    const settledAt = activeIndex;
    setNote([...lines.slice(0, activeIndex), value, ''].join('\n'));
    setReadingLine(settledAt);
    onLineRead(demoParseText(value).items.filter((i) => i.sets.length > 0).length, 'typed');
    requestAnimationFrame(() => revealComposer(!reduceMotion));
  }, [activeValue, activeIndex, lines, onLineRead, reduceMotion]);

  /** One beat of being read, then the reading lands. Cleared on unmount so a
   * fast Continue cannot leave a timer pointing at a page that is gone. */
  useEffect(() => {
    if (readingLine === null) return;
    const t = setTimeout(() => setReadingLine(null), reduceMotion ? 0 : READ_BEAT_MS);
    return () => clearTimeout(t);
  }, [readingLine, reduceMotion]);

  /** The example writes itself into the line and settles, so the person sees
   * the same exchange they would have got by typing it. */
  const useExample = useCallback(() => {
    tap();
    const settledAt = activeIndex;
    setNote([...lines.slice(0, activeIndex), DEMO_EXAMPLE, ''].join('\n'));
    setReadingLine(settledAt);
    onLineRead(demoParseText(DEMO_EXAMPLE).items.length, 'example');
    inputRef.current?.blur();
  }, [activeIndex, lines, onLineRead, inputRef]);

  /**
   * DELETE ASKS FIRST, AND NAMES WHAT GOES — Today's own words, because it is
   * Today's own hazard: one written line can hold several readings ("bench 3x8,
   * rows 3x10" is one line and two cards) and the line is the only honest unit
   * to remove, so the person is told that before the finger commits.
   */
  const confirmDeleteLine = (
    line: number,
    entry: { exercise: string; alsoOnLine: string[] } | null,
  ) => {
    const what = entry
      ? entry.alsoOnLine.length > 0
        ? `“${entry.exercise}” shares one written line with ${joinNames(entry.alsoOnLine)}, so all of them go.`
        : `The line you wrote for “${entry.exercise}” is removed.`
      : 'The line you wrote is removed.';
    Alert.alert(
      entry ? 'Delete this entry?' : 'Delete this line?',
      `${what} This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            tapMedium();
            setEditingLine(null);
            setNote([...lines.slice(0, line), ...lines.slice(line + 1)].join('\n'));
          },
        },
      ],
    );
  };

  const runEntryAction = (action: EntryAction) => {
    const row = actionsRow;
    const siblings = actionsSiblings;
    setActionsRow(null);
    setActionsSiblings([]);
    if (!row) return;
    switch (action) {
      case 'fix':
        // The half of "fix this entry" that needs nothing behind it: the words
        // themselves, open for editing, re-read the moment they change. The
        // correction sheet — teaching the parser an alias — is store-backed and
        // is not offered here (see the header, difference 3).
        setEditingLine(row.line);
        break;
      case 'delete':
        confirmDeleteLine(row.line, {
          exercise: row.exercise,
          alsoOnLine: siblings,
        });
        break;
      default:
        break;
    }
  };

  // Every committed line becomes a block: the line under inline edit is an
  // input, a line still being read is pending, a parsed line is a card each,
  // and anything the grammar could not read stays as the quiet prose it is.
  const blocks: React.ReactNode[] = [];
  for (let i = 0; i < activeIndex; i++) {
    const raw = lines[i] ?? '';
    if (!raw.trim()) continue;
    const rows = rowsByLine.get(i);
    const line = i;
    if (i === editingLine) {
      blocks.push(
        <EditRow
          key={`edit:${i}`}
          value={raw}
          onChange={(t) => setLineText(line, t)}
          onDone={() => setEditingLine(null)}
          onDelete={() => confirmDeleteLine(line, null)}
          // The correction sheet is store-backed, so the link that opens it is
          // not drawn rather than drawn dead.
          onFix={null}
        />,
      );
    } else if (i === readingLine) {
      blocks.push(
        <PendingCard
          key={`p:${i}`}
          text={raw.trim()}
          order={0}
          reduceMotion={reduceMotion}
          onPress={() => {
            tap();
            setEditingLine(line);
          }}
        />,
      );
    } else if (rows && rows.length) {
      const alias = rows.length === 1 ? aliasEchoOf(raw, rows[0]!.exercise) : null;
      rows.forEach((row, j) => {
        const key = row.doneKey;
        const cardKey = `${i}:${j}:${row.exercise}`;
        blocks.push(
          <ExerciseCard
            // The demo ledger is a scripted replay, not a page anyone writes on:
            // there is no line to append a set to and nothing to re-parse.
            onAddSet={null}
            key={cardKey}
            row={row}
            order={i}
            done={!undone.has(key)}
            alias={alias}
            // There is nowhere to keep a remark about a lift before there is an
            // account, so the card never carries one here.
            note={null}
            rawLine={raw.trim()}
            showWords={wordsKey === cardKey}
            reduceMotion={reduceMotion}
            onToggle={() => {
              tap();
              setUndone((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              });
            }}
            onToggleWords={() => {
              tap();
              setWordsKey((k) => (k === cardKey ? null : cardKey));
            }}
            onEdit={() => {
              tap();
              setEditingLine(line);
            }}
            onActions={() => {
              tap();
              setActionsRow(row);
              setActionsSiblings(rows.filter((r) => r !== row).map((r) => r.exercise));
              setActionsOpen(true);
            }}
            // The echoed word is the auto-fix made visible, and tapping it goes
            // where the ⋯'s "fix" goes: your own words, editable.
            onFix={() => {
              tap();
              setEditingLine(line);
            }}
          />,
        );
      });
    } else {
      blocks.push(
        <NoteCard
          key={`n:${i}`}
          text={raw.trim()}
          onPress={() => {
            tap();
            setEditingLine(line);
          }}
        />,
      );
    }
  }

  /** Has this page produced a reading yet? Not "is the note empty" — the
   * furniture arrives with the record, never a beat before it. */
  const canvas = blocks.length === 0 && editingLine === null;
  const activeRows = rowsByLine.get(activeIndex) ?? null;

  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={styles.body}
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        // The frame has already paid the safe area at the top, and there is no
        // navigation bar here to hand the arithmetic to.
        contentInsetAdjustmentBehavior="never"
        // The keyboard is the scroll view's, on the UI thread, exactly as it is
        // on Today — never a listener plus a padded container.
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onLayout={(e) => {
          viewH.current = e.nativeEvent.layout.height;
        }}
        showsVerticalScrollIndicator={false}>
        {/* The whole page is the composer's tap target — a note is written on
            by touching it anywhere (Apple Notes), so the empty half below the
            line is never dead space. */}
        <Pressable style={styles.fill} onPress={focusInput}>
          {/* THE TITLE IS THE DAY, and the dateline says which day that is —
              Today's own two-line block. The title is `largeTitle` at the
              scale's own 700 rather than the funnel's 800: on every other
              screen the headline is a question in the flow's voice, and on this
              one it is a navigation bar's title being impersonated. */}
          <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Today
          </Text>
          <TodayDateline
            day={todayKey()}
            // Nobody has a session on record at this point in the flow, and
            // Today draws nothing at all in that case — zero is not a number
            // worth speaking (CLAUDE.md §9). The count's own sheet is
            // store-backed, and with no count there is nothing to open.
            sessionCount={0}
            onOpenStreak={() => {}}
          />
          {canvas ? (
            <Text style={styles.instruction} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {instruction}
            </Text>
          ) : null}

          {blocks}

          <View
            onLayout={(e: LayoutChangeEvent) => {
              composerBox.current = {
                y: e.nativeEvent.layout.y,
                h: e.nativeEvent.layout.height,
              };
            }}>
            <Composer
              inputRef={inputRef}
              value={activeValue}
              onChangeText={setActive}
              onSubmitEditing={commit}
              placeholder={canvas ? PLACEHOLDER : NEXT_PLACEHOLDER}
              canvas={canvas}
              afterRecord={blocks.length > 0}
              rows={activeRows}
              // The grammar answers in the same tick it is asked, so there is no
              // in-flight state under the cursor to draw. The reading beat this
              // screen does have belongs to the line that has just SETTLED, where
              // it is a light passing under words rather than under a cursor.
              pending={false}
              // "Same as last" reads a history, and there is none.
              prefill={null}
              // Today's own line of teaching, and here it is the tap target too —
              // one sentence doing the job the separate "Use this example" button
              // used to do beside it.
              hint={canvas ? `like “${DEMO_EXAMPLE}”` : null}
              onHintPress={useExample}
              inputAccessoryViewID={accessoryViewID}
              reduceMotion={reduceMotion}
            />
          </View>
        </Pressable>
      </ScrollView>

      <EntryActionsSheet
        visible={actionsOpen}
        target={actionsRow ? { exercise: actionsRow.exercise, setText: actionsRow.setText } : null}
        alsoOnLine={actionsSiblings}
        // Two of the four: there is no history to look up and nowhere to keep a
        // note until there is an account.
        only={DEMO_ACTIONS}
        onClose={() => setActionsOpen(false)}
        onSelect={runEntryAction}
      />
    </>
  );
}

/** Module-scope so it is one prop identity for the life of the app, not a fresh
 * array on every render of the page. */
const DEMO_ACTIONS: EntryAction[] = ['fix', 'delete'];

/** What the dateline will say — read here only so the screen can name the day
 * in its accessibility label without formatting a date of its own. */
export function demoDayLabel(): string {
  return longDayLabel(todayKey());
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  content: {
    // ONE LEFT EDGE. The funnel's gutter, which is where the back circle and
    // the progress rail above this page already stand (see the header note).
    paddingHorizontal: v2metrics.gutter,
    paddingTop: spacing.xxl,
    flexGrow: 1,
  },
  fill: { flex: 1 },
  /** Today's title, at the type scale's own large-title weight. */
  title: { ...type.largeTitle, color: v2color.ink },
  /**
   * THE FLOW'S SUBLINE, IN THE SLOT TODAY'S WEEKLY LINE OCCUPIES: under the
   * title block, above the record, gone while the keyboard is up.
   *
   * It is a step SMALLER than the dateline, for the reason the weekly line is:
   * three lines of the same size stacked under a large title read as a
   * paragraph, and the eye needs the title, the day and the aside to be three
   * different things. It is the app's own voice, so it is sans rather than the
   * weekly line's reading face.
   *
   * THE AIR BELOW BELONGS TO THIS LINE, NOT TO THE PAGE. Today opens with the
   * cursor hard against the dateline — "the empty page should open exactly like
   * a new note in Apple Notes" — and that is exactly what this page looks like
   * from the first settled card onwards, because this line is gone by then. The
   * gap exists only while the flow is still explaining itself.
   */
  instruction: {
    ...type.caption,
    color: v2color.inkSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
});
