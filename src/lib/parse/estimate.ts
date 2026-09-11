/**
 * Instant, text-only volume estimate for the bottom-toolbar pill while a line
 * hasn't been parsed yet. The moment the edge function returns, the pill
 * switches to the real parsed volume (warm-ups excluded). This is display
 * garnish only — it never writes to the database.
 *
 * ## IT READS THE LINE NOW, INSTEAD OF PATTERN-MATCHING IT (11 September 2026)
 *
 * The pairs grammar below was written when this file was the only offline
 * reader in the app. It is not any more: `lib/demo-parse.ts` is a real
 * line grammar — it already understands rep lists, `serije po`, spelled-out
 * numbers, per-set effort markers and inline supersets — and the onboarding
 * demo has been reading with it since August.
 *
 * Scored against the eval corpus's own expectations, over the 22 cases that
 * state enough to compute a tonnage: **the grammar is within 2% on 19, the
 * pairs regex on 14**, and the regex is closer on **none** of them — five wins,
 * seventeen ties, zero losses. So the estimate now asks the grammar first.
 *
 * This matters most exactly when it is least convenient. On 11 September the
 * provider refused every call for the whole day; a person writing a session saw
 * whatever this function could work out and nothing else. "Instant" and "still
 * there when the model is not" are the same property, and it is worth having
 * the better reader behind it.
 *
 * The pairs grammar stays as the floor: when the line grammar finds no loaded
 * working set at all, the old answer is used, so coverage can only grow. What
 * this file may do is unchanged — it computes a NUMBER FOR THE PILL from the
 * person's own words, names nothing, and writes nothing.
 */
import { demoParseText } from '../demo-parse.ts';
/** Every "A×B" on a line, with the unit A was written with. */
const PAIR = /(\d+(?:[.,]\d+)?)\s*(kgs?|lbs?)?\s*[x×]\s*(\d+)\b/gi;

/**
 * Above this a bare left-hand number is a LOAD, below it a set count — the same
 * judgement `lib/demo-read.ts` makes, for the same reason: "140x3" is three
 * reps at 140 and "3x8" is three sets of eight, and only the sizes tell them
 * apart.
 */
const LOAD_FLOOR = 25;
const LB_PER_KG = 2.2046226218;

/** Group digits with thousands commas: 2040 -> "2,040". */
export function groupThousands(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

interface Pair {
  left: number;
  unit: 'kg' | 'lb' | null;
  right: number;
  at: number;
  length: number;
}

function pairsIn(line: string): Pair[] {
  const out: Pair[] = [];
  PAIR.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PAIR.exec(line)) !== null) {
    const unit = m[2]?.toLowerCase().startsWith('lb') ? 'lb' : m[2] ? 'kg' : null;
    out.push({
      left: Number.parseFloat(m[1]!.replace(',', '.')),
      unit,
      right: Number.parseInt(m[3]!, 10),
      at: m.index,
      length: m[0].length,
    });
  }
  return out;
}

/**
 * The load a line states OUTSIDE its set notation.
 *
 * The old version looked for `\b\d+\b`, and there is no word boundary between
 * the 0 and the x of "100x5" — so every line that glued its load to its reps
 * ("deadlift 60x5 100x5 140x3", "squat 120kgx10") estimated as ZERO and the
 * toolbar pill showed a staged session with no tonnage at all until the parse
 * came back.
 */
function extractWeight(line: string, pairs: readonly Pair[]): number | null {
  const kg = line.match(/(\d+(?:[.,]\d+)?)\s*(?:kgs?|kilos?)\b/i);
  if (kg) return Number.parseFloat(kg[1]!.replace(',', '.'));
  const lb = line.match(/(\d+(?:[.,]\d+)?)\s*(?:lbs?|pounds?)\b/i);
  if (lb) return Number.parseFloat(lb[1]!.replace(',', '.')) / LB_PER_KG;

  // Whatever the set notation already spoke for is not the load.
  let stripped = line;
  for (const p of pairs) stripped = stripped.replace(line.slice(p.at, p.at + p.length), ' ');
  const numbers = (stripped.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) =>
    Number.parseFloat(n.replace(',', '.')),
  );
  const heavy = numbers.filter((n) => n >= LOAD_FLOOR);
  return heavy.length ? Math.max(...heavy) : null;
}

/**
 * One line's tonnage, read the way the parser reads a line and not one step
 * further: pairs whose left side is a load are one set each ("100x8 90x10" is
 * 800 + 900), pairs whose left side is a count are sets of reps at whatever
 * load the line states elsewhere ("bench 2x8 1x6 100kg" is 22 reps at 100).
 * Bodyweight work has no tonnage and contributes nothing, which is the same
 * answer `parsedVolume` gives it.
 */
function lineVolume(line: string): number {
  const t = line.trim();
  if (!t) return 0;
  const pairs = pairsIn(t);
  if (pairs.length === 0) return 0;

  const kgOf = (p: Pair) => (p.unit === 'lb' ? p.left / LB_PER_KG : p.left);
  const asLoad = pairs.some((p) => p.unit != null) || pairs.every((p) => p.left >= LOAD_FLOOR);
  if (asLoad) {
    return Math.round(pairs.reduce((sum, p) => sum + kgOf(p) * p.right, 0));
  }

  const weight = extractWeight(t, pairs);
  if (weight != null) return Math.round(pairs.reduce((sum, p) => sum + p.left * p.right, 0) * weight);

  // No load written anywhere. If NEITHER side of every pair is small enough to
  // be a set count, the left one is a load after all ("kb swing 24 x20" is
  // twenty reps at 24 kg) — the last rung of the parser's own ladder.
  const counted = pairs.every((p) => p.left <= 10) || pairs.every((p) => p.right <= 10);
  if (counted) return 0;
  return Math.round(pairs.reduce((sum, p) => sum + kgOf(p) * p.right, 0));
}

/** The pairs-grammar answer — the floor, and what this file used to be. */
function pairsEstimate(note: string): number {
  return note.split('\n').reduce((sum, line) => sum + lineVolume(line), 0);
}

export function estimateVolume(note: string): number {
  // Working sets only, reps x kg — the same sum `parsedVolume` reports, so the
  // pill does not jump when the real reading lands on a line both agree about.
  let read = 0;
  for (const item of demoParseText(note).items) {
    for (const set of item.sets) {
      if (set.kind === 'warmup') continue;
      if (set.reps != null && set.weight_kg != null) read += set.reps * set.weight_kg;
    }
  }
  return read > 0 ? Math.round(read) : pairsEstimate(note);
}
