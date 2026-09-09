import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { searchExercises } from '@/lib/db/exercises';
import { tap, tapMedium } from '@/lib/haptics';
import { typedNameOf } from '@/lib/parse/receipt';
import { MAX_RIR, MIN_RIR, type ParsedSet } from '@/lib/parse/types';
import { getWeightUnit } from '@/lib/prefs';
import {
  color,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  spacing,
  textRoom,
  type,
} from '@/lib/theme';
import {
  displayWeightText,
  REPS_STEP,
  RIR_STEP,
  sameDisplay,
  toKg,
  WEIGHT_STEP,
  type WeightUnit,
} from '@/lib/units';
import { useSession } from '@/state/session-store';

import { BottomSheet } from './bottom-sheet';
import { Icon } from './icon';
import { DONE_ACCESSORY, KeyboardDoneBar } from './keyboard-done';
import { PressableScale } from './motion';
import { AppButton, Eyebrow } from './primitives';

/**
 * "Fix reading" (wireframe 10): fix what the parser got wrong,
 * deterministically. The user's quoted words sit untouched in a bg-inset mono
 * card; the fields below are 48pt rows; the sheet states plainly what the fix
 * will do — nothing but this line when only numbers moved, the alias scope the
 * moment the exercise name differs (that IS the existing
 * correction-vs-alias-override logic in parse/correct.ts, surfaced honestly).
 * Quiet monochrome form — a fix is routine bookkeeping, not an error state.
 *
 * ## The 11 August 2026 pass (owner)
 *
 * 1. **One canonical column order: weight, then reps.** The athlete writes
 *    "100x12" and the ledger card prints KG before REPS; this sheet alone read
 *    reps × weight, so repairing a load meant re-mapping the row in your head
 *    against the very line quoted two inches above it. Every set row now reads
 *    SET → weight → × → reps → RIR, left to right, top to bottom.
 * 2. **One control, three times.** Weight had steppers, reps was a bare field
 *    and RIR was a lone "−" glyph with nothing to subtract from. All three are
 *    now the same thing: a tappable mono value with − / + on either side.
 * 3. **The set list is editable.** A missed set is added ("+ Add set", carrying
 *    the previous set's numbers forward), and a reading the parser invented
 *    outright can be removed entirely — see `removeReading` below for why that
 *    does not touch a single character of what the athlete wrote.
 * 4. **The alias offer is conditional.** It only exists once the Exercise field
 *    has actually changed, with the real target named. Fixing a weight never
 *    again shows a control asking about a word. (Rewritten 4 September 2026 —
 *    see the "Remember this" row below for what replaced the radio pair and
 *    why the old one was answering nothing.)
 *
 * ## The 20 August 2026 pass — THE READING IS A READING AGAIN (owner)
 *
 * The sheet had become a spreadsheet. Every set arrived as an open form — three
 * steppers, nine bordered boxes, each on a recessed grey card — so a three-set
 * line put twenty-one controls on screen before the athlete had touched
 * anything, and finding the ONE wrong number meant reading a grid of identical
 * boxes against the quoted line two inches above it.
 *
 * 1. **A set is a bare row, and becomes a form where the finger lands.** The
 *    list now prints the reading the way the ledger card prints it, in the same
 *    reading face, and exactly one row at a time opens into the steppers. That
 *    is design skill §Structure taken literally: the record is bare rows, the
 *    chrome floats, and a screen that is mostly canvas is finished. A
 *    single-set reading opens expanded — there is nothing to scan.
 * 2. **No recessed grey.** `surfaceHigh` is the skill's *recessed* tone, for
 *    segmented containers and pressed states, and it is measurably the wrong
 *    ground for text: `textSecondary` lands at ~4.0:1 on it and `textMuted`
 *    lower still, so the SET labels and every `kg` / `reps` / `RIR` on those
 *    cards failed AA. The open row is `surface` carrying a `border`.
 * 3. **The sheet names its entry.** Eyebrow + exercise name, the same header
 *    the ⋯ sheet and the note sheet wear, so the three per-entry surfaces open
 *    as one family instead of three designs.
 * 4. **One button, and it is the app's button.** `AppButton` primary — brand
 *    fill, `shadow.glow`, `CTA_HEIGHT` — instead of a bespoke pill. Cancel is
 *    gone: it was a fourth way out of a sheet that already dismisses on the
 *    backdrop, on a downward drag and on the grabber, and it cost a full-width
 *    slab of the one screen where the content is the point.
 *
 * UNITS. Storage is kilograms everywhere (`lib/units.ts`); this is the first
 * surface to show a pound-user their own pounds, which is also the first place
 * a conversion could forge a correction the athlete never made. The drafts keep
 * the ORIGINAL kilograms beside the shown text, and `setOf` converts back only
 * for a field whose text actually changed.
 */

interface SetDraft {
  kind: ParsedSet['kind'];
  parent: number | null;
  reps: string;
  /** The load in the USER'S unit, as text. `weightKg`/`weight0` guard it. */
  weight: string;
  /** The stored kilograms this row opened with — returned verbatim when the
   * text was never edited, so a lb round-trip can't rewrite the record. */
  weightKg: number | null;
  /** `weight` as it was rendered on open, for that same comparison. */
  weight0: string;
  rir: string;
  distance: string;
  duration: string;
  /** Which inputs this row shows, decided once from the original set. */
  mode: 'strength' | 'distance' | 'duration';
  /** The parsed inline comment, carried through untouched. This sheet corrects
   * NUMBERS; fixing a weight must not silently delete what the athlete wrote
   * about the set. It is not editable here — the words live in raw_text, so the
   * place to change them is the line itself. */
  note: string | null;
}

const str = (n: number | null): string => (n == null ? '' : String(n));

const toInt = (s: string, max: number, min = 0): number | null => {
  const n = Number.parseInt(s.replace(',', '.'), 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
};

const toNum = (s: string, max: number, min = 0): number | null => {
  const n = Number.parseFloat(s.replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.min(max, Math.max(min, n)) * 100) / 100;
};

/** Same normalization as parse/correct.ts — the scope display must agree with
 * what applyCorrection will actually decide. */
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function draftOf(set: ParsedSet, unit: WeightUnit): SetDraft {
  const weight = displayWeightText(set.weight_kg, unit);
  return {
    kind: set.kind,
    parent: set.parent,
    reps: str(set.reps),
    weight,
    weightKg: set.weight_kg,
    weight0: weight,
    rir: str(set.rir),
    distance: str(set.distance_m),
    duration: str(set.duration_s),
    mode: set.distance_m != null ? 'distance' : set.duration_s != null ? 'duration' : 'strength',
    note: set.note,
  };
}

/** The shown load back in kilograms — verbatim when the field was untouched. */
function weightKgOf(d: SetDraft, unit: WeightUnit): number | null {
  if (sameDisplay(d.weight, d.weight0)) return d.weightKg;
  const shown = toNum(d.weight, Number.MAX_SAFE_INTEGER);
  // The 2000 kg ceiling is the parser's own (`validateParseResult`), applied
  // after the conversion so it means the same thing in either unit.
  return shown == null ? null : Math.min(2000, toKg(shown, unit));
}

function setOf(d: SetDraft, unit: WeightUnit): ParsedSet {
  return {
    kind: d.kind,
    parent: d.parent,
    reps: d.mode === 'strength' ? toInt(d.reps, 1000) : null,
    weight_kg: d.mode === 'strength' ? weightKgOf(d, unit) : null,
    distance_m: d.mode === 'distance' ? toNum(d.distance, 1_000_000) : null,
    duration_s: d.mode === 'duration' ? toInt(d.duration, 86_400) : null,
    rir: d.mode === 'strength' ? toNum(d.rir, MAX_RIR, MIN_RIR) : null,
    note: d.note,
  };
}

export function FixSheet() {
  const userId = useSession((s) => s.userId);
  const fixTarget = useSession((s) => s.fixTarget);
  const closeFixSheet = useSession((s) => s.closeFixSheet);
  const submitFix = useSession((s) => s.submitFix);
  const removeReading = useSession((s) => s.removeReading);
  const replaceNoteLine = useSession((s) => s.replaceNoteLine);

  // Read once per opened sheet: the unit is a preference, not live state, and
  // re-reading it mid-edit could re-scale a field under the user's finger.
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [exercise, setExercise] = useState('');
  const [drafts, setDrafts] = useState<SetDraft[]>([]);
  /**
   * WHICH SET IS OPEN, and at most one.
   *
   * The closed rows are the reading; the open one is the form. Holding a single
   * index rather than a set of them is the rule, not an optimisation: two open
   * forms would put the athlete back in front of a grid, which is the thing
   * this replaced.
   */
  const [openSet, setOpenSet] = useState<number | null>(null);
  /**
   * TEACH THE PARSER THIS WORD — on by default, and only ever asked once the
   * exercise itself has changed.
   *
   * Defaulting to ON is the point of the flywheel: the common case by a long
   * way is "you read my word wrong", and a person who has just corrected it
   * should not have to opt into never doing it again. The case the toggle
   * exists for is the rarer one — a typo they fixed on this line and nowhere
   * else — and turning it off leaves this line corrected while every other
   * note keeps reading the way it did.
   */
  const [remember, setRemember] = useState(true);
  const exerciseRef = useRef<TextInput>(null);

  /**
   * WORDS MODE — the other half of "this is not what I did".
   *
   * The sheet corrects the READING by default. Sometimes the reading is a
   * faithful account of a line that was mistyped, and then no amount of
   * stepper-tapping is the fix: the words are wrong, and the words are the
   * record (§3). Switching here edits the line itself, and saving sends it
   * through `setNote` — so the parser re-reads it exactly as if it had just
   * been typed, and the corrected text IS the new written source.
   */
  const [wordsMode, setWordsMode] = useState(false);
  const [words, setWords] = useState('');
  const wordsRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!fixTarget) return;
    const u = getWeightUnit() ?? 'kg';
    setUnit(u);
    setExercise(fixTarget.item.exercise);
    setDrafts(fixTarget.item.sets.map((s) => draftOf(s, u)));
    // One set has no list to scan, so the row that would be tapped first opens
    // itself. Two or more and the reading leads — you look before you edit.
    setOpenSet(fixTarget.item.sets.length === 1 ? 0 : null);
    setRemember(true);
    setWordsMode(false);
    // Prefilled from the note as it stands, not from the parse snapshot: the
    // athlete edits the line that is on their screen right now.
    const current = useSession.getState().note.split('\n')[fixTarget.line];
    setWords((current ?? fixTarget.lineText).trim());
  }, [fixTarget]);

  const toggleWordsMode = () => {
    tap();
    setWordsMode((on) => {
      if (!on) requestAnimationFrame(() => wordsRef.current?.focus());
      return !on;
    });
  };

  const saveWords = () => {
    if (!fixTarget) return;
    // No `tap()` here: `AppButton` fires the commit haptic itself, and two on
    // one press reads as a stutter.
    replaceNoteLine(fixTarget.line, words);
  };

  const suggestions = useMemo(() => {
    if (!userId || !fixTarget) return [];
    return searchExercises(userId, exercise).map((e) => e.canonical);
  }, [userId, fixTarget, exercise]);

  const close = () => {
    tap();
    closeFixSheet();
  };

  const save = () => {
    submitFix(
      exercise,
      drafts.map((d) => setOf(d, unit)),
      // A phrase-less line was never offered the choice, so it must not carry
      // a silent yes into the store.
      canRemember && remember,
    );
  };

  const patchDraft = (index: number, patch: Partial<SetDraft>) =>
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  /**
   * − / + on any of the three values. An EMPTY field is not zero — it is "the
   * parser read nothing here" — so the first press establishes the value at the
   * floor rather than stepping away from a number that was never there. That is
   * what makes "+" a working answer to an empty RIR.
   */
  const step = (
    index: number,
    field: 'weight' | 'reps' | 'rir',
    dir: 1 | -1,
  ) => {
    tap();
    const d = drafts[index];
    if (!d) return;
    if (field === 'weight') {
      const current = toNum(d.weight, Number.MAX_SAFE_INTEGER);
      const next =
        current == null ? 0 : Math.max(0, Math.round((current + dir * WEIGHT_STEP) * 100) / 100);
      patchDraft(index, { weight: String(next) });
      return;
    }
    if (field === 'reps') {
      const current = toInt(d.reps, 1000);
      const next = current == null ? 0 : Math.max(0, Math.min(1000, current + dir * REPS_STEP));
      patchDraft(index, { reps: String(next) });
      return;
    }
    const current = toNum(d.rir, MAX_RIR, MIN_RIR);
    const next =
      current == null ? 0 : Math.max(MIN_RIR, Math.min(MAX_RIR, current + dir * RIR_STEP));
    patchDraft(index, { rir: String(next) });
  };

  /** A missed set, carrying the previous set's numbers forward — the common
   * case is "I did that again". It is a WORKING set whatever the row above was
   * (a second warm-up is worth typing), and it never inherits the note: those
   * are the athlete's words about a set they actually wrote. */
  const addSet = () => {
    tapMedium();
    // The new row is the one being written, so it opens. `drafts` is this
    // render's array, so its length IS the index the row lands on.
    setOpenSet(drafts.length);
    setDrafts((prev) => {
      const last = prev[prev.length - 1];
      const blank: SetDraft = {
        kind: 'working',
        parent: null,
        reps: '',
        weight: '',
        weightKg: null,
        weight0: '',
        rir: '',
        distance: '',
        duration: '',
        mode: 'strength',
        note: null,
      };
      if (!last) return [blank];
      return [
        ...prev,
        {
          ...blank,
          mode: last.mode,
          reps: last.reps,
          // A copied load is a NEW number as far as the record is concerned, so
          // it carries no original kilograms to fall back on (`weight0` stays
          // empty and `setOf` converts the text).
          weight: last.weight,
          rir: last.rir,
          distance: last.distance,
          duration: last.duration,
        },
      ];
    });
  };

  const removeSet = (index: number) => {
    tap();
    setDrafts((prev) => prev.filter((_, i) => i !== index));
    // The open index points into a list that just got shorter: the removed row
    // closes the form, and everything after it slides up by one.
    setOpenSet((open) => (open == null || open === index ? null : open > index ? open - 1 : open));
  };

  /**
   * Remove the whole reading — for the line the parser read an exercise out of
   * that was never an exercise ("felt strong today, 10/10").
   *
   * IT DELETES NOTHING THE ATHLETE WROTE. The line stays in `raw_text`, which
   * is the record (§3); what goes is the PROJECTION — the parsed item and its
   * sets — through the exact correction pipeline every other fix uses, so it
   * survives re-parses and stops inflating the totals. The card is replaced by
   * the quiet "kept as a note · not counted" block, which is what the line
   * always should have been. That is the footer's promise, kept literally.
   */
  const remove = () => {
    tap();
    Alert.alert(
      'Remove this reading?',
      'Your written line stays exactly as you typed it. Recore stops counting it as an exercise.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove reading',
          style: 'destructive',
          onPress: () => {
            tapMedium();
            removeReading();
          },
        },
      ],
    );
  };

  const original = fixTarget?.item.exercise ?? '';
  const exerciseChanged =
    exercise.trim().length > 0 && normalize(exercise) !== normalize(original);

  /**
   * THEIR PHRASE, not the model's.
   *
   * `typedNameOf` is the words before the first digit on the line they actually
   * wrote — "incline db 30x10" → "incline db". It is what the offer names and
   * what `aliasPhrasesOf` keys the override on, so the sentence on screen and
   * the row in the store are the same string. A line that opens with a number
   * has no name portion; the parse's own reported shorthand is the fallback,
   * and with neither there is nothing honest to offer, so nothing is offered.
   */
  const phrase = fixTarget
    ? typedNameOf(fixTarget.lineText) || (fixTarget.item.aliases_seen[0] ?? '')
    : '';
  const canRemember = exerciseChanged && phrase.length > 0;

  const toggleRemember = () => {
    tap();
    setRemember((on) => !on);
  };

  // Nothing to save until something moved. The comparison runs through the same
  // `setOf` the save does, so "changed" here can never disagree with the
  // `setsChanged` test inside applyCorrection — including the untouched-lb case,
  // where the drafts hand back the identical kilograms they opened with.
  const setsChanged = useMemo(() => {
    if (!fixTarget) return false;
    const next = drafts.map((d) => setOf(d, unit));
    return JSON.stringify(next) !== JSON.stringify(fixTarget.item.sets);
  }, [drafts, unit, fixTarget]);

  const canSave = exercise.trim().length > 0 && (exerciseChanged || setsChanged);

  /** Same rule as the reading side: nothing to save until something moved. */
  const wordsChanged = useMemo(() => {
    if (!fixTarget) return false;
    const current = (useSession.getState().note.split('\n')[fixTarget.line] ?? '').trim();
    const next = words.replace(/\n+/g, ' ').trim();
    return next.length > 0 && next !== current;
  }, [words, fixTarget]);

  return (
    <BottomSheet
      visible={fixTarget !== null}
      onClose={close}
      sheetStyle={[styles.sheet, { paddingBottom: spacing.lg }]}>
      {/* Tapping the sheet's own title puts the keyboard down — the words
          field is multiline and the steppers open number pads, so neither has
          a return key that finishes. Not a control to VoiceOver. */}
      <Pressable accessible={false} onPress={Keyboard.dismiss}>
        {/* Eyebrow states the JOB, the title states the SUBJECT — the same
            two-line header the ⋯ sheet and the note sheet wear, at the same
            sizes, so the three per-entry surfaces read as one family. */}
        <Eyebrow tone="muted" style={styles.eyebrow}>
          Fix reading
        </Eyebrow>
        <Text
          style={styles.title}
          numberOfLines={2}
          accessibilityRole="header"
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {original || 'This entry'}
        </Text>
      </Pressable>

      {/* The user's own words. Quoted, not rewritten — unless they ask, which
          is what the link underneath is for. */}
      <View style={styles.quoteCard}>
        {wordsMode ? (
          <TextInput
            ref={wordsRef}
            style={styles.wordsInput}
            value={words}
            onChangeText={setWords}
            multiline
            placeholder="What you wrote"
            placeholderTextColor={color.textMuted}
            selectionColor={color.accent}
            cursorColor={color.accent}
            keyboardAppearance="light"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            accessibilityLabel="Edit the line you wrote"
            allowFontScaling
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />
        ) : (
          <Text style={styles.quote} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            “{fixTarget?.lineText ?? ''}”
            <Text style={styles.quoteLine}>{fixTarget ? `  · line ${fixTarget.line + 1}` : ''}</Text>
          </Text>
        )}
      </View>

      {/* The two halves of "this is not what I did", one link apart. Which one
          the athlete needs is not something a menu should have made them decide
          before opening anything (owner, 12 Aug — this link replaced the ⋯
          sheet's separate "Edit line" row). */}
      <Pressable
        onPress={toggleWordsMode}
        hitSlop={spacing.sm}
        accessibilityRole="button"
        accessibilityLabel={
          wordsMode ? 'Correct the reading instead' : 'Edit the words you wrote instead'
        }
        style={styles.wordsLinkRow}>
        <Text style={styles.wordsLink} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {wordsMode ? 'Correct the reading instead' : 'Edit my words instead'}
        </Text>
      </Pressable>

      <ScrollView
        // Three ways out of every field on this sheet: a scroll (here), a tap
        // on anything in the sheet that is not itself a control ("handled"
        // keeps the buttons working on the FIRST tap and lets an unhandled tap
        // dismiss), and — for the steppers, whose number pads have no return
        // key — the Done bar mounted at the bottom of this sheet.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        style={styles.scroll}>
        {/* Everything below repairs the READING. In words mode it is all put
            away: the line itself is the thing being fixed, and a set of
            steppers underneath it would be editing a reading that is about to
            be thrown away and computed again. */}
        {wordsMode ? (
          <Text style={styles.wordsHint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Saving re-reads this line from your words. Whatever Recore makes of it becomes the
            new reading.
          </Text>
        ) : (
          <>
        {/* The chevron is the whole point of the row: it was a text field that
            looked like a label, so nobody knew the name was the thing you could
            change. Tapping anywhere on the row now opens it for editing.

            The label moved OUT of the row and became the section's eyebrow. A
            label inside the box with the value pushed right is a settings row —
            a thing you read. This is a field, and a field's value starts where
            you would begin typing it. */}
        <Eyebrow tone="muted" style={styles.sectionLabel}>
          Exercise
        </Eyebrow>
        <Pressable
          style={styles.fieldRow}
          onPress={() => exerciseRef.current?.focus()}
          accessibilityRole="button"
          accessibilityLabel={`Exercise: ${exercise}. Edit`}>
          <TextInput
            ref={exerciseRef}
            style={styles.exerciseInput}
            value={exercise}
            onChangeText={setExercise}
            placeholder="Exercise name"
            placeholderTextColor={color.textMuted}
            selectionColor={color.accent}
            cursorColor={color.accent}
            keyboardAppearance="light"
            autoCapitalize="words"
            autoCorrect={false}
            allowFontScaling
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />
          <Icon name="chevron-forward" size={moderateScale(16)} tint={color.textMuted} />
        </Pressable>
        {suggestions.length > 0 ? (
          <View style={styles.suggestions}>
            {suggestions.map((name) => (
              <Pressable
                key={name}
                style={styles.suggestion}
                onPress={() => {
                  tap();
                  setExercise(name);
                }}>
                <Text style={styles.suggestionText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* REMEMBER THIS — the flywheel, asked out loud (4 September 2026).
            Directly under the field it is about, because it is a question
            about the word that was just changed and nothing below it.

            It replaced a two-option "scope" radio group that sat under the set
            list and answered nothing: the second option was permanently
            selected and the first one silently reverted the Exercise field,
            so there was no way to correct a name WITHOUT teaching the parser
            forever. This is one checkbox with a real answer behind it. */}
        {canRemember ? (
          <Pressable
            onPress={toggleRemember}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: remember }}
            accessibilityLabel={`Remember this. “${phrase}” means ${exercise.trim()}`}
            accessibilityHint="Applies to future readings too"
            style={styles.rememberRow}>
            {/* The app's one checked shape — a filled square with a tick,
                the same object the planned checklist and the plan strip
                draw. Unchecked is the same box as an outline. */}
            <View style={[styles.check, remember && styles.checkOn]}>
              {remember ? (
                <Text style={styles.checkMark} allowFontScaling={false}>
                  ✓
                </Text>
              ) : null}
            </View>
            <View style={styles.rememberBody}>
              <Text style={styles.rememberTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Remember this — “{phrase}” means {exercise.trim()}
              </Text>
              <Text style={styles.rememberSub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                applies to future readings too
              </Text>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.sectionHead}>
          <Eyebrow tone="muted">Sets</Eyebrow>
          {/* The one line of teaching this sheet needs. A disclosure with no
              chevron is invisible otherwise, and a chevron on every row would
              put the chrome back that the rows just lost. `textSecondary`, not
              muted: this is the only place the disclosure is announced, and
              muted is 3.36:1 — the ink for what may be SKIPPED, which a hint
              nobody has read yet is not. */}
          {drafts.length > 1 ? (
            <Text style={styles.sectionHint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              tap a set to correct it
            </Text>
          ) : null}
        </View>

        <View style={styles.setList}>
          {drafts.map((d, i) =>
            openSet === i ? (
              <SetRow
                key={i}
                draft={d}
                index={i}
                unit={unit}
                canRemove={drafts.length > 1}
                onPatch={(patch) => patchDraft(i, patch)}
                onStep={(field, dir) => step(i, field, dir)}
                onRemove={() => removeSet(i)}
                onCollapse={
                  drafts.length > 1
                    ? () => {
                        tap();
                        Keyboard.dismiss();
                        setOpenSet(null);
                      }
                    : null
                }
              />
            ) : (
              <SetLine
                key={i}
                draft={d}
                index={i}
                unit={unit}
                onOpen={() => {
                  tap();
                  setOpenSet(i);
                }}
              />
            ),
          )}
        </View>

        {/* Quiet, full-width, under the last row — the shape of "one more of
            those", not a primary action competing with Save. */}
        <Pressable
          onPress={addSet}
          accessibilityRole="button"
          accessibilityLabel="Add a set to this reading"
          style={({ pressed }) => [styles.addSet, pressed && styles.addSetPressed]}>
          <Text style={styles.addSetText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            + Add set
          </Text>
        </Pressable>

        {/* The scope, said once, for the fix that has only one. A name change
            already carries its own sentence up beside the field it changed. */}
        {exerciseChanged ? null : (
          <Text style={styles.scopeOnly} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Applies to this session’s reading.
          </Text>
        )}
          </>
        )}

        {/* The app's primary button, not this sheet's own: brand fill, the one
            coloured shadow, `CTA_HEIGHT`. Cancel is deliberately absent — the
            backdrop, a downward drag and the grabber are three ways out
            already, and a fourth as a full-width slab was the largest object on
            a sheet whose content is the point. */}
        {wordsMode ? (
          <AppButton
            label="Save my words"
            onPress={saveWords}
            disabled={!wordsChanged}
            style={styles.save}
          />
        ) : (
          <AppButton
            label="Save correction"
            onPress={save}
            disabled={!canSave}
            style={styles.save}
          />
        )}
        {/* Destructive, last, alone under the safe pair — the same position and
            treatment the ⋯ sheet gives Delete. Hidden in words mode: removing
            the reading of a line you are in the middle of rewriting is two
            different intentions on one screen. */}
        {wordsMode ? null : (
          <Pressable
            style={styles.remove}
            onPress={remove}
            accessibilityRole="button"
            accessibilityLabel="Remove this reading. Your written line stays.">
            <Text style={styles.removeText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Remove this reading
            </Text>
          </Pressable>
        )}
        <Text style={styles.footer} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {wordsMode
            ? 'Your words stay yours — this edits the line itself, and Recore reads it again.'
            : 'Never changes your written words. Corrections stay private to you.'}
        </Text>
      </ScrollView>

      {/* Mounted inside the sheet on purpose: a `BottomSheet` is an RN `Modal`
          with its own window, and an accessory bar on the screen behind it
          would never attach to a field in here. */}
      <KeyboardDoneBar />
    </BottomSheet>
  );
}

/** "SET 2", or the kind when the set is not a plain working one. One helper so
 * the closed row and the open one can never disagree about what to call it. */
function labelOf(d: SetDraft, index: number): string {
  return d.kind === 'working' ? `SET ${index + 1}` : d.kind.toUpperCase();
}

/** One value and the word for it — the pair the row prints and VoiceOver
 * speaks. `num` decides which of the two voices it gets: the reading face for
 * the number, the app's own for the unit. */
interface Token {
  t: string;
  num: boolean;
}

/** The reading, as the ledger card writes it: `70 kg × 12`. Distance and
 * duration sets carry one value and its unit, which is the whole reading. */
function tokensOf(d: SetDraft, unit: WeightUnit): Token[] {
  if (d.mode === 'distance') return [{ t: d.distance || '—', num: true }, { t: 'm', num: false }];
  if (d.mode === 'duration') return [{ t: d.duration || '—', num: true }, { t: 's', num: false }];
  const out: Token[] = [];
  if (d.weight.trim()) out.push({ t: d.weight, num: true }, { t: unit, num: false });
  if (d.reps.trim()) {
    if (out.length > 0) out.push({ t: '×', num: false });
    out.push({ t: d.reps, num: true });
  }
  return out.length > 0 ? out : [{ t: '—', num: true }];
}

/** The same reading as a sentence — a screen reader gets the set spoken, never
 * the tokens read out one glyph at a time. */
function spokenOf(d: SetDraft, unit: WeightUnit): string {
  if (d.mode === 'distance') return d.distance ? `${d.distance} meters` : 'no distance read';
  if (d.mode === 'duration') return d.duration ? `${d.duration} seconds` : 'no duration read';
  const parts: string[] = [];
  if (d.weight.trim()) parts.push(`${d.weight} ${unit === 'kg' ? 'kilograms' : 'pounds'}`);
  if (d.reps.trim()) parts.push(`${d.reps} reps`);
  if (parts.length === 0) parts.push('nothing read');
  parts.push(d.rir.trim() ? `${d.rir} reps in reserve` : 'reps in reserve not read');
  return parts.join(', ');
}

/**
 * A SET, CLOSED — the reading itself, and the only state most sets are ever in.
 *
 * It is a bare row: no card, no fill, no hairline under it, the way §Structure
 * asks the record to be drawn. That is not only restraint — it is the task.
 * The athlete came here because the quoted line at the top of the sheet and the
 * numbers under it disagree, and finding the disagreement means READING the
 * numbers, which a grid of steppers actively prevents. Tapping the row turns
 * that one set into the form.
 */
function SetLine({
  draft: d,
  index,
  unit,
  onOpen,
}: {
  draft: SetDraft;
  index: number;
  unit: WeightUnit;
  onOpen: () => void;
}) {
  const label = labelOf(d, index);
  const hasRir = d.rir.trim().length > 0;
  return (
    <PressableScale
      onPress={onOpen}
      haptic="none"
      activeScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${spokenOf(d, unit)}`}
      accessibilityHint="Opens this set for correction"
      style={styles.setLine}
      pressedStyle={styles.setLinePressed}>
      <Text style={styles.setLineLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Text>
      <View style={styles.setLineValue}>
        {tokensOf(d, unit).map((tok, k) => (
          <Text
            key={`${k}:${tok.t}`}
            style={tok.num ? styles.setLineNum : styles.setLineUnit}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {tok.t}
          </Text>
        ))}
      </View>
      {/* RIR keeps its slot even when the parser read none: an empty one is the
          reason a good half of the corrections on this sheet get made, and a
          field that only appears once it has a value cannot be found. */}
      {d.mode === 'strength' ? (
        <View style={styles.setLineRir}>
          <Text
            style={[styles.setLineUnit, !hasRir && styles.setLineFaint]}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            RIR
          </Text>
          <Text
            style={[styles.setLineNum, !hasRir && styles.setLineFaint]}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {hasRir ? d.rir : '—'}
          </Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

/**
 * A SET, OPEN — the form, and the only object on the list that draws an edge.
 *
 * It reads left to right in the order the athlete wrote it and the ledger
 * prints it: SET → weight → × → reps → RIR. RIR drops to its own line under the
 * pair rather than running off the edge of a 390 pt phone — the reading order is
 * unchanged (down IS after right), and the row wraps instead of cropping when
 * Dynamic Type grows it.
 *
 * The border, not a grey fill, is what lifts it. `surfaceHigh` is the skill's
 * RECESSED tone and measures ~4.0:1 under `textSecondary`, so every `kg`,
 * `reps` and `RIR` printed on it was below AA — the old card was failing the
 * ink ladder to say something a hairline says for free.
 */
function SetRow({
  draft: d,
  index,
  unit,
  canRemove,
  onPatch,
  onStep,
  onRemove,
  onCollapse,
}: {
  draft: SetDraft;
  index: number;
  unit: WeightUnit;
  canRemove: boolean;
  onPatch: (patch: Partial<SetDraft>) => void;
  onStep: (field: 'weight' | 'reps' | 'rir', dir: 1 | -1) => void;
  onRemove: () => void;
  /** Put the form away again. Null when this is the only set — a list of one
   * has nothing to collapse back to. */
  onCollapse: (() => void) | null;
}) {
  const label = labelOf(d, index);

  return (
    <View style={styles.setRow}>
      <View style={styles.setHead}>
        <Pressable
          onPress={onCollapse ?? undefined}
          disabled={!onCollapse}
          hitSlop={spacing.sm}
          accessibilityRole={onCollapse ? 'button' : undefined}
          accessibilityLabel={onCollapse ? `${label}. Done editing` : label}>
          <Text style={styles.setKind} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {label}
          </Text>
        </Pressable>
        {canRemove ? (
          // A trash glyph, not a third `×`. The card already spends that
          // character on "times" between weight and reps and on clearing RIR;
          // one glyph meaning three things on one row is a puzzle.
          <Pressable
            onPress={onRemove}
            hitSlop={spacing.sm}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${label.toLowerCase()}`}
            style={({ pressed }) => [styles.dropSet, pressed && styles.stepBtnPressed]}>
            <Icon name="trash" size={moderateScale(15)} tint={color.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {d.mode === 'strength' ? (
        <>
          <View style={styles.fields}>
            <Stepper
              value={d.weight}
              unit={unit}
              placeholder="—"
              label={`Weight in ${unit}`}
              decimal
              onChangeText={(t) => onPatch({ weight: t })}
              onStep={(dir) => onStep('weight', dir)}
            />
            <Text style={styles.times} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              ×
            </Text>
            <Stepper
              value={d.reps}
              unit="reps"
              placeholder="—"
              label="Reps"
              onChangeText={(t) => onPatch({ reps: t })}
              onStep={(dir) => onStep('reps', dir)}
            />
          </View>
          <View style={styles.rirLine}>
            <Stepper
              value={d.rir}
              unit="RIR"
              unitLeading
              placeholder="—"
              label="Reps in reserve"
              decimal
              signed
              // An unread RIR is a dash you can tap: the first touch answers
              // "none in reserve" (0) rather than opening a keyboard for a
              // field most people never fill in by hand.
              onEmptyTap={() => onPatch({ rir: '0' })}
              // …and the × puts it back to "the parser read no effort here",
              // which is a different fact from "zero in reserve".
              onClear={d.rir.length > 0 ? () => onPatch({ rir: '' }) : undefined}
              onChangeText={(t) => onPatch({ rir: t })}
              onStep={(dir) => onStep('rir', dir)}
            />
          </View>
        </>
      ) : d.mode === 'distance' ? (
        <View style={styles.fields}>
          <TextInput
            style={[styles.valueBox, styles.value, styles.wideInput]}
            value={d.distance}
            onChangeText={(t) => onPatch({ distance: t })}
            placeholder="distance"
            placeholderTextColor={color.textMuted}
            keyboardType="decimal-pad"
            inputAccessoryViewID={DONE_ACCESSORY}
            keyboardAppearance="light"
            selectionColor={color.accent}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />
          <Text style={styles.unit} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            m
          </Text>
        </View>
      ) : (
        <View style={styles.fields}>
          <TextInput
            style={[styles.valueBox, styles.value, styles.wideInput]}
            value={d.duration}
            onChangeText={(t) => onPatch({ duration: t })}
            placeholder="duration"
            placeholderTextColor={color.textMuted}
            keyboardType="number-pad"
            inputAccessoryViewID={DONE_ACCESSORY}
            keyboardAppearance="light"
            selectionColor={color.accent}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />
          <Text style={styles.unit} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            s
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * The one editing control this sheet has: − · a tappable mono value · +.
 *
 * The value is a real text field, so a load nobody wants to reach in 2.5 kg
 * steps (a 47 kg machine stack) is still one tap and a number away — the
 * steppers are the fast path, never the only path.
 */
function Stepper({
  value,
  unit,
  unitLeading = false,
  placeholder,
  label,
  decimal = false,
  signed = false,
  onChangeText,
  onStep,
  onClear,
  onEmptyTap,
}: {
  value: string;
  /** The word after (or before) the number: "kg", "reps", "RIR". */
  unit: string;
  unitLeading?: boolean;
  placeholder: string;
  /** Spoken name of the field, for VoiceOver. */
  label: string;
  decimal?: boolean;
  signed?: boolean;
  onChangeText: (text: string) => void;
  onStep: (dir: 1 | -1) => void;
  /** The small × that empties the field, where empty is a real answer. */
  onClear?: () => void;
  /** What a tap on the EMPTY placeholder answers. Without it, an empty field
   * just opens the keyboard like any other. */
  onEmptyTap?: () => void;
}) {
  const unitText = (
    <Text style={styles.unit} maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {unit}
    </Text>
  );
  const empty = value.trim().length === 0;
  return (
    <View style={styles.stepper} accessibilityLabel={label}>
      {unitLeading ? unitText : null}
      <Pressable
        onPress={() => onStep(-1)}
        hitSlop={spacing.xs}
        accessibilityRole="button"
        accessibilityLabel={`${label}: one less`}
        style={({ pressed }) => [styles.stepBtn, pressed && styles.stepBtnPressed]}>
        <Text style={styles.stepGlyph} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          −
        </Text>
      </Pressable>
      {empty && onEmptyTap ? (
        <Pressable
          onPress={onEmptyTap}
          accessibilityRole="button"
          accessibilityLabel={`${label}: not read. Set to zero`}
          style={({ pressed }) => [
            styles.valueBox,
            styles.valueEmpty,
            pressed && styles.stepBtnPressed,
          ]}>
          <Text style={styles.valuePlaceholder} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {placeholder}
          </Text>
        </Pressable>
      ) : (
        <TextInput
          style={[styles.valueBox, styles.value]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={color.textMuted}
          keyboardType={
            decimal ? (signed ? 'numbers-and-punctuation' : 'decimal-pad') : 'number-pad'
          }
          inputAccessoryViewID={DONE_ACCESSORY}
          keyboardAppearance="light"
          selectionColor={color.accent}
          accessibilityLabel={`${label}: ${value || 'not read'}`}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        />
      )}
      <Pressable
        onPress={() => onStep(1)}
        hitSlop={spacing.xs}
        accessibilityRole="button"
        accessibilityLabel={`${label}: one more`}
        style={({ pressed }) => [styles.stepBtn, pressed && styles.stepBtnPressed]}>
        <Text style={styles.stepGlyph} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          +
        </Text>
      </Pressable>
      {unitLeading ? null : unitText}
      {onClear ? (
        <Pressable
          onPress={onClear}
          hitSlop={spacing.sm}
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label}`}
          style={({ pressed }) => [styles.clear, pressed && styles.stepBtnPressed]}>
          <Text style={styles.clearGlyph} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            ×
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: spacing.xl,
    maxHeight: '86%',
  },
  eyebrow: {
    marginTop: spacing.md,
  },
  // `title2`, the same size the ⋯ sheet and the note sheet give the exercise
  // name. It was an ad-hoc `headline` at 700 — a fourth weight/size pair
  // invented on one sheet, which is how a type scale stops being one.
  title: {
    marginTop: spacing.xs,
    ...type.title2,
    color: color.textPrimary,
  },
  quoteCard: {
    marginTop: spacing.sm + 2,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 1,
  },
  quote: {
    ...readingStyle('400'),
    fontSize: moderateScale(12.5),
    lineHeight: lineFor(18),
    color: color.textSecondary,
  },
  quoteLine: {
    color: color.textMuted,
  },
  // The same box the quote sits in, so switching modes swaps the CONTENT of
  // the card rather than replacing the card — the line never moves.
  wordsInput: {
    ...readingStyle('400'),
    fontSize: moderateScale(12.5),
    lineHeight: lineFor(18),
    color: color.textPrimary,
    padding: 0,
    // Two lines of room. A layout property on a text component still does not
    // scale with the reader, so the box grows itself (`textRoom`).
    minHeight: textRoom(lineFor(36)),
  },
  wordsLinkRow: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
  },
  wordsLink: {
    fontSize: type.caption.fontSize,
    fontWeight: '600',
    color: color.brand,
  },
  wordsHint: {
    marginTop: spacing.xs,
    fontSize: type.caption.fontSize,
    lineHeight: lineFor(18),
    color: color.textSecondary,
  },
  scroll: {
    flexGrow: 0,
    marginTop: spacing.md,
  },
  sectionLabel: {
    marginBottom: spacing.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionHint: {
    ...type.caption,
    color: color.textSecondary,
  },
  fieldRow: {
    minHeight: moderateScale(48),
    flexDirection: 'row',
    alignItems: 'center',
    // `surface`, not the recessed tone: `surfaceHigh` is for segmented
    // containers and pressed states, and text on it drops under AA.
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    // A ROW, so `radius.lg` 20 (skill §Spacing) — `md` 14 is a button's.
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingLeft: spacing.md + 2,
    paddingRight: spacing.sm,
    gap: spacing.sm,
  },
  exerciseInput: {
    flex: 1,
    color: color.textPrimary,
    ...type.headline,
    paddingVertical: spacing.sm,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  suggestion: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  suggestionText: {
    ...type.caption,
    color: color.textSecondary,
  },
  // Bare rows separated by air, never a hairline between two readings
  // (§Spacing). The open row is the one object here with an edge, which is what
  // makes it read as "this is the one being worked on".
  setList: {
    gap: spacing.xs,
  },
  setLine: {
    minHeight: moderateScale(48),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
  },
  setLinePressed: {
    backgroundColor: color.surfaceHigh,
  },
  setLineLabel: {
    ...readingStyle('400'),
    fontSize: moderateScale(9.5),
    letterSpacing: 1,
    color: color.textSecondary,
    minWidth: moderateScale(48),
  },
  setLineValue: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  // Number and unit are typographically two things (§Structure): the reading
  // face carries the value, the app's own voice carries the word, a step
  // lighter and one weight down.
  setLineNum: {
    ...readingStyle('500'),
    fontSize: type.body.fontSize,
    color: color.textPrimary,
  },
  setLineUnit: {
    ...type.caption,
    color: color.textSecondary,
  },
  /** An unread RIR — nothing to carry, so the eye may skip it. */
  setLineFaint: {
    color: color.textMuted,
  },
  setLineRir: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  setRow: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    // A ROW, so `radius.lg` 20 (skill §Spacing) — `md` 14 is a button's.
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  setHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  setKind: {
    ...readingStyle('400'),
    fontSize: moderateScale(9.5),
    letterSpacing: 1,
    color: color.textSecondary,
  },
  dropSet: {
    width: moderateScale(24),
    height: moderateScale(24),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm - 1,
    borderCurve: 'continuous',
  },
  fields: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  // RIR reads AFTER the weight × reps pair — down is still "next" — and gets
  // its own line so the pair never has to compete with it for width.
  rirLine: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  /** The box every value sits in — shared by the field and by the tappable
   * placeholder that stands in for one, so the row never changes width when an
   * unread RIR becomes a number. */
  valueBox: {
    minWidth: moderateScale(48),
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm - 1,
    borderCurve: 'continuous',
    backgroundColor: color.surface,
    paddingHorizontal: spacing.xs + 1,
    paddingVertical: spacing.xs + 2,
  },
  value: {
    textAlign: 'center',
    color: color.textPrimary,
    ...readingStyle('400'),
    fontSize: type.subhead.fontSize,
  },
  valueEmpty: {
    minHeight: moderateScale(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  valuePlaceholder: {
    ...readingStyle('400'),
    fontSize: type.subhead.fontSize,
    color: color.textMuted,
  },
  wideInput: {
    minWidth: moderateScale(96),
  },
  // The one legitimate use of the recessed tone on this sheet: − and + are
  // CONTROLS, and giving them a fill instead of a border is what stops
  // "− 70 +" reading as three identical boxes. The value keeps the border, so
  // the field still looks like the thing you can type into.
  stepBtn: {
    width: moderateScale(28),
    minHeight: moderateScale(32),
    backgroundColor: color.surfaceHigh,
    borderRadius: radius.sm - 1,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPressed: {
    opacity: 0.6,
  },
  stepGlyph: {
    color: color.textPrimary,
    fontSize: type.subhead.fontSize,
    lineHeight: lineFor(20),
  },
  clear: {
    width: moderateScale(24),
    height: moderateScale(24),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm - 1,
    borderCurve: 'continuous',
  },
  clearGlyph: {
    color: color.textMuted,
    fontSize: moderateScale(13),
  },
  times: {
    color: color.textMuted,
    fontSize: type.subhead.fontSize,
  },
  unit: {
    ...type.caption,
    color: color.textSecondary,
  },
  // A solid hairline, not a dashed one: nothing else in the app is dashed, and
  // a border style that appears exactly once is a dialect, not an accent.
  addSet: {
    marginTop: spacing.sm,
    minHeight: moderateScale(48),
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSetPressed: {
    opacity: 0.6,
  },
  addSetText: {
    ...type.caption,
    fontWeight: '600',
    color: color.textSecondary,
  },
  /** The offer to learn the word, under the field it is about. 44 pt of
   * height for the finger, `flex-start` so a wrapped two-line sentence keeps
   * the box beside its first line rather than centred against both. */
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minHeight: moderateScale(44),
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  check: {
    width: moderateScale(20),
    height: moderateScale(20),
    borderRadius: moderateScale(6),
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: color.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  /** Checked is INK, not brand: this is an answer the athlete gave, the same
   * fill the planned checklist gives a ticked set. */
  checkOn: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  checkMark: {
    fontSize: moderateScale(13),
    lineHeight: moderateScale(15),
    fontWeight: '700',
    color: color.onInk,
  },
  rememberBody: {
    flex: 1,
  },
  rememberTitle: {
    fontSize: moderateScale(14.5),
    lineHeight: lineFor(20),
    fontWeight: '600',
    color: color.textPrimary,
  },
  rememberSub: {
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
    marginTop: 1,
  },
  scopeOnly: {
    marginTop: spacing.lg,
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
  },
  // Geometry only — `AppButton` owns the fill, the glow and `CTA_HEIGHT`.
  save: {
    marginTop: spacing.lg,
  },
  remove: {
    marginTop: spacing.md,
    minHeight: moderateScale(44),
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: color.error,
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
  },
  footer: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontSize: moderateScale(11.5),
    lineHeight: lineFor(16),
    color: color.textMuted,
    textAlign: 'center',
  },
});
