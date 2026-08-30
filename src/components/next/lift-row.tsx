import { useState } from 'react';
import { StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { DONE_ACCESSORY } from '@/components/keyboard-done';
import { PressableScale } from '@/components/motion';
import { whenLabel } from '@/lib/brief-prose';
import { todayKey } from '@/lib/db/dates';
import { moveLabel, reasonLine, type ReasonTone, type SessionRow } from '@/lib/next/sections';
import { fmtNumber } from '@/lib/parse/summarize';
import {
  color,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  shadow,
  spacing,
  type,
} from '@/lib/theme';

/**
 * ONE ROW PER LIFT — title, target, reason (owner, 28 August 2026).
 *
 * Symmetry's Workout Detail gave the structure this screen now stands on:
 * title block, a compact summary of what it targets, exercise rows, one pinned
 * Start. Setgraph gave the colour discipline — a single green carrying a whole
 * screen on a light neutral canvas. **Neither reference has this row**, and it
 * is the point of the redesign:
 *
 *     ┌────────────────────────────────────────────┐
 *     │  Bench press                       82.5 kg  │
 *     │  up 2.5 from Sat 8 Aug               5·5·5  │
 *     └────────────────────────────────────────────┘
 *
 * *"A derived plan the user can't audit is a plan they won't trust."* Every
 * gym app in the corpus builds this screen as a library — template grids,
 * category pills, a create-workout FAB — because a workout you PICKED needs no
 * explaining. Next is derived from the athlete's own history, so every target
 * on it owes the reader its reason, in secondary type, always, without a tap.
 *
 * ## Two layouts, and why the second one is right
 *
 * The 28 August build made this a BARE ROW with the reason right-aligned under
 * the target, and it was wrong twice (owner, 29 August: *"definitivno mi ni
 * všeč"*). Tiimo — iPhone App of the Year 2025, and an AI co-planner, which is
 * this screen's function in another category — showed both faults in one
 * glance:
 *
 * **The reason was on the wrong side.** A right-aligned SENTENCE has no left
 * edge to return to: every line starts somewhere new and the eye hunts for it.
 * Numbers right-align because their shape is stable; prose does not. So the
 * card is two columns now — name and reason LEFT, load and scheme RIGHT — and
 * each column is internally consistent instead of both being ragged against
 * the same edge.
 *
 * **A bare row made a computed plan look like a list you typed.** The rule that
 * the record has no cards is right for Today, where the athlete wrote every
 * line. Next is not the record: these are objects the app PLACED, off a history
 * it read. A surface is what says so. That is the justification skill
 * §Structure asks for before a card may exist, and it is a distinction that
 * carries meaning rather than decoration — bare rows on Today, cards on Next.
 *
 * What went before both: `LiftCard`'s accordion (a reason permanently on screen
 * needs no disclosure) and its lever chip ("ADD 2.5 KG" beside "up 2.5 from Sat
 * 8 Aug" is one decision stated twice).
 *
 * ## The colour
 *
 * Next is the one screen where everything is planned, so `signal` is dominant
 * here rather than an accent: the target, and the planned magnitude inside the
 * reason. product-direction §4.2 licenses exactly this — green is for *"a
 * concrete future prescription only, always with its label and reason"* — and
 * on this row the name is the label and the line underneath is the reason,
 * both present, always.
 *
 * MEASURED, and one number needs the owner. `signal` #547C00 on the canvas's
 * worst gradient stop is **4.4962:1** (`theme/color.ts` asserts that exact
 * ratio in `color.test.ts`). At the target's 20 pt bold that is large text,
 * owes 3:1, and clears with room. The reason line's magnitude is 11.5 pt —
 * normal text, owing 4.5:1 — so it lands four thousandths short. This row is
 * the first surface in the app to put `signal` on a small read figure, so it
 * is the first place the shortfall bites rather than a new fault it invented.
 * `color.ts` already names the fix: **`#4F7500` clears 4.5 on every stop**.
 * Until the owner rules, the WORD carries the meaning beside the figure ("up",
 * "down") and colour is never the only carrier (§14).
 *
 * The scheme stays ink: it is how the load is arranged, not a second load.
 * Recorded values, wherever they appear for comparison, stay ink and grey —
 * `gain` green may never stand in for `signal`, because recorded is not
 * planned.
 *
 * ## An overridden target stops being green
 *
 * Not as a decoration of the user's authorship, but because §4.2's own
 * condition fails: a number the athlete typed has no reason, so it cannot be
 * *"always with its label and reason"*. It drops to ink and the row says whose
 * it is and what it displaced. The precedent is already in the repository —
 * `planned-checklist.tsx`: *"the instant a set is ticked its row loses the
 * green."* A plan you can't argue with is a plan you fight, so the row keeps
 * the engine's figure visible next to the athlete's.
 *
 * ## Editing, and why the row does not look like a form
 *
 * Symmetry devotes a pinned Edit Workout bar to this. The lighter version the
 * owner asked for: at rest the target is plain text with no field around it,
 * and the affordance appears only once `editing` is on — the `Edit` control in
 * the title block, Setgraph's placement. Then the target alone becomes
 * tappable and turns into an input in place; the name stops being a door to
 * history, because in edit mode every tap should mean the same thing.
 *
 * Clearing the field is how an athlete takes the argument back: an empty
 * commit restores the engine's number, its reason line and its green. There is
 * no separate revert control, because the field already is one.
 */

/** Handing the line box back to the text: `undefined` lets RN measure the
 * scaled glyphs instead of holding them inside a height computed for the
 * unscaled ones. */
const FREE_LINE = { lineHeight: undefined } as const;

/** Above this system text scale the two-column row stops being readable — a
 * right-aligned sentence that wraps is a sentence read from its ragged edge —
 * so the row reflows to one left-aligned stack. */
const STACK_FONT_SCALE = 1.3;

export function LiftRow({
  row,
  /** The athlete's own number for this lift, when they have overridden the
   * engine's (`lib/next/overrides.ts`). */
  override,
  /** The title block's Edit control is on: targets become editable, and the
   * row stops being a door to history. */
  editing = false,
  onPress,
  /** A committed target, or null to hand the row back to the engine. */
  onCommit,
}: {
  row: SessionRow;
  override?: number | null;
  editing?: boolean;
  onPress: () => void;
  onCommit: (kg: number | null) => void;
}) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > STACK_FONT_SCALE;
  const overridden = override != null;
  const reason = overridden ? null : reasonLine(row);
  // Only a row with a load to replace can take one. A cardio line, a carry and
  // a lift with no history have no figure to argue with (§7.3).
  const editable = editing && (row.loadKg != null || override != null);

  const body = (
    <>
      {/* LEFT: what it is, and why that number. Both left-aligned, because a
          sentence needs an edge to start from. */}
      <View style={styles.left}>
        <Text style={styles.name} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {row.name}
        </Text>
        {overridden ? (
          <Text
            style={[styles.reason, styles.yours, stacked ? styles.freeLine : null]}
            numberOfLines={2}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {row.loadKg != null ? `your number, was ${fmtNumber(row.loadKg)}` : 'your number'}
          </Text>
        ) : reason ? (
          <Text
            style={[styles.reason, stacked ? styles.freeLine : null]}
            numberOfLines={2}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {reason.map((seg, i) => (
              <Text key={i} style={TONE[seg.tone]}>
                {seg.text}
              </Text>
            ))}
          </Text>
        ) : null}
      </View>

      {/* RIGHT: the load and how it is arranged. Two short lines of stable
          width, which is what right alignment is for. */}
      <View style={[styles.right, stacked ? styles.rightStacked : null]}>
        {editable ? (
          <TargetField row={row} override={override} stacked={stacked} onCommit={onCommit} />
        ) : (
          <Target row={row} override={override} stacked={stacked} />
        )}
        {row.scheme && (row.loadKg != null || override != null) ? (
          <Text
            style={styles.scheme} /* ISOLATION TEST */
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {row.scheme}
          </Text>
        ) : null}
      </View>
    </>
  );

  return (
    <>
      {editing ? (
        // In edit mode the row is not a door. The field inside it is the only
        // thing that takes a tap, so a finger landing anywhere else does
        // nothing rather than navigating away mid-edit.
        <View style={[styles.row, stacked ? styles.rowStacked : null]}>{body}</View>
      ) : (
        <PressableScale
          haptic="none"
          activeScale={0.98}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={spokenLabel(row, override)}
          accessibilityHint={row.canonical ? 'Opens this lift’s history' : undefined}
          style={[styles.row, stacked ? styles.rowStacked : null]}>
          {body}
        </PressableScale>
      )}

      <Quote row={row} />
    </>
  );
}

/**
 * The target, in place, as a field.
 *
 * It keeps the target's own type so the number does not jump when editing
 * starts — the row is being argued with, not replaced by a form. The value
 * shown is whatever is on screen right now (the athlete's, or the engine's),
 * so committing without typing changes nothing.
 *
 * An empty commit is the revert: it hands the row back to the engine, and the
 * reason line and the green come back with it.
 */
function TargetField({
  row,
  override,
  stacked,
  onCommit,
}: {
  row: SessionRow;
  override?: number | null;
  stacked: boolean;
  onCommit: (kg: number | null) => void;
}) {
  const shown = override ?? row.loadKg;
  const [text, setText] = useState(shown != null ? fmtNumber(shown) : '');

  const commit = () => {
    const trimmed = text.trim().replace(',', '.');
    if (trimmed === '') {
      onCommit(null);
      return;
    }
    const kg = Number(trimmed);
    // Not a number, or not a load: the field goes back to what it was showing
    // rather than storing something the athlete cannot have meant.
    if (!Number.isFinite(kg) || kg <= 0) {
      setText(shown != null ? fmtNumber(shown) : '');
      return;
    }
    onCommit(kg);
  };

  return (
    <View style={[styles.field, stacked ? styles.fieldStacked : null]}>
      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="decimal-pad"
        returnKeyType="done"
        selectTextOnFocus
        inputAccessoryViewID={DONE_ACCESSORY}
        style={[styles.target, styles.targetOwn, styles.fieldInput]}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        accessibilityLabel={`Target for ${row.name}, in kilograms`}
      />
      <Text style={[styles.unit, styles.targetOwn]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {' kg'}
      </Text>
    </View>
  );
}

/**
 * The target: load, unit, scheme — three typographic things on one line.
 *
 * The unit is a step smaller and lighter than the number it belongs to (skill
 * §Structure: *"number and unit are typographically two things"*), and the
 * scheme a further step into ink, because it arranges the load rather than
 * restating it.
 *
 * When the engine handed over no figure — a cardio line, a carry, a ghost
 * cached before the loads were stored — the whole prescription prints one size
 * down instead of being split apart on screen (§7.7). An empty slot is honest;
 * a parsed one is how the multi-set display bug happened.
 */
function Target({
  row,
  override,
  stacked,
}: {
  row: SessionRow;
  override?: number | null;
  stacked: boolean;
}) {
  const kg = override ?? row.loadKg;
  // An overridden number is still planned, but it is no longer DERIVED, and
  // §4.2 spends green only on a prescription that arrives with its reason.
  const tint = override != null ? styles.targetOwn : styles.targetPlanned;

  if (kg != null) {
    return (
      <Text
        style={[styles.target, tint, stacked ? styles.targetStacked : null]}
        numberOfLines={1}
        maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {fmtNumber(kg)}
        <Text style={[styles.unit, tint]}> kg</Text>
      </Text>
    );
  }

  if (row.prescription) {
    return (
      <Text
        style={[styles.targetCompact, tint, stacked ? styles.targetCompactStacked : null]}
        numberOfLines={2}
        maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {row.prescription}
      </Text>
    );
  }

  // No prescription: the slot stays empty rather than holding an instruction.
  // What the record would need in order to fill it is said ONCE, under the
  // title block — not once per row, in the place the reader has learned to
  // find evidence (owner, 28 August 2026).
  return (
    <Text style={[styles.target, styles.targetNone]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
      —
    </Text>
  );
}

/**
 * The athlete's own words, quoted and dated — carried over from the card
 * unchanged. It is the one thing on this screen that is not derived, so it
 * keeps its rule: quote, never infer (§8.1). No number moved because of it.
 */
function Quote({ row }: { row: SessionRow }) {
  if (!row.note) return null;
  return (
    <View style={styles.quote}>
      <Text style={styles.quoteText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {`“${row.note.text}”`}
      </Text>
      <Text style={styles.quoteWho} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {`your note, ${whenLabel(row.note.day, todayKey())}`}
      </Text>
    </View>
  );
}

/**
 * Spelled out in full, and INCLUDING THE REASON — VoiceOver gets the same
 * audit the sighted reader gets, never a target with the evidence left in a
 * colour it cannot see (§14).
 */
function spokenLabel(row: SessionRow, override?: number | null): string {
  const reason = override != null ? null : reasonLine(row);
  return [
    row.name,
    override != null
      ? `your target ${fmtNumber(override)} kilos`
      : row.prescription
        ? `next ${row.prescription}`
        : 'no target yet',
    override != null && row.loadKg != null ? `instead of ${fmtNumber(row.loadKg)}` : '',
    reason ? reason.map((s) => s.text).join('') : '',
    // The lever as a word, for a reader who never sees the tone that carries
    // it — the same phrase the retired chip spoke.
    moveLabel(row.move)?.label.toLowerCase() ?? '',
  ]
    .filter(Boolean)
    .join(', ');
}

const TONE: Record<ReasonTone, { color: string; fontWeight?: '600' }> = {
  plain: { color: color.textSecondary },
  /** The planned magnitude, restated. Same token as the target, same licence:
   * it is a figure nobody has lifted yet. 4.4962:1 on the canvas — see the
   * header: four thousandths under AA at this size, pending the owner. */
  planned: { color: color.signal, fontWeight: '600' },
  /** A plateau, and the size of a backoff. Amber is already the app's colour
   * for both, and the WORDS say it too, so the hue is never the only carrier. */
  watch: { color: color.attention, fontWeight: '600' },
};

const styles = StyleSheet.create({
  /**
   * A CARD (29 August 2026). `surface` on the canvas, `radius.xl` because a
   * card and a sheet are the same kind of object, and `shadow.card` because on
   * this canvas a surface with neither border nor shadow is invisible.
   *
   * The justification against the bare-row default is in the header: Today is
   * the record and stays bare; Next is a plan the app assembled, and the
   * surface is what says the difference. `spacing.sm` of gap between cards —
   * they are a stack, not a scattering.
   */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: moderateScale(64),
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    ...shadow.card,
  },
  rowStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  left: {
    flexShrink: 1,
    flexGrow: 1,
    gap: 2,
  },
  name: {
    ...type.headline,
    color: color.textPrimary,
  },
  right: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 2,
  },
  rightStacked: {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
  },

  // --- the target ----------------------------------------------------------
  /** `lineHeight` matches the name's, so the left and right columns are the
   * same height and their second lines share a baseline. Without it the scheme
   * floated ~4 pt above the reason and the card read as two loose halves. */
  target: {
    ...readingStyle('700'),
    fontSize: moderateScale(22),
    lineHeight: lineFor(22),
    letterSpacing: -0.4,
    textAlign: 'right',
  },
  targetStacked: {
    textAlign: 'left',
    ...FREE_LINE,
  },
  /**
   * NO FIXED LINE BOX ONCE THE TYPE IS SCALING (owner, 30 Aug 2026 — the rep
   * scheme was reading "5·…" at large text sizes, which was not truncation but
   * the glyphs being CUT OFF at the bottom of their line).
   *
   * `lineFor()` scales for the DEVICE, not for Dynamic Type: at the ×1.5 cap a
   * 12.5 pt scheme becomes 18.75 pt inside a 17 pt line box and loses its
   * descenders. The fixed heights exist to put the left and right columns on a
   * shared baseline at normal size; once the row has reflowed to a stack there
   * are no columns to align, so the line box is handed back to the text.
   */
  freeLine: FREE_LINE,
  targetPlanned: {
    color: color.signal,
  },
  /** Overridden: the athlete's own number, in the record's own ink. */
  targetOwn: {
    color: color.textPrimary,
  },
  /** No prescription at all. An em dash holds the column without claiming
   * anything; the reason slot below it stays empty. */
  targetNone: {
    color: color.textMuted,
  },
  unit: {
    fontSize: type.caption.fontSize,
    fontWeight: '400',
  },
  /** How the load is arranged, not a second load — so it stays ink, one step
   * under the number it belongs to. */
  scheme: {
    ...readingStyle('500'),
    fontSize: moderateScale(12.5),
    lineHeight: lineFor(17),
    textAlign: 'right',
    color: color.textSecondary,
  },
  /**
   * The field. A white pill on the canvas, `radius.lg` because a field is a
   * row-shaped control, and it appears only in edit mode — at rest there is no
   * box around the target at all.
   */
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: moderateScale(38),
    paddingLeft: spacing.md,
    paddingRight: spacing.sm + spacing.xs,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
  },
  fieldStacked: {
    alignSelf: 'flex-start',
  },
  fieldInput: {
    minWidth: moderateScale(56),
    paddingVertical: 0,
  },
  /** A line with no separable figure prints whole, one size down. */
  targetCompact: {
    ...readingStyle('700'),
    fontSize: moderateScale(16),
    lineHeight: lineFor(21),
    textAlign: 'right',
    maxWidth: moderateScale(160),
  },
  targetCompactStacked: {
    textAlign: 'left',
    maxWidth: undefined,
  },

  // --- the reason ----------------------------------------------------------
  /**
   * Secondary type, under the target rather than under the name: the reason
   * belongs to the NUMBER, not to the lift. `textSecondary` and not `textMuted`
   * — this line carries information, and *"`textMuted` is for what the eye may
   * skip"*.
   */
  reason: {
    ...readingStyle('400'),
    fontSize: moderateScale(12.5),
    lineHeight: lineFor(17),
    color: color.textSecondary,
  },
  /** An overridden row has no reason to give; it says whose number it is and
   * what the engine had said, so the athlete can argue with it in both
   * directions. Muted: this one IS skippable. */
  yours: {
    color: color.textMuted,
  },

  quote: {
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: color.border,
    gap: 1,
  },
  quoteText: {
    ...type.footnote,
    lineHeight: lineFor(17),
    color: color.textSecondary,
  },
  quoteWho: {
    ...type.caption,
    color: color.textMuted,
  },
});
