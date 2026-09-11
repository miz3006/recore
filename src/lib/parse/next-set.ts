/**
 * "One more set" — the set-by-set logger's shortcut, PURE and runnable under
 * `node --test`.
 *
 * ## The person this exists for (owner, 10 September 2026)
 *
 * Recore's writing surface assumes a session arrives as a sentence: you finish,
 * you type "bench 100x8x3", the parser reads it. A large number of people do
 * not train that way. They do a set of pull-ups, get their breath back, and
 * write the number down; then another set, another number. For them the page
 * asks for the exercise name once per set, and the record fills up with three
 * separate "pull ups" cards that are really one exercise — which is also three
 * cards' worth of wrong in every total that counts exercises.
 *
 * The fix is not a form. Free text stays the primary path (CLAUDE.md §3);
 * what was missing is the touch control that ENRICHES it, which is the same
 * clause that licenses "Fix reading" and the ring. **One tap appends one more
 * set to the line that exercise already owns** — the words go into `raw_text`,
 * where they are visible, editable and exportable like every other word on the
 * page, and the parser re-reads the line as it would any edit.
 *
 * ## What it may and may not write
 *
 * It repeats THE LAST WORKING SET, verbatim, because that is the only number on
 * the page that the athlete has already stood behind. Recore does not predict a
 * set here.
 *
 * **The RIR is deliberately dropped.** Load and reps are a plan a body either
 * meets or does not; reps-in-reserve is a judgement about a set that has not
 * happened yet, and copying it forward would put a feeling into the record that
 * nobody has had (CLAUDE.md §2 — personalise only from chosen information, never
 * fabricate). Same reasoning retires the kind: a repeat of an AMRAP is a plain
 * set until its writer says otherwise.
 *
 * The append is a PROPOSAL in the record's own words: it lands in the line and
 * the line opens for editing, so the common case (same load, different reps) is
 * one tap and one digit rather than retyping the exercise.
 */
import { toDisplayWeight, type WeightUnit } from '../units.ts';

/** The shape `ReceiptRow.working` already hands over — counted sets only. */
export interface RepeatableSet {
  reps: number | null;
  weight_kg: number | null;
  rir: number | null;
}

/**
 * The words one more set would be written as — "80kg x8", "x12" — or null when
 * there is nothing to repeat.
 *
 * REP-BASED WORK ONLY, and that is a scope decision rather than a limitation.
 * The set-by-set habit belongs to lifting and calisthenics; a run or a plank is
 * written once, with its distance or its clock, and "one more 5 km" is not a
 * thing anyone taps. A row with no reps returns null and the affordance simply
 * does not appear, which is a better answer than an append the parser would
 * have to guess at.
 *
 * The load is written in the reader's OWN unit with the unit spelled out. A
 * bare number would inherit whatever convention the rest of the line used, and
 * the line is the record: a set that means 80 kg must not be able to read as
 * 80 lb because of where it sits.
 */
export function repeatSetText(working: RepeatableSet[], unit: WeightUnit): string | null {
  // The last set with reps is the one being repeated — `working` is already
  // free of warm-ups and drops, so this is the last real set of the exercise.
  for (let i = working.length - 1; i >= 0; i--) {
    const set = working[i]!;
    if (set.reps == null || set.reps <= 0) continue;
    if (set.weight_kg == null) return `x${set.reps}`;
    const load = toDisplayWeight(set.weight_kg, unit);
    // Trim the trailing zero a conversion leaves behind — "82.5kg", "180lb",
    // never "180.0lb" (skill: format numbers like a product, not a database).
    const text = String(Math.round(load * 100) / 100);
    return `${text}${unit} x${set.reps}`;
  }
  return null;
}

/**
 * That set, appended to the line it belongs to. Null when there is nothing to
 * repeat, so a caller can hide the control rather than offer a dead one.
 *
 * The separator is a comma, which is what the parser's own examples are written
 * with ("deadlift warm up 60x5, 100x3") and what a person writing a list would
 * reach for anyway. A line that already ends in one does not get a second.
 */
export function appendRepeatSet(
  line: string,
  working: RepeatableSet[],
  unit: WeightUnit,
): string | null {
  const text = repeatSetText(working, unit);
  if (text == null) return null;
  const base = line.replace(/[\s,;]+$/, '');
  if (!base) return null;
  return `${base}, ${text}`;
}
