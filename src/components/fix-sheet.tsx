import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { searchExercises } from '@/lib/db/exercises';
import { tap, tapMedium } from '@/lib/haptics';
import { MAX_RIR, MIN_RIR, type ParsedSet } from '@/lib/parse/types';
import { getWeightUnit } from '@/lib/prefs';
import {
  color,
  CONTROL_HEIGHT,
  fonts,
  ink,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
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
 * 4. **The alias offer is conditional.** "Always read X as Y" only exists once
 *    the Exercise field has actually changed, with the real target named. Fixing
 *    a weight never again shows a radio group asking about a word.
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
    tap();
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
    tap();
    submitFix(
      exercise,
      drafts.map((d) => setOf(d, unit)),
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

  // Scope, DERIVED from the one thing the existing logic keys on: whether the
  // typed exercise differs from the parsed one. Changing the name IS the alias
  // scope; leaving it is "only this line". The radios state it — they never
  // fork behavior applyCorrection doesn't have.
  const original = fixTarget?.item.exercise ?? '';
  const exerciseChanged =
    exercise.trim().length > 0 && normalize(exercise) !== normalize(original);
  const shorthand = fixTarget?.item.aliases_seen[0] ?? original;

  const selectLineOnly = () => {
    if (!exerciseChanged) return;
    tap();
    setExercise(original);
  };

  const selectAlias = () => {
    tap();
    exerciseRef.current?.focus();
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
      <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Fix reading
      </Text>

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
        keyboardShouldPersistTaps="handled"
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
            change. Tapping anywhere on the row now opens it for editing. */}
        <Pressable
          style={styles.fieldRow}
          onPress={() => exerciseRef.current?.focus()}
          accessibilityRole="button"
          accessibilityLabel={`Exercise: ${exercise}. Edit`}>
          <Text style={styles.fieldLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Exercise
          </Text>
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

        {drafts.map((d, i) => (
          <SetRow
            key={i}
            draft={d}
            index={i}
            unit={unit}
            canRemove={drafts.length > 1}
            onPatch={(patch) => patchDraft(i, patch)}
            onStep={(field, dir) => step(i, field, dir)}
            onRemove={() => removeSet(i)}
          />
        ))}

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

        {/* Scope — shown ONLY once the name actually changed, because that is
            the only time there are two different things this fix could mean.
            Correcting a weight gets the plain sentence instead: a radio group
            with one possible answer is a question that isn't being asked. */}
        {exerciseChanged ? (
          <View style={styles.scopes}>
            <Pressable style={styles.scopeRow} onPress={selectLineOnly}>
              <View style={styles.radio} />
              <View style={styles.scopeBody}>
                <Text style={styles.scopeTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  Only this line
                </Text>
                <Text style={styles.scopeSub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  Keep reading “{shorthand}” the way it does now.
                </Text>
              </View>
            </Pressable>
            <Pressable style={styles.scopeRow} onPress={selectAlias}>
              <View style={[styles.radio, styles.radioSelected]} />
              <View style={styles.scopeBody}>
                <Text style={styles.scopeTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  Always read “{shorthand}” as {exercise.trim()}
                </Text>
                <Text style={styles.scopeSub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  Future parsing only · never rewrites your words.
                </Text>
              </View>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.scopeOnly} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Applies to this session’s reading.
          </Text>
        )}
          </>
        )}

        {wordsMode ? (
          <Pressable
            style={[styles.save, !wordsChanged && styles.saveDisabled]}
            disabled={!wordsChanged}
            accessibilityRole="button"
            accessibilityState={{ disabled: !wordsChanged }}
            onPress={saveWords}>
            <Text style={styles.saveText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Save my words
            </Text>
          </Pressable>
        ) : (
        <Pressable
          style={[styles.save, !canSave && styles.saveDisabled]}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
          onPress={save}>
          <Text style={styles.saveText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Save correction
          </Text>
        </Pressable>
        )}
        <Pressable style={styles.cancel} onPress={close}>
          <Text style={styles.cancelText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Cancel
          </Text>
        </Pressable>
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
    </BottomSheet>
  );
}

/**
 * One set, reading left to right in the order the athlete wrote it and the
 * ledger prints it: SET → weight → × → reps → RIR.
 *
 * RIR drops to its own line under the pair rather than running off the edge of
 * a 390 pt phone — the reading order is unchanged (down IS after right), and
 * the row wraps instead of cropping when Dynamic Type grows it.
 */
function SetRow({
  draft: d,
  index,
  unit,
  canRemove,
  onPatch,
  onStep,
  onRemove,
}: {
  draft: SetDraft;
  index: number;
  unit: WeightUnit;
  canRemove: boolean;
  onPatch: (patch: Partial<SetDraft>) => void;
  onStep: (field: 'weight' | 'reps' | 'rir', dir: 1 | -1) => void;
  onRemove: () => void;
}) {
  const label = d.kind === 'working' ? `SET ${index + 1}` : d.kind.toUpperCase();

  return (
    <View style={styles.setRow}>
      <View style={styles.setHead}>
        <Text style={styles.setKind} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {label}
        </Text>
        {canRemove ? (
          <Pressable
            onPress={onRemove}
            hitSlop={spacing.sm}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${label.toLowerCase()}`}
            style={({ pressed }) => [styles.dropSet, pressed && styles.stepBtnPressed]}>
            <Text style={styles.dropSetGlyph} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              ×
            </Text>
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
  title: {
    color: color.textPrimary,
    fontSize: type.headline.fontSize,
    fontWeight: '700',
    marginTop: spacing.md,
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
    fontFamily: fonts.reading,
    fontSize: moderateScale(12.5),
    lineHeight: lineFor(18),
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  quoteLine: {
    color: color.textMuted,
  },
  // The same box the quote sits in, so switching modes swaps the CONTENT of
  // the card rather than replacing the card — the line never moves.
  wordsInput: {
    fontFamily: fonts.reading,
    fontSize: moderateScale(12.5),
    lineHeight: lineFor(18),
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
    padding: 0,
    minHeight: lineFor(36),
  },
  wordsLinkRow: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
  },
  wordsLink: {
    fontSize: type.caption.fontSize,
    fontWeight: '600',
    color: color.trained,
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
  fieldRow: {
    minHeight: moderateScale(48),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surfaceHigh,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingLeft: spacing.md + 2,
    paddingRight: spacing.sm,
    gap: spacing.sm,
  },
  fieldLabel: {
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
  },
  exerciseInput: {
    flex: 1,
    textAlign: 'right',
    color: color.textPrimary,
    fontSize: moderateScale(14.5),
    fontWeight: '600',
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
  setRow: {
    backgroundColor: color.surfaceHigh,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  setHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  setKind: {
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
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
  dropSetGlyph: {
    color: color.textMuted,
    fontSize: moderateScale(15),
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
    fontFamily: fonts.reading,
    fontSize: type.subhead.fontSize,
    fontVariant: ['tabular-nums'],
  },
  valueEmpty: {
    minHeight: moderateScale(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  valuePlaceholder: {
    fontFamily: fonts.reading,
    fontSize: type.subhead.fontSize,
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  wideInput: {
    minWidth: moderateScale(96),
  },
  stepBtn: {
    width: moderateScale(28),
    minHeight: moderateScale(32),
    borderWidth: 1,
    borderColor: color.border,
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
  addSet: {
    marginTop: spacing.sm,
    minHeight: moderateScale(44),
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: color.border,
    borderStyle: 'dashed',
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
  scopes: {
    marginTop: spacing.lg,
    gap: spacing.md - 2,
  },
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  radio: {
    width: moderateScale(20),
    height: moderateScale(20),
    borderRadius: moderateScale(10),
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: color.textMuted,
    marginTop: 1,
  },
  radioSelected: {
    borderWidth: moderateScale(6.5),
    borderColor: color.accent,
  },
  scopeBody: {
    flex: 1,
  },
  scopeTitle: {
    fontSize: moderateScale(14.5),
    fontWeight: '600',
    color: color.textPrimary,
  },
  scopeSub: {
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
    marginTop: 1,
  },
  scopeOnly: {
    marginTop: spacing.lg,
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
  },
  save: {
    marginTop: spacing.lg,
    minHeight: CONTROL_HEIGHT,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: color.ctaFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDisabled: {
    opacity: ink.disabled,
  },
  saveText: {
    color: color.onInk,
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
  cancel: {
    marginTop: spacing.sm + 1,
    minHeight: moderateScale(44),
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: color.textPrimary,
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
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
