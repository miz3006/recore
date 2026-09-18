import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { DONE_ACCESSORY, KeyboardDoneBar } from '@/components/keyboard-done';
import { PressScale } from '@/lib/motion/index';
import { MAX_FONT_SCALE, moderateScale, readingStyle, spacing, type } from '@/lib/theme';

import { v2color, v2radius, v2shadow } from './tokens';

/** The step every load moves by. Barbell reality: 1,25 kg a side. */
const STEP_KG = 2.5;

/**
 * THE RANGE, AND IT IS ONE RANGE FOR BOTH CONTROLS.
 *
 * The steppers cannot leave it and a typed number is clamped into it, so the
 * two ways of setting a load can never produce different sets of values. The
 * floor is one step rather than zero because an unloaded bar is not a working
 * weight, and the ceiling is a number no key lift in this list passes.
 */
const MIN_KG = STEP_KG;
const MAX_KG = 400;

/**
 * ONE KEY LIFT AND ITS CURRENT LOAD — screen 15.
 *
 * The load is an INPUT, so it does not count up (§3 reserves that for results).
 * It appears instantly, in the reading face with tabular figures. §2's own
 * defence of this screen is that a heavy screen late in the funnel is fine when
 * it visibly improves the result — so the number set here is the number screen
 * 19 hands back, unchanged apart from the increment it states out loud.
 *
 * ## TWO WAYS TO SET IT, AND THE SECOND ONE IS THE POINT (owner, 17 Sep 2026)
 *
 * The steppers were the only way in, and "a plate at a time" is the wrong unit
 * for the distance between a default and a real working weight: a 140 kg
 * deadlift is sixteen taps from the 100 the row opens on, and a person who
 * knows their own number should never have to count their way to it.
 *
 * **So the number is a field.** It carries the reading face and the recessed
 * fill of a control at rest; tapping it opens the decimal pad, and the field
 * CLEARS on focus with the current load standing behind it as a placeholder,
 * so the new number is typed rather than edited into the old one. Leaving
 * without typing changes nothing — an empty commit reverts.
 *
 * The steppers stay for the nudge they are good at, and one pressed while the
 * field is open takes the typed number with it rather than the stale one
 * underneath.
 *
 * A typed load is rounded to the half kilo, which is the finest change a plate
 * set can actually make, and clamped into the steppers' own range. Nonsense —
 * a word, a zero — puts the previous number back rather than storing something
 * nobody could have meant.
 *
 * ## The field is mounted whether or not it is being typed into
 *
 * It looks like state that could be conditional and it cannot be. iOS binds a
 * keyboard's `Done` bar to a field exactly once, when the BAR mounts, by
 * searching the window for a field carrying its id — so a field that springs
 * into existence on tap gets a bare number pad with no way off it, which is
 * the one thing the 20 August rule forbids. Mounted from the start, with its
 * own bar and its own id beside it, the binding happens at screen mount and
 * holds. Verified on the simulator, both ways round. See `KeyboardDoneBar`.
 *
 * The steppers get the press spring and a selection tick each, which is the
 * same feedback as a picker detent: §3, "Pickers — haptic tick per unit
 * crossed."
 */
export function LiftLoadRow({
  label,
  kg,
  onChange,
}: {
  label: string;
  kg: number;
  onChange: (kg: number) => void;
}) {
  const shown = fmt(kg);
  const field = useRef<TextInput>(null);
  /** What is in the field while it is being typed into; `null` when the field
   * is simply reporting the stored load. */
  const [draft, setDraft] = useState<string | null>(null);
  /** A ref rather than state: `commit` runs from a blur handler and from a
   * stepper press, and both have to know whether the field is still open
   * WITHOUT waiting for a render. */
  const open = useRef(false);

  /**
   * Take whatever is in the field and answer with the load the row is on
   * afterwards — so a stepper pressed mid-typing steps from the typed number
   * rather than from the stale one underneath it.
   */
  const commit = (): number => {
    const parsed = draft === null ? null : parseKg(draft);
    // Still open: back to an empty field over the (possibly new) placeholder.
    // Closed: back to reporting the stored load.
    setDraft(open.current ? '' : null);
    if (parsed === null || parsed === kg) return kg;
    onChange(parsed);
    return parsed;
  };

  /**
   * A step lands on the 2.5 grid, not just 2.5 away from wherever the number
   * is: a typed 61 kg plus a plate is 62.5 on a bar and 63.5 only on paper.
   */
  const step = (delta: number) => {
    const from = commit();
    const next = Math.round((from + delta) / STEP_KG) * STEP_KG;
    onChange(Math.max(MIN_KG, Math.min(MAX_KG, next)));
  };

  const typing = draft !== null;
  const accessory = `${DONE_ACCESSORY}.${label}`;

  return (
    <View style={[styles.row, v2shadow]}>
      <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.stepper}>
        <Stepper
          glyph="−"
          label={`Decrease ${label}`}
          disabled={kg <= MIN_KG}
          onPress={() => step(-STEP_KG)}
        />
        {/* THE WHOLE READING IS THE TARGET, number and unit together. The hit
            slop is vertical only — a horizontal one would reach into the two
            stepper discs 8 pt away and make the middle of the row ambiguous —
            and it takes a 67 × 24 pt field to 67 × 48 without changing the
            height of the row. A tap anywhere in it hands the caret to the
            field, which is what a form row does. */}
        <Pressable
          onPress={() => field.current?.focus()}
          hitSlop={{ top: spacing.md, bottom: spacing.md }}
          accessible={false}
          style={styles.readout}>
          <TextInput
            ref={field}
            value={draft ?? shown}
            onChangeText={setDraft}
            onFocus={() => {
              open.current = true;
              setDraft('');
            }}
            onBlur={() => {
              open.current = false;
              commit();
            }}
            onSubmitEditing={commit}
            placeholder={shown}
            placeholderTextColor={v2color.inkMuted}
            keyboardType="decimal-pad"
            returnKeyType="done"
            inputAccessoryViewID={accessory}
            style={[styles.value, styles.field, typing && styles.fieldTyping]}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            accessibilityLabel={`${label}, ${shown} kilograms`}
          />
          <Text style={styles.unit} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            kg
          </Text>
        </Pressable>
        <Stepper
          glyph="+"
          label={`Increase ${label}`}
          disabled={kg >= MAX_KG}
          onPress={() => step(STEP_KG)}
        />
      </View>

      {/* The bar this row's field hangs off — one per row, because one shared
          id would bind every bar to the first field in the window. It draws no
          layout box (RN positions it absolutely) and nothing at all until its
          own field is the first responder. */}
      <KeyboardDoneBar nativeID={accessory} />
    </View>
  );
}

/** 60 stays "60"; 62.5 stays "62.5". */
function fmt(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : String(Math.round(kg * 10) / 10);
}

/**
 * What a typed field means, or `null` for "put the old number back".
 *
 * A comma is a decimal point — the flow is written for a person who types
 * "82,5" — and the result is rounded to the half kilo because that is the
 * finest change a plate set can make. Anything that is not a positive number
 * is refused rather than stored.
 */
function parseKg(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const rounded = Math.round(parsed * 2) / 2;
  return Math.max(MIN_KG, Math.min(MAX_KG, rounded));
}

function Stepper({
  glyph,
  label,
  disabled,
  onPress,
}: {
  glyph: string;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      haptic="selection"
      accessibilityLabel={label}
      style={styles.stepButton}>
      <View style={[styles.stepInner, disabled && styles.stepDisabled]}>
        <Text style={styles.stepGlyph} maxFontSizeMultiplier={1.2}>
          {glyph}
        </Text>
      </View>
    </PressScale>
  );
}

const BUTTON = moderateScale(34);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: v2color.surface,
    borderRadius: v2radius.card,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: v2color.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    minHeight: moderateScale(64),
  },
  label: { ...type.body, fontWeight: '600', color: v2color.ink, flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepButton: {},
  stepInner: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(23,25,20,0.05)',
  },
  stepDisabled: { opacity: 0.35 },
  stepGlyph: { ...type.body, fontWeight: '600', color: v2color.ink, lineHeight: undefined },
  /**
   * A FIELD, NOT A READING — and it has to look like one at rest.
   *
   * The subline says the number can be typed, and a person who does not read
   * sublines still has to be able to see it: the same recessed 5 % ink the
   * stepper discs wear, in a rounded rect rather than a circle, is what
   * distinguishes "a value you can set" from "a value being reported" without
   * spending the blue on a control that is not active yet.
   */
  readout: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    minWidth: moderateScale(62),
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: v2radius.button,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(23,25,20,0.05)',
  },
  value: {
    ...readingStyle('600'),
    fontSize: moderateScale(19),
    color: v2color.ink,
    fontVariant: ['tabular-nums'],
  },
  field: { minWidth: moderateScale(40), paddingVertical: 0, textAlign: 'center' },
  /** Live: the one blue, doing what it does everywhere else — marking the
   * control that is currently taking the input (design skill §Colour). */
  fieldTyping: { color: v2color.blue },
  unit: { ...type.caption, color: v2color.inkSecondary },
});
