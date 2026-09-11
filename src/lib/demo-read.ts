// Relative + .ts extension: this file is BOTH bundled by Metro AND run under
// `node --test` — the same pattern as onboarding.ts and demo-parse.ts.
import { LB_PER_KG } from './onboarding.ts';
import type { SetKind } from './parse/types.ts';

/**
 * THE OFFLINE READING ENGINE — what the onboarding demo screen reads a written
 * line with, before an account exists (owner, 23 Aug 2026: "use the same parser
 * logic as in Today, it does not read well").
 *
 * ## Why this file exists at all
 *
 * Today's parser is `parse-workout`, an edge function: a model, a user JWT
 * (§7.3, `verify_jwt` plus an explicit `getUser()` inside the function), a saved
 * `workouts` row to attach the result to, and a network round trip. On the
 * fourth screen of the funnel there is no account, so that path returns 401 by
 * design and no amount of wiring changes it.
 *
 * What CAN be shared is everything on either side of the read, and it is:
 * the demo produces the app's own `ParseResult` (`demo-parse.ts`), and Today's
 * `buildReceipt` → `SetTable` renders it. This file is the middle piece — the
 * one part that has to be written twice — and its job is to make the reading
 * good enough that the difference does not show on that screen.
 *
 * ## It is measured, not asserted
 *
 * `scripts/parse-eval-cases.json` is the corpus the REAL parser is evaluated
 * against — 79 lines of how people actually write, English and Slovene. This
 * engine is scored against the same file (`demo-read.test.ts`), which is what
 * turns "it reads well now" into a number that a later change cannot quietly
 * undo. It will never score what a model scores, and it is not supposed to: the
 * cases it deliberately does not chase are named in the test.
 *
 * ## The rules, in the order they are tried
 *
 * Every rule is a shape people actually write, and the ORDER is the whole
 * design — the ambiguity in this grammar is real ("100x8" is a load and reps,
 * "3x8" is sets and reps, and only the sizes tell them apart), so the more
 * specific pattern has to be asked first.
 *
 *   1. laps of a distance        4x50m · 5x400m · 20m x4
 *   2. efforts of a time         5x10s · 3x45 sec · 4x2 min · 30s x4
 *   3. repeated `W×R` pairs      100x8 90x10 80x12 · 140x5, 160x3, 180x1
 *   4. `W×R×S`                   185x5x3 · 100kg x12 x3 · 100kg x5 reps x3 sets
 *   5. a rep list                100kg 5,5,4 · 80kg 8/7/6 · 21-15-9 · 12,10,8
 *   6. one `A×B`                 3x8 · 5x5 · 100kgx5 · 15x2
 *   7. distance and time         400m · 2,5km · plank 60s · 30 min · 5k 28:30
 *   8. spaced reps               100kg 8 8 8
 *   9. words                     4 serije po 10 · 3 sets of 8 · 5 ponovitev
 *  10. one count                 bench 5 80kg · deadlift 180 x3 · curls 12 15kg
 *
 * A segment nothing matches produces no sets, and a LINE with no sets is kept
 * on the page as the words the person wrote — never an error, never a guess.
 *
 * ## What the LOAD is, once the sets are known
 *
 * A number wearing kg or lb is the load outright. Otherwise the biggest bare
 * number the rep scheme did not already spend, if it is heavy enough to be one
 * (`LOAD_FLOOR`) — and failing that, a light bare number sitting where the load
 * goes, right after the movement's name ("cable fly 15 3x15" is fifteen
 * kilograms for fifteen). Nothing is ever counted twice: "squats x30" is thirty
 * reps and no weight at all.
 */

/** One set, in the shape `demo-parse.ts` turns into a `ParsedSet`. */
export interface ReadSet {
  kind: SetKind;
  reps: number | null;
  weightKg: number | null;
  distanceM: number | null;
  durationS: number | null;
  rir: number | null;
}

/** One exercise off one written line. */
export interface ReadItem {
  /** The movement, in the person's own words unless an alias resolved it. */
  name: string;
  /** The unit the LINE was written in — display only; loads are always kg. */
  unit: 'kg' | 'lb';
  sets: ReadSet[];
}

// --- bounds -------------------------------------------------------------------
// Wider than any control in the app: this reads what a person WROTE, and
// refusing a real 260 kg deadlift would be worse than accepting an unlikely one.

const MAX_KG = 500;
const MAX_LB = 1100;
const MAX_REPS = 100;
const MAX_SETS = 20;
/** Above this a bare number in a pair is a LOAD, below it a set count. Nobody
 * writes 25 sets, and nobody benches 25 in a pair notation that means sets. */
const LOAD_FLOOR = 25;

// --- vocabulary ---------------------------------------------------------------

/**
 * The lifts the key-lift screen offers, with the shorthand people actually
 * type. Canonical names are spelled EXACTLY as `KEY_LIFTS` in the flow config,
 * so a demo line can pre-select a chip by string equality.
 *
 * A MATCH IS THE WHOLE NAME, never a fragment of it (23 Aug 2026). It used to
 * match a contained alias, which turned "incline bench" into "Bench press" and
 * "close grip bench" into "Bench press" — renaming somebody's movement to a
 * different movement, which is worse than not resolving it at all. Anything
 * with a qualifier keeps the person's own words.
 */
const LIFT_ALIASES: Record<string, readonly string[]> = {
  'Bench press': ['bench', 'bench press', 'benchpress', 'bp', 'flat bench', 'barbell bench', 'potisk s prsi', 'potisk s prsmi'],
  Squat: ['squat', 'squats', 'back squat', 'bs', 'barbell squat', 'pocep', 'počep', 'pocepi', 'počepi'],
  Deadlift: ['deadlift', 'deadlifts', 'dl', 'conventional deadlift', 'mrtvi dvig'],
  'Overhead press': ['ohp', 'overhead press', 'shoulder press', 'military press', 'ramenski potisk'],
  // A CHIN-UP IS NOT A PULL-UP. It used to resolve to one, which merged two
  // movements a person trains apart — the app's own exercise table keeps them
  // separate ("chin up → Chin-up"), and so does this.
  'Pull-ups': ['pull up', 'pull ups', 'pullup', 'pullups', 'pull-up', 'pull-ups', 'zgibi'],
  // "pendlay row" is NOT here: it is a barbell row done from a dead stop, and
  // the app's own parser answers "Pendlay Row" for it. Renaming it to the plain
  // row merges two movements a person trains apart.
  'Barbell row': ['row', 'rows', 'barbell row', 'bb row', 'bent over row', 'veslanje z drogom'],
};

/**
 * Words that open a CONTINUATION of the exercise before them rather than a new
 * movement: "…, then 100kg 5x5", "…, potem 60kg 3x8", "… + myo 5,5,4".
 *
 * Without this the segment splitter invents exercises called "Then" and "Myo"
 * and hangs the second half of somebody's set on them — which is not a missed
 * read, it is a wrong one, and a wrong read is the only kind this screen may
 * not produce.
 */
const CONTINUATIONS: Record<string, SetKind> = {
  then: 'working',
  potem: 'working',
  nato: 'working',
  after: 'working',
  also: 'working',
  plus: 'working',
  drop: 'drop',
  dropset: 'drop',
  dropped: 'drop',
  myo: 'myo',
  myoreps: 'myo',
  rest: 'myo',
  amrap: 'amrap',
  // Openers of a REMARK about the set just written, not of a new movement:
  // "front lever holds, best was 12s", "curls 15kg to failure, got 12".
  got: 'working',
  best: 'working',
  total: 'working',
  skupaj: 'working',
};

/** Words in front of the numbers that say what KIND of work follows. */
const KIND_WORDS: { test: RegExp; kind: SetKind }[] = [
  { test: /\b(warm\s?ups?|warmup|wu|ogrevanj\w*)\b/i, kind: 'warmup' },
  { test: /\b(drop\s?sets?|dropset)\b/i, kind: 'drop' },
  { test: /\bmyo\b/i, kind: 'myo' },
  { test: /\bamrap\b/i, kind: 'amrap' },
  { test: /\b(to failure|do odpovedi|čez odpoved|cez odpoved)\b/i, kind: 'failure' },
];

/**
 * Words at either end of a name that are not part of a movement's name.
 *
 * "bar" IS NOT ONE OF THEM any more: it took the bar off "toes to bar" and left
 * a movement called "Toes to". The empty bar — the reason it was ever in this
 * list — is handled where it belongs, as the twenty kilograms it is
 * (`EMPTY_BAR` in `normalise`).
 */
const NAME_NOISE = new Set([
  'bw', 'bodyweight', 'just', 'the', 'each', 'na', 'nogo', 'per', 'side',
  'sem', 'naredil', 'danes', 'z', 's', 'in', 'and', 'with', 'x',
]);

/**
 * WHICH END A NOISE WORD MAY BE TAKEN OFF.
 *
 * "side" is noise after a movement ("24kg each side") and is the movement
 * itself in front of one — "side plank" came back as "Plank", which is a
 * different exercise from the one the person wrote. Same for "per" ("per leg")
 * and the Slovene "na nogo". The words that only ever OPEN a sentence ("danes
 * sem naredil…") may only come off the front, and the rest off either end.
 */
const HEAD_ONLY = new Set(['sem', 'naredil', 'danes', 'just', 'the', 'z', 's']);
const TAIL_ONLY = new Set(['each', 'na', 'nogo', 'per', 'side']);

/**
 * A word that can never be a movement on its own: a counter, a unit, or the
 * opening of a remark. A name made only of these is not a name — "3 rounds:"
 * became "Rounds", "2 min rest" became "Min rest" and "best was 12s" became
 * "Best was", each of them a card for something nobody did.
 */
const NOT_A_MOVEMENT = new Set([
  'round', 'rounds', 'runda', 'runde', 'krog', 'krogov', 'set', 'sets', 'serija', 'serije', 'serij',
  'rep', 'reps', 'ponovitev', 'ponovitve', 'ponovitvi', 'min', 'mins', 'minute', 'minutes', 'minut',
  'sec', 'secs', 'second', 'seconds', 'sekund', 'sekunde', 'hour', 'hours', 'ura', 'ure', 'cal',
  'cals', 'calories', 'kalorij', 'rest', 'pause', 'pavza', 'odmor', 'premor', 'best', 'was', 'got',
  'total', 'time', 'skupaj', 'cas', 'čas', 'between', 'still', 'only', 'left', 'more', 'again',
  'emom', 'amrap', 'tabata', 'circuit', 'krogi',
]);

/** Said about the WORK, never part of the movement's name: "deadlift warm up
 * 60x5" is a deadlift, "push ups AMRAP 22" is push ups. `kindOf` reads these
 * off the original segment first, so nothing is lost by taking them out here. */
const KIND_IN_NAME = /\b(warm\s?ups?|warmup|wu|ogrevanj\w*|drop\s?sets?|dropset|myo(?:reps)?|amrap|to failure|do odpovedi)\b/gi;

// --- the entry point -------------------------------------------------------------

/** Every exercise a written line carries, in the order it was written. */
export function readWrittenLine(raw: string): ReadItem[] {
  const line = normalise(raw);
  if (!line) return [];

  /** The load a movement named travels with it, even when it produced no sets
   * of its own — "curls 15kg to failure, got 12" is one set of twelve at 15. */
  const items: (ReadItem & { load: number | null })[] = [];
  const segments = splitSegments(line);
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    const read = readSegment(segment);
    if (!read) continue;
    const previous = items[items.length - 1];

    // A continuation ("…, then 100kg 5x5", "+ myo 5,5,4"): its sets belong to
    // the movement before it, and inherit that movement's load when they carry
    // none of their own — "myo 5,5,4" is done at the weight already on the bar.
    if (read.name === null) {
      if (previous) {
        previous.sets.push(...inherit(read.sets, loadOfSets(previous.sets) ?? previous.load));
      }
      continue;
    }

    /**
     * PROSE WITH A NUMBER IN IT IS NOT AN EXERCISE. "squat 5x5 140kg, last 2
     * were grindy" used to end in a movement called "Last" with one set of two,
     * which is a WRONG read — the only kind this screen may not produce. A
     * segment after the first has to show some evidence of being training (a
     * unit, an × pair, a rep list, the word "sets") before it may become a card.
     *
     * When it shows none it is folded into the movement before it, but ONLY if
     * that movement is still empty: "curls 15kg to failure, got 12" is one set
     * of twelve, while "5x5 140kg, last 2 were grindy" already has its five
     * sets and the stray two is a remark about them.
     */
    if (i > 0 && !looksLikeTraining(segment)) {
      if (previous && previous.sets.length === 0) {
        previous.sets.push(...inherit(read.sets, previous.load ?? read.load));
      }
      continue;
    }

    items.push({ name: read.name, unit: read.unit, sets: read.sets, load: read.load });
  }
  // A movement nobody said anything about is not a record.
  return items
    .filter((item) => item.sets.length > 0)
    .map(({ name, unit, sets }) => ({ name, unit, sets }));
}

/** Does this segment show any sign of being training rather than a remark? */
function looksLikeTraining(segment: string): boolean {
  return (
    // NOT minutes: rest is measured in them and work is not, so "pavza 3 min"
    // must never become a card of its own.
    /\d\s*(?:kgs?|kilos?|kilograms?|lbs?|pounds?|kms?|m|s|sec)\b/i.test(segment) ||
    /\d\s*[x×]\s*\d/i.test(segment) ||
    /\b\d{1,3}(?:\s*[,/]\s*\d{1,3})+\b/.test(segment) ||
    /\b(sets?|serij\w*|reps?|ponovit\w*|amrap)\b/i.test(segment)
  );
}

/** The load a movement is already working at — what a continuation inherits. */
function loadOfSets(sets: readonly ReadSet[]): number | null {
  for (let i = sets.length - 1; i >= 0; i--) {
    const weight = sets[i]!.weightKg;
    if (weight != null) return weight;
  }
  return null;
}

function inherit(sets: ReadSet[], load: number | null): ReadSet[] {
  if (load == null) return sets;
  return sets.map((s) => (s.weightKg == null ? { ...s, weightKg: load } : s));
}

/**
 * A movement resolved to the name the rest of the flow uses, or null. The whole
 * name has to match — see `LIFT_ALIASES`.
 */
export function canonicalName(words: string): string | null {
  const needle = normaliseName(words);
  if (!needle) return null;
  for (const [canonical, aliases] of Object.entries(LIFT_ALIASES)) {
    if (normaliseName(canonical) === needle) return canonical;
    if (aliases.includes(needle)) return canonical;
  }
  return null;
}

// --- one segment ------------------------------------------------------------------

interface SegmentRead {
  /** Null when this segment continues the exercise before it. */
  name: string | null;
  unit: 'kg' | 'lb';
  sets: ReadSet[];
  /** The load the segment named, even when it produced no sets. */
  load: number | null;
}

function readSegment(segment: string): SegmentRead | null {
  const rir = readRir(segment);
  // Everything the numbers must not see: an RPE, an RIR, a parenthetical.
  const text = segment
    // A parenthetical is usually an effort marker ("(rir 2)") and comes out
    // whole — but "ohp (40kg) 3x10" puts the LOAD in brackets, and taking that
    // out left the line with no weight at all. Keep what is inside when it is a
    // weight; drop the brackets either way.
    .replace(/\(([^)]*)\)/g, (_m, inside: string) =>
      /\d\s*(?:kgs?|kilos?|kilograms?|lbs?|pounds?)\b/i.test(inside) ? ` ${inside} ` : ' ',
    )
    // An "@" before a number is an RPE and comes out — UNLESS the number
    // wears a weight unit, because "bench 5 @ 100kg" is a load, and stripping
    // it left the line with a bare "kg" and nothing to read at all.
    // The `\b` matters: without it the digits simply give ground to the
    // lookahead — "@ 100kg" backtracks to "@ 10" and leaves a stray "0kg".
    .replace(/@\s*\d+(?:[.,]\d+)?\b(?!\s*(?:kgs?|kilos?|kilograms?|lbs?|pounds?)\b)/gi, ' ')
    .replace(/\brir\s*-?\d+/gi, ' ')
    .replace(/\brpe\s*\d+(?:[.,]\d+)?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;

  // `\b` after the unit is not enough: in "225lbx5" the character after `lb` is
  // the `x` of the set notation, and b→x is letter-to-letter, so there is no
  // word boundary there. The line then read as KILOGRAMS and 225 lb was shown
  // back as 225 kg — invisible for kg (nothing to convert) and wrong by 2.2x
  // for anyone who writes pounds without a space. Accept the unit when what
  // follows is a non-letter, the end of the line, or an `x` that starts a set
  // notation; "225lbxyz" is still not a weight.
  const wroteLb = /\d\s*(?:lbs?|pounds?)(?=[x×]\s*\d|[^\p{L}]|$)/iu.test(text);
  const wroteKg = /\d\s*(?:kgs?|kilos?|kilograms?)(?=[x×]\s*\d|[^\p{L}]|$)/iu.test(text);
  /**
   * THE PLATE NUMBERS, because a silent 2.2x is worse than no number.
   *
   * The real parser's rule, quoted: *"the classic barbell plate numbers (95,
   * 135, 185, 225, 275, 315, 365, 405) are pounds → convert; every other
   * unitless load is kilograms"*. This grammar did not have it, so `185x5x3`
   * read as 185 KG and the toolbar pill reported 2,775 kg for a session that
   * was 1,259 — the app stating a load nobody lifted, which is the one thing
   * `estimate.test.ts` already has a test named after.
   *
   * It applies only when NO unit was written anywhere in the segment: somebody
   * who types `135kg` means 135 kilograms and says so.
   */
  const plateNumbers = /(?<![\d.,])(?:95|135|185|225|275|315|365|405)(?![\d.,])/;
  const unit: 'kg' | 'lb' =
    wroteLb ? 'lb' : !wroteKg && plateNumbers.test(text) ? 'lb' : 'kg';
  /**
   * AN IMPOSSIBLE LOAD MAKES THE WHOLE SEGMENT UNREADABLE, and that is the
   * older ruling kept: a number wearing a unit is unambiguous, so reading
   * `bench 9000kg 5,5,5` back as "three sets, no weight" would be a misquote of
   * what the person wrote. The line stays on the page as their words instead.
   */
  if (numbersIn(text).some((n) => isLoad(n) && !inLoadRange(n.value, n.unit === 'lb' ? 'lb' : 'kg'))) {
    return null;
  }
  /**
   * A BARE DASH GROUP IS TEMPO ONLY WHEN THE SETS ARE WRITTEN ELSEWHERE.
   *
   * "3-1-3" beside "3x10" is a tempo prescription; "5-5-5-5" and "21-15-9" on
   * their own are the sets themselves. Nothing in the digits tells them apart —
   * both are small numbers joined by dashes — so the segment's OTHER content
   * decides, which is exactly how a person reads it.
   */
  const tempoless = /\d\s*[x×]\s*\d/.test(text)
    ? text.replace(/\b\d\s*-\s*\d\s*-\s*\d(?:\s*-\s*\d)?\b/g, ' ')
    : text;

  const kind = kindOf(segment);
  const { name, continuation } = readName(text);
  if (name === null && !continuation) return null;

  const sets = readSets(tempoless, unit, continuation);
  if (sets.length === 0 && continuation) return null;

  return {
    name: continuation ? null : name,
    unit,
    load: loadOf(text, unit),
    sets: sets.map((set) => ({ ...set, kind: set.kind === 'working' ? kind : set.kind, rir })),
  };
}

/** The movement's own words, or a flag saying this segment continues the last. */
function readName(raw: string): { name: string | null; continuation: boolean } {
  /**
   * THE CONTINUATION WORD IS READ OFF THE RAW SEGMENT, before the kind words
   * are taken out of it. "dropset to 60" used to lose its "dropset" to
   * `KIND_IN_NAME` and then be read as a movement called "To" — the stripping
   * is what hid the very word that says this piece continues the last one.
   */
  const opener = /^\s*([\p{L}]{2,})/u.exec(raw)?.[1]?.toLowerCase();
  if (opener && CONTINUATIONS[opener] !== undefined) return { name: null, continuation: true };

  const text = raw.replace(KIND_IN_NAME, ' ');
  const firstDigit = text.search(/\d/);
  const head = (firstDigit > 0 ? text.slice(0, firstDigit) : firstDigit === -1 ? text : '')
    .replace(/[^\p{L}\s-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!head) {
    /**
     * THE NAME AFTER THE NUMBERS, and only for a distance or a time: "400m
     * run", "5x400m run", "2000m row". Cardio is the one shape people write
     * backwards, and it is safe to read backwards precisely because it is the
     * one shape — "180 2x3 felt smooth" must stay unnamed rather than become a
     * movement called "Felt smooth".
     */
    const measured = /\d\s*(?:kms?|m|s|sec|secs|seconds?|min|mins|minutes?)\b/i.test(text);
    const tail = measured ? tailName(text) : null;
    if (tail) return { name: tail, continuation: false };
    /**
     * THE NAME AFTER A LEADING COUNT — "10 thrusters 40kg", "12 kb swings
     * 24kg", the way every circuit and metcon on earth is written. Read
     * nothing, this whole shape was silently dropped.
     *
     * ONE number is stepped over and no more: "180 2x3 felt smooth" starts
     * with two numbers in a row and stays unnamed, which is the ruling above
     * kept intact. What is stepped over must also leave a WORD behind that
     * could name a movement — "3 rounds:" and "5 sets" leave a counter, and a
     * counter is not an exercise (`NOT_A_MOVEMENT`).
     */
    const afterCount = /^\s*\d+(?:[.,]\d+)?\s*(?:reps?|x)?\s+([\p{L}][\p{L}\s-]*)/u.exec(text);
    const led = afterCount ? cleanName(afterCount[1]!) : null;
    if (led && /\d/.test(text.slice(afterCount!.index + afterCount![0].length))) {
      return { name: led, continuation: false };
    }
    return { name: null, continuation: true };
  }

  return { name: cleanName(head) ?? null, continuation: cleanName(head) === null };
}

/**
 * A head of words as a movement's name, or null when what is left is not one.
 * The noise words come off from the ENDS inwards ("dips bw+20" is Dips), and a
 * stray hyphen goes with them — "assisted pull ups bw-15" left a movement
 * called "Assisted pull ups bw-".
 */
function cleanName(head: string): string | null {
  const words = head
    .toLowerCase()
    .split(' ')
    // A word's own stray hyphen goes before the noise check, or "bw-" survives
    // a list that holds "bw".
    .map((w) => w.replace(/^-+|-+$/g, ''))
    .filter((w) => w.length > 0);
  const kept = [...words];
  const noise = (w: string, end: 'head' | 'tail') =>
    NAME_NOISE.has(w) && !(end === 'head' ? TAIL_ONLY : HEAD_ONLY).has(w);
  while (kept.length > 1 && noise(kept[kept.length - 1]!, 'tail')) kept.pop();
  while (kept.length > 1 && noise(kept[0]!, 'head')) kept.shift();
  const cleaned = kept
    .join(' ')
    .replace(/[-\s]+$/, '')
    .replace(/^[-\s]+/, '')
    .trim();
  if (cleaned.length < 2) return null;
  // A counter, a unit or a lump of prose is not a movement, and naming a card
  // after one ("Rounds", "Min rest", "Best was") is a wrong read, not a poor
  // one — the line is better kept as the words the person wrote.
  if (cleaned.split(' ').every((w) => NOT_A_MOVEMENT.has(w))) return null;
  return canonicalName(cleaned) ?? titleCase(cleaned);
}

/** The last few words of a line that opened with its numbers. */
function tailName(text: string): string | null {
  const after = /[\d)\s](?:kms?|m|s|sec|secs|seconds?|min|mins|minutes?)?\s+([\p{L}\s-]{2,})$/u.exec(text);
  const words = (after?.[1] ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !NAME_NOISE.has(w))
    .slice(0, 3);
  if (words.length === 0) return null;
  return cleanName(words.join(' '));
}

/** What kind of work the words around the numbers describe. */
function kindOf(segment: string): SetKind {
  for (const { test, kind } of KIND_WORDS) if (test.test(segment)) return kind;
  return 'working';
}

/**
 * Reps in reserve. `@8` and "RPE 8" are an RPE (10 − rpe); "RIR 2" is already
 * one. Half points are kept — "@8,5" is a real thing people write.
 */
function readRir(segment: string): number | null {
  const rir = /\brir\s*(-?\d+(?:[.,]\d+)?)/i.exec(segment);
  if (rir) return clampRir(toNumber(rir[1]!));
  const rpe = /(?:@|\brpe\s*)(\d+(?:[.,]\d+)?)/i.exec(segment);
  if (rpe) {
    const value = toNumber(rpe[1]!);
    if (value > 0 && value <= 10) return clampRir(10 - value);
  }
  return null;
}

// --- the number rules --------------------------------------------------------------

/** A number with the unit it was written with, and where it sat in the text. */
interface Num {
  value: number;
  unit: 'kg' | 'lb' | 'm' | 'km' | 's' | 'min' | null;
  at: number;
  length: number;
}

const NUMBER = /(\d+(?:[.,]\d+)?)\s*(kgs?|kilos?|kilograms?|lbs?|pounds?|kms?|m|s|sec|secs|seconds?|min|mins|minutes?)?\b/gi;

function numbersIn(text: string): Num[] {
  const out: Num[] = [];
  NUMBER.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NUMBER.exec(text)) !== null) {
    out.push({
      value: toNumber(m[1]!),
      unit: unitOf(m[2]),
      at: m.index,
      length: m[0].length,
    });
  }
  return out;
}

function unitOf(raw: string | undefined): Num['unit'] {
  if (!raw) return null;
  const u = raw.toLowerCase();
  if (u.startsWith('kg') || u.startsWith('kilo')) return 'kg';
  if (u.startsWith('lb') || u.startsWith('pound')) return 'lb';
  if (u.startsWith('km')) return 'km';
  if (u === 'm') return 'm';
  if (u.startsWith('min')) return 'min';
  if (u.startsWith('s')) return 's';
  return null;
}

const isLoad = (n: Num) => n.unit === 'kg' || n.unit === 'lb';
const isDistance = (n: Num) => n.unit === 'm' || n.unit === 'km';
const isTime = (n: Num) => n.unit === 's' || n.unit === 'min';

/** The word that turns the number before it into a count, not a load. */
const COUNTER_AFTER = /^\s*(?:sets?|serij\w*|reps?|ponovit\w*|rounds?|krog\w*|kroga|cal\w*|x\b)/i;

/** A stretch of the segment some rule has already spoken for. */
type Span = readonly [number, number];

const inSpans = (n: Num, spans: readonly Span[]) =>
  spans.some(([from, to]) => n.at >= from && n.at < to);

/** The sets a segment carries, by the ladder in the file note. */
function readSets(text: string, unit: 'kg' | 'lb', continuation = false): ReadSet[] {
  const kg = (value: number) => (unit === 'lb' ? round2(value / LB_PER_KG) : value);
  const load = loadOf(text, unit);

  // 0 — a count against a DISTANCE: "4x50m", "5x400m", "sled push 20m x4".
  //     Nothing else in the ladder can tell laps from reps.
  const laps = LAPS.exec(text);
  if (laps) {
    const sets = lapSets(Number.parseInt(laps[1]!, 10), toNumber(laps[2]!), laps[3]!, load);
    if (sets.length > 0) return sets;
  }
  const lapsReversed = LAPS_REVERSED.exec(text);
  if (lapsReversed) {
    const sets = lapSets(
      Number.parseInt(lapsReversed[3]!, 10),
      toNumber(lapsReversed[1]!),
      lapsReversed[2]!,
      load,
    );
    if (sets.length > 0) return sets;
  }

  /**
   * 0b — A COUNT AGAINST A TIME: "front lever 5x10s", "plank 3x60s", "tabata
   * 8x20s", "handstand 3x45 sec", and the same thing written backwards.
   *
   * Read nothing, every one of those came back as ONE hold — five sets of a
   * ten-second lever is not "a ten-second lever", it is most of a session. The
   * distance rule above has always existed for `4x50m`; time had no equivalent,
   * so a calisthenics or conditioning line lost every set but one.
   */
  const timed = TIMED.exec(text);
  if (timed) {
    const sets = timeSets(
      Number.parseInt(timed[1]!, 10),
      toNumber(timed[2]!),
      timed[3] ?? timed[4]!,
      load,
    );
    if (sets.length > 0) return sets;
  }
  const timedReversed = TIMED_REVERSED.exec(text);
  if (timedReversed) {
    const sets = timeSets(
      Number.parseInt(timedReversed[4]!, 10),
      toNumber(timedReversed[1]!),
      timedReversed[2] ?? timedReversed[3]!,
      load,
    );
    if (sets.length > 0) return sets;
  }

  // 1 — repeated pairs: "100x8 90x10 80x12", "140x5, 160x3, 180x1", "2x16 1x15"
  const pairMatches = [...text.matchAll(PAIR)];
  const pairSpans: Span[] = pairMatches.map((m) => [m.index!, m.index! + m[0].length]);
  const pairs = pairMatches.map((m) => ({
    left: toNumber(m[1]!),
    leftUnit: unitOf(m[2]),
    right: Number.parseInt(m[3]!, 10),
  }));
  /** The load the PAIRS did not already account for — "cable fly 15 3x15" is
   * fifteen kilograms for fifteen, not three sets of fifteen at nothing. */
  const loadBesidePairs = loadOf(text, unit, pairSpans);
  if (pairs.length >= 2) {
    const sets = fromPairs(pairs, unit, kg, loadBesidePairs);
    if (sets.length > 0) return sets;
  }

  // 2 — "185x5x3" and "100kg x12 x3": load, reps, then how many times.
  const triple = TRIPLE.exec(text);
  if (triple) {
    const value = toNumber(triple[1]!);
    const reps = Number.parseInt(triple[3]!, 10);
    const count = Number.parseInt(triple[4]!, 10);
    const asLoad = triple[2] ? (unitOf(triple[2]) as 'kg' | 'lb') : unit;
    if (inLoadRange(value, asLoad) && reps <= MAX_REPS && count <= MAX_SETS) {
      return repeat(count, () => set({ reps, weightKg: kg(value) }));
    }
  }

  // 3 — a written rep list, which OUTRANKS a single pair: "35 kg x 8/9/8" is
  //     three sets at one load, not one set and two loose numbers.
  const list = REP_LIST.exec(text) ?? DASH_LIST.exec(text);
  const listSpan: Span[] = list ? [[list.index, list.index + list[0].length]] : [];
  const loadBesideList = loadOf(text, unit, listSpan);
  if (list && loadBesideList != null) {
    const reps = repsIn(list[0]);
    if (reps.length > 1) return reps.map((r) => set({ reps: r, weightKg: loadBesideList }));
  }

  // 4 — one pair: "3x8", "5x5", "100kgx5", "80kg x8", "15x2", "24 x20"
  if (pairs.length === 1) {
    const sets = fromPairs(pairs, unit, kg, loadBesidePairs);
    if (sets.length > 0) return sets;
  }

  // 5 — a rep list with no load anywhere: "12,10,8"
  if (list) {
    const reps = repsIn(list[0]);
    if (reps.length > 0) return reps.map((r) => set({ reps: r, weightKg: loadBesideList }));
  }

  const numbers = numbersIn(text);

  // 6 — distance and time, when that is all there is: "400m", "plank 60s",
  //     "kolo 30 min", "row 2000m 7:45". A run has no reps to find.
  const measures = numbers.filter((n) => isDistance(n) || isTime(n));
  if (measures.length > 0 && numbers.every((n) => isDistance(n) || isTime(n) || isLoad(n))) {
    const distance = measures.find(isDistance);
    const time = measures.find(isTime);
    return [
      set({
        weightKg: load,
        distanceM: distance ? metres(distance) : null,
        durationS: time ? seconds(time) : null,
      }),
    ];
  }

  // 7 — a spaced rep list after a load: "100kg 8 8 8"
  const bare = numbers.filter((n) => n.unit == null && n.value <= MAX_REPS && Number.isInteger(n.value));
  if (load != null && bare.length >= 3 && bare.every((n) => n.value >= 1)) {
    const spaced = bare.filter((n) => kg(n.value) !== load);
    if (spaced.length >= 3) return spaced.map((n) => set({ reps: n.value, weightKg: load }));
  }

  // 8 — in words: "4 serije po 10", "3 sets of 8", "5 ponovitev"
  const wordSets = /(\d+)\s*(?:sets?|serij\w*)\b/i.exec(text);
  const wordReps =
    /(\d+)\s*(?:reps?|ponovit\w*)\b/i.exec(text) ?? /(?:po|of)\s*(\d+)\b/i.exec(text);
  if (wordSets || wordReps) {
    const count = wordSets ? Number.parseInt(wordSets[1]!, 10) : 1;
    const reps = wordReps ? Number.parseInt(wordReps[1]!, 10) : null;
    const spans: Span[] = [];
    if (wordSets) spans.push([wordSets.index, wordSets.index + wordSets[0].length]);
    if (wordReps) spans.push([wordReps.index, wordReps.index + wordReps[0].length]);
    if (count >= 1 && count <= MAX_SETS && (reps == null || (reps >= 1 && reps <= MAX_REPS))) {
      const beside = loadOf(text, unit, spans);
      return repeat(count, () => set({ reps, weightKg: beside }));
    }
  }

  // 9 — one count beside a load: "bench 5 80kg", "curls 12 15kg", "burpees x10"
  const count = bare.find((n) => n.value >= 1 && n.value <= MAX_REPS);
  if (count) {
    const beside = loadOf(text, unit, [[count.at, count.at + count.length]]);
    /**
     * ONE NUMBER IS ONE FACT. "squats x30" came back as thirty reps at thirty
     * kilograms and "sklece do odpovedi 25" as twenty-five at twenty-five: the
     * same number read twice, inventing a load nobody wrote.
     *
     * In a CONTINUATION a lone heavy number is the new load rather than a rep
     * count — "…, dropset to 60 then 40" is the bar coming down, not forty
     * reps — which is the same `LOAD_FLOOR` judgement the pairs already make.
     */
    if (beside == null && continuation && count.value >= LOAD_FLOOR) {
      return [set({ weightKg: kg(count.value), reps: null })];
    }
    return [set({ reps: count.value, weightKg: beside })];
  }

  // A load and nothing else is not a set — somebody who wrote only a number has
  // not told us what they did with it.
  return [];
}

/** `count` efforts of `each` seconds — the reading of `5x10s` that is not reps. */
function timeSets(count: number, each: number, unitRaw: string, load: number | null): ReadSet[] {
  const secondsEach = /^min/i.test(unitRaw) ? Math.round(each * 60) : Math.round(each);
  if (!Number.isInteger(count) || count < 1 || count > MAX_SETS || secondsEach <= 0) return [];
  return repeat(count, () => set({ durationS: secondsEach, weightKg: load }));
}

/**
 * WHICH NUMBER IS WHICH, decided once for the whole segment.
 *
 * `100x8` is a load and its reps; `3x8` is sets and reps; `15x2` is reps and
 * how many times — three readings of one notation, and only the SIZES tell them
 * apart. The ladder, in order:
 *
 *  · a unit, or every left-hand number at or above `LOAD_FLOOR` → load × reps
 *  · every left-hand number at ten or under → sets × reps  ("3x8", "2x16")
 *  · every right-hand number at ten or under → reps × sets ("15x2", "16x1")
 *  · anything else → load × reps  ("24 x20" is 24 kg for twenty)
 *
 * The expansion is capped at `MAX_SETS` in total: "15x2 16x1" read as sets
 * would be thirty-one sets, which is not a session, it is a misread.
 */
function fromPairs(
  pairs: readonly Pair[],
  unit: 'kg' | 'lb',
  kg: (value: number) => number,
  load: number | null,
): ReadSet[] {
  const usable = pairs.filter((p) => p.right >= 1 && p.right <= MAX_REPS * 10);
  if (usable.length === 0) return [];

  // A pair whose RIGHT side is a distance is a count of laps: "4x50m".
  const asLoad =
    usable.some((p) => p.leftUnit === 'kg' || p.leftUnit === 'lb') ||
    usable.every((p) => p.left >= LOAD_FLOOR);
  if (asLoad) {
    const sets = usable
      .filter((p) => p.right <= MAX_REPS && inLoadRange(p.left, (p.leftUnit as 'kg' | 'lb') ?? unit))
      .map((p) => set({ reps: p.right, weightKg: kg(p.left) }));
    if (sets.length > 0) return sets;
  }

  const expand = (count: number, reps: number, out: ReadSet[]) => {
    for (let i = 0; i < count && out.length < MAX_SETS; i++) out.push(set({ reps, weightKg: load }));
  };

  if (usable.every((p) => p.left <= 10 && p.right <= MAX_REPS)) {
    const out: ReadSet[] = [];
    for (const p of usable) expand(p.left, p.right, out);
    if (out.length > 0) return out;
  }
  if (usable.every((p) => p.right <= 10 && p.left <= MAX_REPS)) {
    const out: ReadSet[] = [];
    for (const p of usable) expand(p.right, p.left, out);
    if (out.length > 0) return out;
  }

  const sets = usable
    .filter((p) => p.right <= MAX_REPS && inLoadRange(p.left, unit))
    .map((p) => set({ reps: p.right, weightKg: kg(p.left) }));
  return sets;
}

/** `count` laps of `each` — the one reading of `4x50m` that is not reps. */
function lapSets(count: number, each: number, unitRaw: string, load: number | null): ReadSet[] {
  const metresEach = /km/i.test(unitRaw) ? Math.round(each * 1000) : Math.round(each);
  if (!Number.isInteger(count) || count < 1 || count > MAX_SETS || metresEach <= 0) return [];
  return repeat(count, () => set({ distanceM: metresEach, weightKg: load }));
}

/** The numbers of a written rep list, in order. */
function repsIn(list: string): number[] {
  return list
    .split(/[,/-]/)
    .map((n) => Number.parseInt(n.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= MAX_REPS);
}

/** One `A × B` in the text, with whatever unit A wore. */
interface Pair {
  left: number;
  leftUnit: Num['unit'];
  right: number;
}

const PAIR = /(\d+(?:[.,]\d+)?)\s*(kgs?|lbs?|kg|lb)?\s*[x×]\s*(\d+)\b/gi;
const TRIPLE =
  /(\d+(?:[.,]\d+)?)\s*(kgs?|lbs?|kg|lb)?\s*[x×]\s*(\d+)\s*(?:reps?|ponovit\w*)?\s*[x×]\s*(\d+)\s*(?:sets?|serij\w*)?\b/i;
const REP_LIST = /\b\d{1,3}(?:\s*[,/]\s*\d{1,3})+\b/;
/**
 * "21-15-9", "5-5-5-5", "8-7-6" — the same list written with dashes.
 *
 * THREE elements minimum, because two of them are a rep RANGE ("3x8-10 70kg" is
 * three sets of eight, not one of eight and one of ten) and the range must keep
 * reading as its lower bound.
 */
const DASH_LIST = /\b\d{1,3}(?:\s*-\s*\d{1,3}){2,}\b/;
/** "4x50m" — a count of laps against the distance of each. */
const LAPS = /(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(km|m)\b/i;
/** "20m x4" — the same thing written the other way round. */
const LAPS_REVERSED = /(\d+(?:[.,]\d+)?)\s*(km|m)\s*[x×]\s*(\d+)\b/i;
/**
 * "5x10s", "3x45 sec", "4x2 min" — a count of TIMED efforts.
 *
 * A spelled-out unit may stand off from its number, but a BARE "s" may not:
 * "bench 4 serije po 10 s 70kg" is Slovene for "with", and reading that "s" as
 * seconds would turn a written set of ten into a ten-second hold.
 */
const TIMED = /(\d+)\s*x\s*(\d+(?:[.,]\d+)?)(?:\s*(sec|secs|seconds?|min|mins|minutes?)|(s))\b/i;
/** "30s x4" — the same thing written the other way round. */
const TIMED_REVERSED =
  /(\d+(?:[.,]\d+)?)(?:\s*(sec|secs|seconds?|min|mins|minutes?)|(s))\s*x\s*(\d+)\b/i;

/**
 * The load a segment carries: a number wearing kg or lb wins outright;
 * otherwise the biggest bare number that is not one of the rep/set numbers and
 * is heavy enough to be a load rather than a count.
 */
function loadOf(text: string, unit: 'kg' | 'lb', spans?: readonly Span[]): number | null {
  const numbers = numbersIn(text);
  const united = numbers.find(isLoad);
  if (united) {
    const value = united.unit === 'lb' ? round2(united.value / LB_PER_KG) : united.value;
    return inLoadRange(united.value, united.unit === 'lb' ? 'lb' : 'kg') ? value : null;
  }
  const free = numbers.filter((n) => n.unit == null && !(spans && inSpans(n, spans)));
  const heavy = free
    .map((n) => n.value)
    .filter((v) => v >= LOAD_FLOOR && inLoadRange(v, unit));
  if (heavy.length > 0) {
    const top = Math.max(...heavy);
    return unit === 'lb' ? round2(top / LB_PER_KG) : top;
  }
  /**
   * THE MACHINE STACK. "cable fly 15 3x15", "face pull 20 3x20", "kb press 24
   * 3x8" — a light number that the rep scheme has NOT already used, sitting
   * where the load goes: right after the movement's name. Under the floor
   * above it read as nothing at all, so half a gym's isolation work arrived
   * with no weight on it.
   *
   * It needs `spans` — the caller having said which numbers the reps are made
   * of — because without that knowledge the 3 in "pull ups 3x10" looks exactly
   * like three kilograms.
   */
  if (!spans || spans.length === 0) return null;
  const first = numbers[0];
  if (!first || first.unit != null || numbers.length < 2) return null;
  if (inSpans(first, spans) || !inLoadRange(first.value, unit)) return null;
  // A number a COUNTER word follows is that count, whatever the rest of the
  // line does: "zgibi max 3 serije: 14, 11, 9" is three sets, not three kilos.
  if (COUNTER_AFTER.test(text.slice(first.at + first.length))) return null;
  return unit === 'lb' ? round2(first.value / LB_PER_KG) : first.value;
}

// --- small helpers -------------------------------------------------------------------

function set(fields: Partial<ReadSet>): ReadSet {
  return {
    kind: 'working',
    reps: null,
    weightKg: null,
    distanceM: null,
    durationS: null,
    rir: null,
    ...fields,
  };
}

function repeat(count: number, make: () => ReadSet): ReadSet[] {
  const out: ReadSet[] = [];
  for (let i = 0; i < Math.min(Math.max(count, 1), MAX_SETS); i++) out.push(make());
  return out;
}

function inLoadRange(value: number, unit: 'kg' | 'lb'): boolean {
  const ceiling = unit === 'lb' ? MAX_LB : MAX_KG;
  return value > 0 && value <= ceiling;
}

function metres(n: Num): number {
  return n.unit === 'km' ? Math.round(n.value * 1000) : Math.round(n.value);
}

function seconds(n: Num): number {
  return n.unit === 'min' ? Math.round(n.value * 60) : Math.round(n.value);
}

function clampRir(value: number): number {
  return Math.max(-5, Math.min(10, Math.round(value * 2) / 2));
}

function toNumber(raw: string): number {
  return Number.parseFloat(raw.replace(',', '.'));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** `×` is the same operator as `x`, and a decimal comma is a decimal point —
 * but only INSIDE a number, so a rep list keeps its commas. */
function normalise(raw: string): string {
  return (
    String(raw ?? '')
      .replace(/×/g, 'x')
      // "A1 bench", "B2 row" — a superset marker is not part of the movement.
      .replace(/^\s*[A-Da-d][1-9]\b[.)]?\s*/, '')
      // "bw+20" is twenty kilograms on a belt, not a rep count. The unit the
      // person may already have written is KEPT rather than doubled: "bw+25kg"
      // used to become "25kgkg", which matches no number at all and lost the
      // load entirely.
      .replace(
        /\bbw\s*\+\s*(\d+(?:[.,]\d+)?)(\s*(?:kgs?|kilos?|lbs?|pounds?))?/gi,
        (_m, value: string, unit: string | undefined) => `${value}${unit ?? 'kg'}`,
      )
      // "bw-15" is a band TAKING fifteen kilograms off, and assistance is not
      // tracked (the edge function's own ruling). Read as a load it put weight
      // on somebody's assisted pull-up.
      .replace(/\bbw\s*-\s*\d+(?:[.,]\d+)?\s*(?:kgs?|lbs?)?/gi, ' ')
      // "225#" is the American gym's own shorthand for 225 POUNDS, and read as
      // kilograms it doubles somebody's bench. The unit is written, so this is
      // not a guess — it is the same fact spelled with a different glyph.
      .replace(/(\d+(?:[.,]\d+)?)\s*#/g, '$1lb')
      // An empty bar is twenty kilograms — the one load people write in WORDS
      // instead of numbers, and the same reading the edge function gives it.
      .replace(EMPTY_BAR, '20kg')
      // REST IS NOT WORK. "2 min rest", "rest 90s", "pavza 3 min": the minutes
      // between sets are not a set, and reading them as one puts a phantom
      // three-minute effort in somebody's session.
      .replace(REST_AFTER, ' ')
      .replace(REST_BEFORE, ' ')
      // Tempo is a prescription for HOW a rep is lifted, never a count:
      // "tempo 30X1" read as a pair turned three sets of eight into nine sets.
      .replace(/\btempo\s*\d+\s*[x]?\s*\d*\b/gi, ' ')
      // "1:02:30" is an hour and two minutes, and it has to be read BEFORE the
      // M:SS rule below — that one matched the ":02:30" half of it and left a
      // stray "1" behind, which the load rules then read as a weight.
      .replace(
        /\b(\d{1,2}):([0-5]\d):([0-5]\d)\b/g,
        (_m, h: string, min: string, sec: string) =>
          `${Number(h) * 3600 + Number(min) * 60 + Number(sec)}s`,
      )
      // "7:45" and "28:30" are a time, and neither half is a rep.
      .replace(/\b(\d{1,2}):([0-5]\d)\b/g, (_m, min: string, sec: string) => `${Number(min) * 60 + Number(sec)}s`)
      // "5k" is five kilometres wherever a distance is what is being written.
      .replace(/\b(\d+(?:[.,]\d+)?)\s*k\b/gi, '$1km')
      .replace(/(\d),(\d{1,2})(?=\s*(?:kgs?|lbs?|kg|lb|km|m\b))/gi, '$1.$2')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** The bar with nothing on it, in both languages the corpus is written in. */
const EMPTY_BAR = /\b(?:just the bar|the bar only|bar only|empty bar|prazna palica|samo palica)\b/gi;
/** "rest 90s", "pavza 3 min" — the word first, then the time. */
const REST_AFTER =
  /[,;]?\s*\b(?:rest|pavza|pavzo|odmor|premor|pause)\s*:?\s*\d+(?:[.,]\d+)?\s*(?:s|sec|secs|seconds?|min|mins|minutes?|minut\w*)\b/gi;
/** "2 min rest", "3 min pavza" — the time first, then the word. */
const REST_BEFORE =
  /[,;]?\s*\b\d+(?:[.,]\d+)?\s*(?:s|sec|secs|seconds?|min|mins|minutes?|minut\w*)\s*(?:of\s+)?(?:rest|pavze|pavza|odmora|odmor|premora|premor|pause)\b/gi;

function normaliseName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9žčšćđ\s-]/g, '')
    .replace(/\s+/g, ' ');
}

function titleCase(words: string): string {
  const trimmed = words.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * One physical line, split where a NEW exercise starts: a semicolon, a plus, a
 * comma or an "and" — but only when at least two letters follow it. That
 * lookahead is the whole safety of this: `5,5,4` is a rep list, `, rows` is a
 * second exercise, and no other rule tells them apart. A segment that turns out
 * to be a connector ("then", "potem", "myo") is folded back into the exercise
 * before it by `readWrittenLine`, so a split can never invent a movement.
 */
export function splitSegments(line: string): string[] {
  return joinNamesOnly(line.split(NEW_MOVEMENT))
    .flatMap((part) => part.split(NEXT_SET_GROUP))
    .flatMap((part) => part.split(CONTINUATION_START))
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * "CLEAN AND JERK" IS ONE MOVEMENT, and splitting it produced an exercise
 * called "Jerk" — the person's lift renamed to half of itself.
 *
 * `and`/`in` is the one separator that is also an ordinary part of a movement's
 * NAME ("clean and jerk", "clean and press", "sklece in zgibi"). The tell is
 * numbers: a real second movement carries its own, and a name fragment carries
 * none. So a piece with no digit in it is glued back onto the piece after it,
 * separator word included, and the two are read as the one name they are.
 *
 * `split` is called with a capturing group, so the pieces arrive interleaved
 * with the word that separated them (`undefined` for the punctuation and
 * superset separators, which are never part of a name and never glued).
 */
function joinNamesOnly(pieces: (string | undefined)[]): string[] {
  const out: string[] = [];
  let carried = '';
  for (let i = 0; i < pieces.length; i += 2) {
    const part = `${carried}${pieces[i] ?? ''}`;
    const word = pieces[i + 1];
    carried = '';
    if (word !== undefined && i + 2 < pieces.length && !/\d/.test(part)) {
      carried = `${part.trim()} ${word} `;
      continue;
    }
    out.push(part);
  }
  if (carried) out.push(carried);
  return out;
}

/**
 * A separator with WORDS after it — a second movement on the line. The slash is
 * here because people list a session with it ("bench 3x8 / rows 3x10"), and it
 * is safe next to a rep list precisely because of the two rules already in the
 * pattern: a slash only separates when it has a SPACE on both sides and LETTERS
 * after it, and `8/7/6` has neither.
 */
const NEW_MOVEMENT = /\s*(?:;|\+|,|\/|\b(and|in)\b|\bss\b|\bsuperset\b)\s+(?=\p{L}{2})/giu;

/**
 * A continuation word starts a new set group even with no comma in front of it:
 * "squat 20kg x10, 60kg x5, 100kg x3 then 140kg 3x5" ended with a set of five
 * at THREE kilograms, because "3x5" was read inside the same segment as the
 * 100 kg pair. Split here and `readWrittenLine` folds the piece back into the
 * movement it continues, at that movement's load.
 */
const CONTINUATION_START = /\s+(?=(?:then|potem|nato|drop|dropset|dropped|myo|myoreps)\b)/gi;

/**
 * A separator with another SET GROUP after it: "deadlift warm up 60x5, 180 2x3"
 * is one movement written in two halves, and the halves need to be read apart
 * or the warm-up's label lands on the working sets.
 *
 * It insists on an `×` pair in what follows, which is what keeps a rep list
 * whole: `bench 100kg 5,5,4` has commas and no pair, so it is never split. A
 * chunk with no name of its own is folded straight back into the movement it
 * came from (`readWrittenLine`), so this can never invent an exercise either.
 */
const NEXT_SET_GROUP = /\s*[,;]\s+(?=\d[\d\s.,]*[x×]\s*\d)/g;
