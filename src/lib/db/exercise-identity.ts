// Relative + .ts extension: this file is BOTH bundled by Metro AND run under
// `node --test` — the same pattern as demo-read.ts. It is deliberately PURE
// (no SQLite, no imports from `db/index`) so the decision that gives a written
// movement its identity can be tested without a device.

/**
 * WHICH EXERCISE ROW A READING BELONGS TO — the identity decision behind
 * `resolveExercise`, and the one behind merging a duplicate away on pull.
 *
 * ## Why this is not just a string compare
 *
 * The parser answers with a canonical name ("Diamond Push-up") and the exact
 * words the person typed ("diamond push ups"). The catalogue holds rows that
 * have LEARNED shorthand over time: "bench", "bp", "flyes". Resolution has to
 * use both, and the two can disagree — which is where the damage lives.
 *
 * A row matched only by a learned alias can be a DIFFERENT MOVEMENT from the
 * one the parser named: "diamond push ups" carries the alias "push ups", which
 * is already learned on `Push-up`, so the reading resolves to plain push-ups
 * and the alias is learned onto that row for ever. Two movements then share one
 * history, one chart and one PR — and unlike a duplicate row, the user cannot
 * undo it from the aliases screen, because nothing looks wrong there.
 *
 * So an alias match has to AGREE with the parser about which movement this is
 * (`sameMovement`), and a canonical match always outranks an alias match.
 * Splitting a movement in two is recoverable — the aliases screen exists for
 * exactly that — and merging two into one is not.
 */

/** Trim, fold case, collapse whitespace — the comparison every lookup uses. */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * The words a movement's name is made of, normalised so that spelling does not
 * decide identity: "Push-up", "push ups" and "PUSH UPS" are all `push up`, and
 * "Chest Press Machine" and "Machine Chest Press" are the same set of words.
 *
 * The plural rule is the fiddly part and it is deliberately conservative: an
 * `-es` only comes off when what is left still ends in a hiss ("presses" →
 * "press", "crunches" → "crunch", "boxes" → "box"), and a plain `-s` only off
 * a word of three letters or more that does not already end in one ("dips" →
 * "dip", "raises" → "raise", while "press" and "bus" are left alone).
 */
export function nameWords(name: string): string[] {
  return normalizeName(name)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((w) => w.length > 0)
    .map(singular)
    .sort();
}

function singular(word: string): string {
  if (word.length >= 4 && word.endsWith('es')) {
    const stem = word.slice(0, -2);
    if (/(ss|x|z|ch|sh)$/.test(stem)) return stem;
  }
  if (word.length >= 3 && word.endsWith('s') && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

/** Do two names describe the SAME movement, spelling aside? */
export function sameMovement(a: string, b: string): boolean {
  const left = nameWords(a);
  const right = nameWords(b);
  return left.length === right.length && left.every((w, i) => w === right[i]);
}

/** What a lookup needs to know about one row of the catalogue. */
export interface ExerciseCandidate {
  canonical: string;
  aliases: readonly string[];
}

/**
 * The index of the row a reading belongs to, or null when none of them does
 * and a new row has to be created. `rows` arrive in priority order — the
 * user's own before the global catalogue.
 *
 * Two passes, and the order is the whole point:
 *
 *  1. **The name the parser gave it.** A row whose canonical (or one of whose
 *     aliases) IS that name is the row, full stop.
 *  2. **The shorthand the person typed**, but only for a row that names the
 *     same movement. Without that condition "diamond push ups" lands on
 *     `Push-up` and takes its shorthand with it.
 */
export function pickExercise(
  rows: readonly ExerciseCandidate[],
  canonical: string,
  aliasesSeen: readonly string[],
): number | null {
  const namesOf = (row: ExerciseCandidate) =>
    new Set([normalizeName(row.canonical), ...row.aliases.map(normalizeName)]);

  const wanted = normalizeName(canonical);
  if (wanted) {
    for (let i = 0; i < rows.length; i++) {
      if (namesOf(rows[i]!).has(wanted)) return i;
    }
  }

  const typed = aliasesSeen.map(normalizeName).filter(Boolean);
  if (typed.length === 0 || !wanted) return null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const names = namesOf(row);
    if (!typed.some((t) => names.has(t))) continue;
    if (sameMovement(row.canonical, canonical)) return i;
  }
  return null;
}

/** One row of the catalogue as a duplicate check sees it. */
export interface MergeCandidate {
  id: string;
  canonical: string;
  /** How many items point at this row — the history it would take with it. */
  items: number;
  /** Rows the device made itself are the ones that duplicate a synced row. */
  local: boolean;
}

/**
 * WHICH DUPLICATE SURVIVES.
 *
 * A device whose catalogue is empty — a fresh install, a restored account, a
 * wiped database — resolves every reading against nothing and creates its own
 * row for a movement the account already has. Both then exist: the same
 * canonical name twice, with the history split between them.
 *
 * The survivor is the row with the most history behind it; a tie goes to the
 * SYNCED row, because the other devices already point at it. The rest are
 * merged into it (their items re-pointed, their aliases carried over).
 */
export function survivorOf(rows: readonly MergeCandidate[]): MergeCandidate | null {
  if (rows.length === 0) return null;
  return rows.reduce((best, row) => {
    if (row.items !== best.items) return row.items > best.items ? row : best;
    if (row.local !== best.local) return best.local ? row : best;
    return best.id <= row.id ? best : row;
  });
}

/** Every group of rows that name one movement more than once, survivor first. */
export function duplicateGroups(rows: readonly MergeCandidate[]): MergeCandidate[][] {
  const groups = new Map<string, MergeCandidate[]>();
  for (const row of rows) {
    const key = nameWords(row.canonical).join(' ');
    if (!key) continue;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  const out: MergeCandidate[][] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const keep = survivorOf(group)!;
    out.push([keep, ...group.filter((r) => r.id !== keep.id)]);
  }
  return out;
}

/** What a device may fold away on its own, and into which row. */
export interface MergeStep {
  keep: MergeCandidate;
  losers: MergeCandidate[];
}

/**
 * THE MERGES A DEVICE MAY MAKE BY ITSELF, after a pull.
 *
 * A device may only fold away a row IT INVENTED — one the pull did not confirm.
 * Deleting a row the account really has would be undone by the very next pull
 * (which brings it straight back) and the two would fight for ever, once per
 * sync pass. Duplicates that BOTH live in the account are an account-level
 * repair, not a device one: `scripts/dedupe-exercises.ts` re-points them where
 * they live, and every device then folds its own copy away here.
 *
 * When the group holds a confirmed row, that row keeps the movement — the other
 * devices already point at it, whatever the local item counts say.
 */
export function mergePlan(rows: readonly MergeCandidate[]): MergeStep[] {
  const steps: MergeStep[] = [];
  for (const group of duplicateGroups(rows)) {
    const confirmed = group.filter((r) => !r.local);
    const invented = group.filter((r) => r.local);
    if (invented.length === 0) continue;
    const keep = confirmed.length > 0 ? survivorOf(confirmed)! : survivorOf(invented)!;
    const losers = invented.filter((r) => r.id !== keep.id);
    if (losers.length > 0) steps.push({ keep, losers });
  }
  return steps;
}
