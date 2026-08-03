import { insertCorrection } from '@/lib/db/corrections';
import {
  createUserExercise,
  findExerciseByName,
  removeAliasFromUserExercises,
} from '@/lib/db/exercises';
import { setAliasOverride } from '@/lib/db/alias-overrides';
import { bumpCorrections } from '@/lib/funnel';
import { recachePrediction } from '@/lib/predict/cache';

import { applyParseResult, getParseCache } from './apply';
import { validateParseResult, type ParsedItem, type ParsedSet } from './types';

/**
 * Parse correction flow (CLAUDE.md §6.2) — the flywheel. Long-press a gutter
 * value → fix the fields → this module makes the fix REAL three times over:
 *  1. NOW: rebuilds this workout's structure with the corrected item (via the
 *     correction overlay inside applyParseResult) and refreshes the ghost.
 *  2. FOREVER ON THIS NOTE: the stored correction row re-applies on every
 *     future re-parse of the same line text.
 *  3. FOREVER EVERYWHERE: if the exercise was wrong, the user's typed
 *     shorthand becomes an alias override — every future note resolves it to
 *     the exercise the user actually meant, and the row is training data for
 *     the eval set.
 */
export interface FixTarget {
  workoutId: string;
  line: number;
  lineText: string;
  item: ParsedItem;
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** The first parsed item on a physical line — what a long-press edits. */
export function getFixTarget(workoutId: string, line: number): FixTarget | null {
  const cache = getParseCache(workoutId);
  if (!cache) return null;

  let items: ParsedItem[];
  try {
    const result = validateParseResult(JSON.parse(cache.result_json));
    if (!result) return null;
    items = result.items;
  } catch {
    return null;
  }

  const item = items.find((i) => i.line === line);
  if (!item) return null;

  const lineText = (cache.raw_snapshot.split('\n')[line] ?? '').trim();
  if (!lineText) return null;

  return { workoutId, line, lineText, item };
}

export interface CorrectionSubmit {
  exercise: string;
  sets: ParsedSet[];
}

/** Persist one correction and rebuild the workout from it. Returns true when
 * something actually changed (the caller then refreshes UI state). */
export function applyCorrection(
  userId: string,
  target: FixTarget,
  submit: CorrectionSubmit,
): boolean {
  const cache = getParseCache(target.workoutId);
  if (!cache) return false;

  const result = (() => {
    try {
      return validateParseResult(JSON.parse(cache.result_json));
    } catch {
      return null;
    }
  })();
  if (!result) return false;

  // Re-find the item — a background re-parse may have landed since the sheet
  // opened. Same line, same exercise = still the thing the user was fixing.
  const before = result.items.find(
    (i) => i.line === target.line && i.exercise === target.item.exercise,
  );
  if (!before) return false;

  const exercise = submit.exercise.trim().slice(0, 120);
  if (!exercise) return false;

  const after: ParsedItem = { ...before, exercise, sets: submit.sets };

  const exerciseChanged = normalize(exercise) !== normalize(before.exercise);
  const setsChanged = JSON.stringify(after.sets) !== JSON.stringify(before.sets);
  if (!exerciseChanged && !setsChanged) return false;

  // 1. The training-data row — also what the overlay re-applies on re-parse.
  insertCorrection(userId, target.workoutId, target.lineText, before, after);
  // The repair rate's numerator (§2.1, PLAN D4) — local counter, no SDK.
  bumpCorrections();

  // 2. Alias learning: the typed shorthand now ALWAYS means the corrected
  //    exercise — as an override, so it works for global rows too, and the
  //    mis-learned alias is scrubbed from the user's own rows.
  if (exerciseChanged) {
    const targetRow = findExerciseByName(userId, exercise);
    const targetId =
      targetRow?.id ?? createUserExercise(userId, exercise, before.aliases_seen, before.modality);
    for (const alias of before.aliases_seen.map(normalize)) {
      if (!alias) continue;
      setAliasOverride(userId, alias, targetId);
      removeAliasFromUserExercises(userId, alias, targetId);
    }
  }

  // 3. Rebuild structure + gutter from the cached result — the overlay inside
  //    applyParseResult picks up the new correction — and refresh the ghost so
  //    a fixed weight flows into tomorrow's prescription.
  applyParseResult(userId, target.workoutId, cache.raw_snapshot, result);
  recachePrediction(userId, target.workoutId);
  return true;
}
