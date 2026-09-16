import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  composeEntryNote,
  ENTRY_NOTE_PLACEHOLDER,
  ENTRY_NOTE_TAGS,
  entryNoteCharsLeft,
  entryNoteRoomFor,
  readEntryNote,
  splitEntryNote,
} from '@/lib/entry-note';
import { tap } from '@/lib/haptics';
import {
  color,
  hairline,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  type,
} from '@/lib/theme';
import { useSession } from '@/state/session-store';

import { BottomSheet } from './bottom-sheet';
import { EntrySheetHeader } from './entry-sheet-header';
import { PressableScale } from './motion';
import { AppButton, Eyebrow } from './primitives';

/**
 * The per-entry note sheet (owner, 4 August 2026) — where one recorded lift
 * gets a remark. Since 16 September 2026 it opens from the card's OWN glyph:
 * the ⋯ menu that used to stand in front of it is gone, and writing about a
 * lift is the only thing left that the card cannot do by itself.
 *
 * IT CARRIES ONE THING (owner, 12 August 2026): the note. Free text, stored in
 * the workout's own `entry_notes` column — prose about the entry, never inside
 * it, because appending "felt heavy" to the line would hand it to the parser
 * and a re-parse could rewrite or lose it.
 *
 * The effort scale used to lead this sheet and has moved to "Fix this entry",
 * where RIR is edited per SET rather than once for a whole line. Two controls
 * writing the same fact at different resolutions is how a record starts
 * disagreeing with itself.
 *
 * ## THE CHIPS ANSWER NOW, THEY DO NOT SUGGEST (16 September 2026)
 *
 * They were four placeholders: tapping one re-pointed the empty field's hint
 * and changed nothing else, so the sheet's whole answer to "what would I write
 * here?" was a blank box that rephrased its own question. The owner settled
 * this shape for the session reflection on 17 August — preset ANSWERS that
 * write, multi-select, stored as the reflection's first line — and this is the
 * same ruling one level down, where it matters more: a remark about ONE lift is
 * written on the gym floor, one-handed, between sets.
 *
 * `ENTRY_NOTE_TAGS` carries which five and why (one answer to each of the
 * spec'd prompts: how it felt, both ways; the form; the body; next time).
 * Nothing is preselected, the app never infers one from the record, every chip
 * is togglable off, and what an armed chip contributes is visible on the sheet
 * the whole time it is armed — the athlete still decides every word stored,
 * they just get five of them as buttons.
 *
 * NONE OF THEM IS A NUMBER. "Felt heavy" is prose Next quotes back beside the
 * lift; it is not RIR, it never reaches the engine, and it moves no load. That
 * boundary is what lets an answer about how a set felt live here at all,
 * alongside an effort scale that lives somewhere else.
 *
 * WHAT NEXT DOES WITH THE NOTE, stated on the sheet so nothing is implied: it
 * is QUOTED BACK beside that lift in the brief, verbatim, and never becomes a
 * number. A sentence about how a set felt is not evidence for a load, and
 * CLAUDE.md §2 rule 3 does not allow a model to turn it into one.
 *
 * Nothing here is required. Closing by any route — Save, backdrop, swipe —
 * keeps exactly what is on the sheet, and an emptied field with no chip armed
 * clears the note.
 */
export function EntryNoteSheet() {
  const target = useSession((s) => s.noteTarget);
  const close = useSession((s) => s.closeEntryNote);
  const entryNotes = useSession((s) => s.entryNotes);
  const saveEntryNote = useSession((s) => s.saveEntryNote);

  const [text, setText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  // What was stored when the sheet opened, so re-opening shows the note instead
  // of an empty field and a save that changed nothing writes nothing.
  const stored = useRef<string | null>(null);

  const exercise = target?.exercise ?? '';

  useEffect(() => {
    if (!target) return;
    const existing = readEntryNote(entryNotes, target.exercise);
    stored.current = existing;
    // Chips armed, words intact — one stored column, split back into the two
    // things the sheet holds.
    const { tags: armed, text: body } = splitEntryNote(existing);
    setTags(armed);
    setText(body);
    // Only when the sheet opens on an entry: `entryNotes` changes on every save
    // and re-running this would fight the field the athlete is typing in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.exercise, target?.line]);

  const charsLeft = entryNoteCharsLeft(text);

  const toggleTag = (t: string) => {
    tap();
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  /** Persist and close. Runs for Save, for the backdrop and for a swipe: all
   * three mean "keep what is on the sheet". */
  const commitAndClose = () => {
    const next = composeEntryNote(tags, text);
    if (target && next !== stored.current) {
      saveEntryNote(target.exercise, next);
      stored.current = next;
    }
    close();
  };

  /** Is there anything to keep? Drives the button's word only — "Done" on a
   * sheet that was opened and left alone, "Save" the moment there is something
   * on it, including a note that is about to be CLEARED. */
  const hasAnswer = tags.length > 0 || text.trim().length > 0 || stored.current !== null;

  return (
    <BottomSheet
      visible={target !== null}
      onClose={commitAndClose}
      sheetStyle={[styles.sheet, { paddingBottom: spacing.lg }]}>
      {/* The head is also a way down: the note below is MULTILINE, so its
          return key writes a newline instead of finishing. Not a control to
          VoiceOver — the three lines stay three readable lines. */}
      <Pressable accessible={false} onPress={Keyboard.dismiss}>
        {/* WHICH ENTRY, AND WHAT IT DID. The signal travels from the card now
            that the ⋯ sheet which used to carry it is gone, so the header keeps
            the PR label and the "up 2.5 kg vs last" line — the context that
            makes a person have something to say. No `note` is passed on
            purpose: the field below is about to show those exact words, and a
            header quoting the paragraph beneath it is an echo, not context. */}
        <EntrySheetHeader
          eyebrow="This entry"
          exercise={exercise}
          setText={target?.setText}
          signal={target?.signal ?? null}
        />
      </Pressable>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Eyebrow tone="secondary">How it went</Eyebrow>

          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            // The chips write into the same 300 characters the field does, so
            // an armed chip costs the field its own length (`entryNoteRoomFor`).
            maxLength={entryNoteRoomFor(tags)}
            placeholder={ENTRY_NOTE_PLACEHOLDER}
            placeholderTextColor={color.textMuted}
            selectionColor={color.brand}
            cursorColor={color.brand}
            accessibilityLabel={`Your note on ${exercise}. Optional.`}
            style={styles.input}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />

          {/* Preset answers, multi-select. What they contribute is stored as
              the note's own first line — the athlete's chosen words. */}
          <View style={styles.tags}>
            {ENTRY_NOTE_TAGS.map((t) => {
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
              and its own chips: the chips write into the same note the field
              does, and a line of grey between them would read as the end of one
              thing and the start of another. It is also the one sentence on the
              sheet that is a FACT about the app rather than an invitation —
              what Next does with these words, and what it will never do. */}
          <Text style={styles.hint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            optional, in any language · quoted back in your next brief, never turned into a number
          </Text>

          {charsLeft != null ? (
            <Text style={styles.counter} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {`${charsLeft} characters left`}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <AppButton label={hasAnswer ? 'Save' : 'Done'} onPress={commitAndClose} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: color.surface,
    paddingHorizontal: spacing.xl,
    maxHeight: '86%',
  },
  scroll: {
    marginTop: spacing.lg,
  },
  scrollContent: {
    gap: spacing.xl,
    paddingBottom: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },

  // (The effort scale's seven styles were deleted on 20 August 2026. The
  // control itself moved to "Fix this entry" on 12 August — RIR is per SET —
  // and the styling it left behind was a component's worth of dead geometry
  // that the next reader would have taken for a control still on this sheet.)

  // --- the note ---
  input: {
    minHeight: moderateScale(84),
    borderWidth: 1,
    borderColor: color.border,
    // A FIELD, so `radius.lg` 20 (skill §Spacing) — `md` 14 is a button's.
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: color.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    textAlignVertical: 'top',
    ...type.subhead,
    lineHeight: lineFor(22),
    color: color.textPrimary,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  /**
   * THE CHECK-IN'S CHIP, ONE SCALE DOWN.
   *
   * Same two states and the same reasoning: a recessed `surfaceHigh` track at
   * rest (a chip on `surface` inside a `surface` sheet is an outline of a
   * control, not a control) and THE ONE BLUE when armed. What is different is
   * only the geometry — 36 and `md` against the check-in's 40 and `lg` —
   * because there are five of these about one lift where the session gets
   * three about a whole day, and at the larger size they ran to three rows on
   * a 390 pt screen. Two rows, and the sheet still opens under the thumb.
   *
   * An armed chip is FILLED, which reverses this sheet's own older note ("a
   * suggestion never takes the filled state a real selection has"). That
   * reasoning ended the moment a tap started writing words into the record.
   */
  tag: {
    minHeight: moderateScale(36),
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
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
  hint: {
    ...type.caption,
    lineHeight: lineFor(16),
    color: color.textMuted,
  },
  counter: {
    ...type.caption,
    color: color.textMuted,
    textAlign: 'right',
  },
  footer: {
    marginTop: spacing.lg,
  },
});
