import { useMemo, useRef } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { toCardSet } from '@/lib/card-view';
import { tap } from '@/lib/haptics';
import { type ParsedItem } from '@/lib/parse/types';
import {
  MAX_FONT_SCALE,
  hairline,
  makeStyles,
  moderateScale,
  radius,
  space,
  spacing,
  type,
  useTheme,
} from '@/lib/theme';
import { useCurrentNote, useSession } from '@/state/session-store';

import { ExerciseCard, type CardItem } from './exercise-card';
import { READING_ARC, ReadingArc } from './motion';
import { noteInputRef, noteScrollRef } from './note-focus';
import { TodayEmpty } from './today-empty';

/**
 * The composer (CLAUDE.md §8.1–§8.2, PLAN.md 1.15).
 *
 * One scroll view holding, in this order: the settled cards, the card currently
 * being read, and the live line with the cursor — which is always the last
 * element and always sits just above the accessory bar.
 *
 * What survives from v2 is the behaviour that works: **return commits**, the
 * line settles above, the field clears, the cursor stays, and the user can keep
 * typing while a parse is in flight. What is replaced is all of the chrome —
 * the rail, the check circles, the right gutter, the inline edit rows.
 *
 * Three invariants this file must never break:
 *
 * · **`raw_text` is the record** (§4.3). Cards are a projection of it. Nothing
 *   here rewrites, tidies or discards a committed line, and swiping a card away
 *   strikes its line rather than deleting it.
 * · **A line we cannot read gets no error** (§4.4). No red underline, no warning
 *   icon, no toast. It is saved, it stays saved, and the app says nothing.
 * · **Nothing waits on the network** (§4.2). Every keystroke is in SQLite in the
 *   same frame; the parse is allowed to be late and never allowed to be in the
 *   way.
 *
 * The writing surface has **no radius, no border and no fill** (§6.7): it is a
 * page, not a widget, and that single absence is what keeps Today from reading
 * as a chat app.
 */

/** §8.2 — an example, not an instruction. */
const PLACEHOLDER = 'bench 3x8 80';

export function Composer() {
  const styles = useStyles();
  const t = useTheme();
  const reduceMotion = useReducedMotion();

  const note = useCurrentNote();
  const setNote = useSession((s) => s.setNote);
  const parsing = useSession((s) => s.parsing);
  const parsedSnapshot = useSession((s) => s.parsedSnapshot);
  const parsedItems = useSession((s) => s.parsedItems);
  const openExerciseSheet = useSession((s) => s.openExerciseSheet);
  const openFixSheet = useSession((s) => s.openFixSheet);
  const deleteNoteLine = useSession((s) => s.deleteNoteLine);

  const lines = note.split('\n');
  const activeIndex = lines.length - 1;
  const activeValue = lines[activeIndex] ?? '';
  const empty = note.trim().length === 0;
  const snapshotLines = useMemo(() => (parsedSnapshot ?? '').split('\n'), [parsedSnapshot]);

  // A line's parse counts only while its text is unchanged since that parse —
  // an edited line goes back to "reading" until the next result lands (§9.1's
  // stale guard, on the display side).
  const fresh = (i: number) => parsedSnapshot !== null && lines[i] === snapshotLines[i];

  /** Items grouped by the physical line they were read from. */
  const byLine = useMemo(() => {
    const m = new Map<number, ParsedItem[]>();
    for (const item of parsedItems) {
      const list = m.get(item.line);
      if (list) list.push(item);
      else m.set(item.line, [item]);
    }
    return m;
  }, [parsedItems]);

  // The arc beside the line being written. Gated on `parsing` rather than on
  // "text the parser hasn't seen yet": the latter lights up on the first
  // keystroke and burns through the whole 450ms debounce, which is an indicator
  // reporting a wait that has not started. It turns when the request is out.
  const activeReading = parsing && activeValue.trim().length > 0;

  const settled = useRef(0);
  settled.current = 0;

  const setActive = (text: string) => setNote([...lines.slice(0, activeIndex), text].join('\n'));

  const commit = () => {
    const value = activeValue.trim();
    if (!value) return;
    tap();
    // The committed line settles above; a fresh empty line becomes the input.
    setNote([...lines.slice(0, activeIndex), value, ''].join('\n'));
    requestAnimationFrame(() => noteScrollRef.current?.scrollToEnd({ animated: !reduceMotion }));
  };

  const blocks: React.ReactNode[] = [];
  for (let i = 0; i < activeIndex; i++) {
    const raw = lines[i] ?? '';
    if (!raw.trim()) continue;

    const items = fresh(i) ? byLine.get(i) : undefined;
    if (items?.length) {
      // Several items on one line are several cards, EXCEPT a superset — which
      // §8.3 says is two names sharing one card with a rule between them.
      for (const group of groupSupersets(items)) {
        const index = settled.current++;
        blocks.push(
          <ExerciseCard
            key={`${i}:${group.map((g) => g.exercise).join('+')}`}
            index={index}
            items={group.map((item) => toCardItem(item, raw))}
            onOpenLift={(card) => openExerciseSheet(card.name, i)}
            onRepair={() => openFixSheet(i)}
            onDelete={() => deleteNoteLine(i)}
          />,
        );
      }
      continue;
    }

    // In flight, or a line we could not read. The card is identical either way —
    // the app never distinguishes "still working" from "nothing to say" with an
    // error (§4.4). The only difference is the arc, which turns while the parse
    // is out and simply stops being there once it settles.
    const line = i;
    blocks.push(
      <Pressable
        key={`r:${i}`}
        style={styles.reading}
        onPress={() => {
          tap();
          openFixSheet(line);
        }}
        accessibilityRole="button"
        accessibilityLabel={raw.trim()}>
        <Text style={styles.readingText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {raw.trim()}
        </Text>
        {/* Pinned to the first row of the text, so a line that wraps does not
            drag the arc down the card with it. */}
        <View style={styles.readingSlot}>{parsing ? <ReadingArc /> : null}</View>
      </Pressable>,
    );
  }

  return (
    <ScrollView
      ref={noteScrollRef}
      style={styles.body}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}>
      {/* Tapping the empty page returns the cursor — the keyboard is the
          interface (§4.1), so it is never more than one tap away. */}
      <Pressable style={styles.fill} onPress={() => noteInputRef.current?.focus()}>
        {empty ? <TodayEmpty onPick={(name) => setActive(name)} /> : null}

        {blocks}

        {/* The live line. Always last, always just above the accessory bar.
            The arc's slot is ALWAYS occupied, so its arrival and departure never
            reflow a character under the cursor — a writing surface that shifts
            mid-keystroke is worse than no indicator at all. */}
        <View style={styles.inputRow}>
          <TextInput
            ref={noteInputRef}
            style={styles.input}
            value={activeValue}
            onChangeText={setActive}
            onSubmitEditing={commit}
            blurOnSubmit={false}
            returnKeyType="next"
            placeholder={empty ? PLACEHOLDER : undefined}
            placeholderTextColor={t.inkFaint}
            selectionColor={t.ink}
            cursorColor={t.ink}
            keyboardAppearance={t.scheme}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            allowFontScaling
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            accessibilityLabel="Write your training"
          />
          <View style={styles.readingSlot}>{activeReading ? <ReadingArc /> : null}</View>
        </View>
      </Pressable>
    </ScrollView>
  );
}

/**
 * A superset is a shared `group_key` (§18.2) — two items, or ten, it is the same
 * schema. Items without one stand alone.
 */
function groupSupersets(items: ParsedItem[]): ParsedItem[][] {
  const groups: ParsedItem[][] = [];
  const byKey = new Map<string, ParsedItem[]>();
  for (const item of items) {
    if (!item.group_key) {
      groups.push([item]);
      continue;
    }
    const existing = byKey.get(item.group_key);
    if (existing) existing.push(item);
    else {
      const group = [item];
      byKey.set(item.group_key, group);
      groups.push(group);
    }
  }
  return groups;
}

/**
 * The alias echo (§9.6): the user's own word, kept beside the resolved name so
 * an auto-fix is never invisible. Only shown when it differs — echoing "bench"
 * next to "Bench Press" is noise, echoing "tricpes" next to "Triceps Pushdown"
 * is the whole point.
 */
function toCardItem(item: ParsedItem, rawLine: string): CardItem {
  const typed = item.aliases_seen[0] ?? null;
  const canonical = item.exercise.toLowerCase();
  const alias = typed && !canonical.includes(typed) && rawLine.toLowerCase().includes(typed) ? typed : null;
  return {
    name: item.exercise,
    alias,
    modality: item.modality,
    sets: item.sets.map(toCardSet),
  };
}

const useStyles = makeStyles((t) => ({
  body: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: space[9],
    // §6.6 — cards in a session sit close enough to read as one session.
    gap: spacing.md,
  },
  fill: {
    flex: 1,
    gap: spacing.md,
  },
  reading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: hairline,
    borderColor: t.rule,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  readingText: {
    ...type.body,
    flex: 1,
    color: t.inkMuted,
  },
  // The arc's column, right of the written line. Fixed width in both places so
  // the indicator's arrival never moves a character of the record.
  readingSlot: {
    width: READING_ARC + spacing.md,
    height: type.body.lineHeight,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    ...type.body,
    flex: 1,
    color: t.ink,
    // No radius, no border, no fill (§6.7). The page is the widget.
    padding: 0,
    minHeight: moderateScale(28),
  },
}));
