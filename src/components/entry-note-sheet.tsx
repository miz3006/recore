import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ENTRY_NOTE_PLACEHOLDER,
  ENTRY_NOTE_PROMPTS,
  entryNoteCharsLeft,
  MAX_ENTRY_NOTE_CHARS,
  normalizeEntryNote,
  readEntryNote,
} from '@/lib/entry-note';
import { tap } from '@/lib/haptics';
import {
  color,
  hairline,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  monoText,
  radius,
  spacing,
  type,
} from '@/lib/theme';
import { useSession } from '@/state/session-store';

import { BottomSheet } from './bottom-sheet';
import { PressableScale } from './motion';
import { AppButton, Eyebrow } from './primitives';

/**
 * The per-entry note sheet (owner, 4 August 2026) — opened from a ledger card's
 * ⋯ menu, it is where one recorded lift gets a remark. (Until 11 August it had
 * a permanent speech bubble on every card; the standing invitation to write
 * moved to one row under the ledger at session end, and this stayed as a named
 * action for the lift that genuinely deserves a note.)
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
 * WHAT NEXT DOES WITH THE NOTE, stated on the sheet so nothing is implied: it
 * is QUOTED BACK beside that lift in the brief, verbatim, and never becomes a
 * number. A sentence about how a set felt is not evidence for a load, and
 * CLAUDE.md §2 rule 3 does not allow a model to turn it into one.
 *
 * THE PROMPTS ARE PLACEHOLDERS, NEVER INSERTED TEXT (§8.1's rule): tapping one
 * changes what the empty field suggests and nothing else, so every character
 * stored is a character the athlete typed.
 *
 * Nothing here is required. Closing by any route — Save, backdrop, swipe —
 * keeps exactly what is in the field, and an emptied field clears the note.
 */
export function EntryNoteSheet() {
  const target = useSession((s) => s.noteTarget);
  const close = useSession((s) => s.closeEntryNote);
  const entryNotes = useSession((s) => s.entryNotes);
  const saveEntryNote = useSession((s) => s.saveEntryNote);
  const insets = useSafeAreaInsets();

  const [text, setText] = useState('');
  const [placeholder, setPlaceholder] = useState(ENTRY_NOTE_PLACEHOLDER);
  // What was stored when the sheet opened, so re-opening shows the note instead
  // of an empty field and a save that changed nothing writes nothing.
  const stored = useRef<string | null>(null);

  const exercise = target?.exercise ?? '';

  useEffect(() => {
    if (!target) return;
    const existing = readEntryNote(entryNotes, target.exercise);
    stored.current = existing;
    setText(existing ?? '');
    setPlaceholder(ENTRY_NOTE_PLACEHOLDER);
    // Only when the sheet opens on an entry: `entryNotes` changes on every save
    // and re-running this would fight the field the athlete is typing in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.exercise, target?.line]);

  const charsLeft = entryNoteCharsLeft(text);

  /** Persist and close. Runs for Save, for the backdrop and for a swipe: all
   * three mean "keep what is in the field". */
  const commitAndClose = () => {
    const next = normalizeEntryNote(text);
    if (target && next !== stored.current) {
      saveEntryNote(target.exercise, next);
      stored.current = next;
    }
    close();
  };

  return (
    <BottomSheet
      visible={target !== null}
      onClose={commitAndClose}
      sheetStyle={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
      <Eyebrow tone="muted" style={styles.eyebrow}>
        This entry
      </Eyebrow>
      <Text style={styles.title} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {exercise}
      </Text>
      {target?.setText ? (
        <Text style={styles.sets} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {target.setText}
        </Text>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* THE WORDS, AND ONLY THE WORDS (owner, 12 Aug 2026).
            The effort scale used to lead this sheet. It moved out, not away:
            reps-in-reserve is per-SET, and Fix this entry now edits RIR on each
            set individually — a single sheet-wide "how hard was it?" could only
            ever write one marker for the whole line, so keeping both meant two
            controls writing the same fact at different resolutions. The scale
            still exists on the end-of-session check-in, where one answer for
            the whole session is what is being asked. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Your note
          </Text>
          <Text style={styles.sectionSub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Optional, in any language. Recore keeps it with this entry and reads it back to you in
            your next brief — it never turns it into a number.
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            maxLength={MAX_ENTRY_NOTE_CHARS}
            placeholder={placeholder}
            placeholderTextColor={color.textMuted}
            selectionColor={color.accent}
            cursorColor={color.accent}
            accessibilityLabel={`Your note on ${exercise}. Optional.`}
            style={styles.input}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />
          <View style={styles.prompts}>
            {ENTRY_NOTE_PROMPTS.map((p) => (
              <PressableScale
                key={p}
                onPress={() => {
                  tap();
                  // Suggests, never writes. The field keeps whatever was typed.
                  setPlaceholder(p);
                }}
                haptic="none"
                activeScale={0.96}
                accessibilityRole="button"
                accessibilityLabel={`Suggest: ${p}`}
                accessibilityState={{ selected: placeholder === p }}
                style={[styles.prompt, placeholder === p && styles.promptOn]}
                pressedStyle={styles.pressed}>
                <Text
                  style={[styles.promptText, placeholder === p && styles.promptTextOn]}
                  maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {p}
                </Text>
              </PressableScale>
            ))}
          </View>
          {charsLeft != null ? (
            <Text style={styles.counter} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {`${charsLeft} characters left`}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <AppButton
          label={text.trim().length > 0 || stored.current !== null ? 'Save' : 'Done'}
          onPress={commitAndClose}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: color.bg,
    paddingHorizontal: spacing.xl,
    maxHeight: '86%',
  },
  eyebrow: {
    marginTop: spacing.sm,
  },
  title: {
    marginTop: spacing.xs,
    ...type.title,
    color: color.textPrimary,
  },
  sets: {
    marginTop: spacing.xs,
    ...monoText,
    fontSize: moderateScale(13),
    color: color.textSecondary,
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
  sectionTitle: {
    ...type.subhead,
    fontWeight: '600',
    color: color.textPrimary,
  },
  sectionSub: {
    ...type.footnote,
    lineHeight: lineFor(17),
    color: color.textMuted,
  },

  // --- effort ---
  scale: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
  },
  level: {
    flex: 1,
    minHeight: moderateScale(56),
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: hairline,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  // Selected = ink fill, exactly like every other committed state in the app.
  levelOn: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  pressed: {
    backgroundColor: color.surfaceHigh,
  },
  levelLabel: {
    ...type.caption,
    fontWeight: '600',
    color: color.textPrimary,
  },
  levelLabelOn: {
    color: color.bg,
  },
  levelHint: {
    fontSize: moderateScale(9.5),
    lineHeight: lineFor(12),
    textAlign: 'center',
    color: color.textMuted,
  },
  levelHintOn: {
    color: color.bg,
    opacity: 0.72,
  },

  // --- the note ---
  input: {
    minHeight: moderateScale(84),
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    textAlignVertical: 'top',
    ...type.subhead,
    lineHeight: lineFor(22),
    color: color.textPrimary,
  },
  prompts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  prompt: {
    minHeight: moderateScale(34),
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: hairline,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  // Ink outline when chosen — a suggestion never takes the filled state a real
  // selection has.
  promptOn: {
    borderColor: color.accent,
  },
  promptText: {
    ...type.caption,
    color: color.textSecondary,
  },
  promptTextOn: {
    color: color.textPrimary,
    fontWeight: '600',
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
