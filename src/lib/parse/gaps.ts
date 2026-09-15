// Relative + .ts extension: this file is bundled by Metro AND run under
// `node --test`, which cannot resolve the `@/` alias or an extensionless path.
import { nameKey } from './receipt.ts';
import type { SetTable } from './summarize.ts';

/**
 * WHAT A READING IS MISSING — named, never guessed (15 September 2026).
 *
 * The parse waits for the checkmark now, which makes each reading a deliberate
 * answer — and an answer is allowed to say "this line did not state enough".
 * The parser itself never fills a gap (a set with no reps stays a set with no
 * reps; CLAUDE.md §3 — nothing invents a number), so the gap has to be POINTED
 * AT or the athlete only discovers it weeks later, when a session is missing
 * from a total it should have moved.
 *
 * Everything here is deterministic code over the parsed table and the written
 * line — the model is not asked, and no gap is ever written into the record.
 * It is a label on the projection, rebuilt with it.
 *
 * THE RULE ON CONFIDENCE: a gap is only named when it is provable from what is
 * on the page. A bench press with a load and no reps IS missing its reps —
 * there is no reading of "bench 120" that has counted anything. But "pull ups
 * 3x8" with no load is a complete record of bodyweight work, so "weight
 * missing" is only ever said about movements that cannot be done unloaded
 * (the barbell and machine lifts below). Everything unprovable stays silent:
 * a wrong warning costs more trust than a missing one.
 */

export type ReadingGap = 'reps' | 'weight';

/** How a settled line with NO reading should be described. */
export type UnreadLineGap =
  /** Pure set notation, no exercise named anywhere the parser could bind it. */
  | 'no-exercise'
  /** A known exercise name with no set information at all. */
  | 'no-sets'
  /** A known exercise plus numbers the parser could not read as sets. */
  | 'unread';

/**
 * The words a line may be made of and still record NOTHING BUT SETS — units,
 * scheme words, effort markers. A line whose letters are all in this set
 * cannot name an exercise, which is what makes it a CONTINUATION line ("120
 * 10" under "bench 120 12") — or, with nothing above it, an orphan the parser
 * rightly refuses.
 */
const NOTATION_WORDS = new Set([
  // units
  'kg', 'kgs', 'kilo', 'kilos', 'kil', 'kilogramov', 'lb', 'lbs',
  'm', 'km', 's', 'sek', 'sec', 'min', 'h',
  // scheme words, English and Slovene
  'x', 'reps', 'rep', 'set', 'sets', 'of', 'serije', 'serija', 'serij',
  'ponovitev', 'ponovitve', 'ponovitvi', 'po',
  // effort and bodyweight markers
  'rir', 'rpe', 'bw', 'amrap',
]);

/**
 * Is this line bare set notation — numbers and scheme words with no exercise
 * in it? "120 10", "100x8", "x12", "80kg 8/7/6", "3x8 @8" are; "bench 120"
 * and "utrujen sem danes" are not. A line with no digits is never notation:
 * there is nothing recorded on it to attribute.
 */
export function bareNotationLine(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!/\d/.test(t)) return false;
  const words = t.replace(/[^\p{L}]+/gu, ' ').trim();
  if (words.length === 0) return true;
  return words.split(' ').every((w) => NOTATION_WORDS.has(w));
}

/**
 * Movements that cannot be performed unloaded — the barbell and machine lifts
 * whose reading WITHOUT a weight is provably incomplete rather than
 * bodyweight work. Keyed by `nameKey` so the model's canonical names land
 * exactly; anything not listed stays silent (dips, pull-ups, curls with a
 * band — all real unloaded work, none of them a gap).
 */
const LOADED_LIFTS = new Set(
  [
    'Bench Press',
    'Incline Bench Press',
    'Decline Bench Press',
    'Close Grip Bench Press',
    'Squat',
    'Front Squat',
    'Hack Squat',
    'Deadlift',
    'Romanian Deadlift',
    'Sumo Deadlift',
    'Overhead Press',
    'Barbell Row',
    'Pendlay Row',
    'Seated Cable Row',
    'Lat Pulldown',
    'Leg Press',
    'Leg Extension',
    'Leg Curl',
    'Hip Thrust',
    'Triceps Pushdown',
  ].map(nameKey),
);

/**
 * What one exercise's reading is missing, from the same table the card
 * renders. Null means the reading is complete — or that its completeness
 * cannot be judged, which renders the same way: silence.
 *
 *  · 'reps'   — a counted set carries a load and no work at all ("bench 120"
 *               read as 120 kg of nothing). Provable for any movement: a load
 *               was lifted some number of times, and the line did not say how
 *               many.
 *  · 'weight' — every counted set is unloaded on a movement that cannot be
 *               ("bench 12" read as 12 reps of an unloaded barbell press).
 *               Only ever said about `LOADED_LIFTS`.
 */
export function gapOfTable(exercise: string, table: SetTable): ReadingGap | null {
  const counted = table.rows.filter((r) => r.counted);
  if (counted.length === 0) return null;

  if (counted.some((r) => r.load !== '' && r.load !== 'bw' && r.work === '')) return 'reps';

  if (
    table.loadHead === null &&
    LOADED_LIFTS.has(nameKey(exercise)) &&
    counted.some((r) => r.work !== '')
  ) {
    return 'weight';
  }

  return null;
}

/**
 * How to describe a settled, freshly-parsed line that produced NO reading.
 * `knownExercise` is the caller's answer to "do the words before the first
 * digit name an exercise this athlete's record knows" — a database question,
 * kept out of this pure module. Null = ordinary prose, which the ledger
 * already keeps as a note.
 */
export function gapOfUnreadLine(rawLine: string, knownExercise: boolean): UnreadLineGap | null {
  if (bareNotationLine(rawLine)) return 'no-exercise';
  if (!knownExercise) return null;
  return /\d/.test(rawLine) ? 'unread' : 'no-sets';
}
