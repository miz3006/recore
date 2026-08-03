/**
 * Effort marking — PURE, zero imports, runs under `node --test`.
 *
 * WHY IT WRITES INTO THE NOTE. RIR is already load-bearing in the engine: rule 2
 * adds weight the moment the athlete had ≥ 2 in reserve (§8.1), and `whyFor`
 * quotes it back ("3 left in reserve at 100"). Today the only way it gets in is
 * if the user types it themselves, so that rule almost never fires.
 *
 * There were two ways to fix that, and the choice matters:
 *
 *   1. An overlay table, like `done-state.ts`, re-applied after every
 *      projection. Rejected: it makes effort a SECOND source of truth for
 *      `sets.rir`, it does not survive into the export or the sync, and
 *      `applyParseResult` would be fighting it forever.
 *   2. Append the marker to the line, and let the parser read it like any other
 *      word. Chosen — because §1.1 invariant 1 says the words ARE the record,
 *      and effort is a thing a lifter genuinely writes. "rpe 8" is not app
 *      metadata; it is training notation, and the prompt already reads it
 *      (RPE → rir = 10 − RPE).
 *
 * So one tap appends five characters to a line the user wrote, exactly as
 * `checkGhostLine` writes a prescribed line into the note. Nothing is stored
 * anywhere else, nothing needs re-applying, and it exports, syncs and re-parses
 * for free.
 *
 * The app only ever touches the RPE token. Everything else on the line is left
 * exactly as typed.
 */
export type Effort = 'easy' | 'moderate' | 'hard' | 'max';

export const EFFORTS: Effort[] = ['easy', 'moderate', 'hard', 'max'];

/** RPE, which the parser turns into `rir = 10 − RPE`. */
export const EFFORT_RPE: Record<Effort, number> = {
  easy: 7, // rir 3 → the engine adds weight
  moderate: 8, // rir 2 → the engine adds weight
  hard: 9, // rir 1 → same weight, chase a rep
  max: 10, // rir 0 → same weight
};

/**
 * The words on the buttons. Plain and physical — no "crushed it", no scale of
 * faces (§15, §20). "Max" is the honest word for RPE 10; "all-out" reads like
 * praise.
 */
export const EFFORT_LABEL: Record<Effort, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
  max: 'Max',
};

/** What each one means, said once, so the scale is not folklore. */
export const EFFORT_HINT: Record<Effort, string> = {
  easy: 'three or more left',
  moderate: 'two left',
  hard: 'one left',
  max: 'nothing left',
};

export function effortToken(effort: Effort): string {
  return `rpe ${EFFORT_RPE[effort]}`;
}

/**
 * Any RPE marker on the line, in either notation the parser accepts — the
 * app's own `rpe 8` and the `@8` a lifter types. Read-only: this is how the
 * sheet shows what is already there instead of asking twice.
 *
 * `@` IS ALSO HOW A LIFTER WRITES A LOAD — "bench 3x8 @100kg" — so the value has
 * to look like an RPE and like nothing else: 1 to 10, at most one decimal, and
 * never followed by another digit, another decimal, or a unit. Without those
 * three exclusions `@100kg` read as RPE 10 and `setEffortOnLine` stripped the
 * "@10" back out of the line, turning 100 kg into `0kg` — the app destroying the
 * user's own words in the one function that is allowed to touch them
 * (§1.1 invariant 1). `@8kg` is therefore a load too, not an effort.
 */
const RPE_RE =
  /(?:\brpe\s*|@\s*)(10(?:[.,]0)?|[1-9](?:[.,]\d)?)(?!\d|[.,]\d|\s*(?:kgs?|lbs?)\b)/i;

export function readEffort(line: string): Effort | null {
  const m = RPE_RE.exec(line);
  if (!m) return null;
  const rpe = Number.parseFloat(m[1]!.replace(',', '.'));
  if (!Number.isFinite(rpe)) return null;
  // Round to the nearest step on the scale; anything under 7 is still "easy",
  // because the engine treats every rir ≥ 3 the same way.
  if (rpe >= 9.5) return 'max';
  if (rpe >= 8.5) return 'hard';
  if (rpe >= 7.5) return 'moderate';
  return 'easy';
}

/**
 * Add, replace or remove the effort marker on one physical line.
 *
 * Replacing touches the marker and nothing else — a `@8` the user typed becomes
 * `rpe 9` only because they just asked for that, on that line. Passing null
 * clears it, so a mis-tap is undoable without editing text by hand.
 */
export function setEffortOnLine(line: string, effort: Effort | null): string {
  const stripped = line.replace(RPE_RE, '').replace(/\s{2,}/g, ' ').trimEnd();
  if (effort === null) return stripped;
  if (stripped.trim().length === 0) return stripped;
  return `${stripped} ${effortToken(effort)}`;
}
