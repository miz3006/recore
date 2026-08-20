// Relative + .ts extension: this file is BOTH bundled by Metro AND run under
// `node --test` (which can't resolve the `@/` alias) — the same pattern as
// onboarding.ts, streak.ts and plan/prescribe.ts.
import { LB_PER_KG, loadStep, toPlate } from './onboarding.ts';

/**
 * THE DEMO'S OWN PARSER — a small, offline grammar for ONE line, used by the
 * onboarding parse demo and by nothing else.
 *
 * ## Why the app's parser cannot do this job
 *
 * `lib/parse/client.ts` is the real reader, and it is a call to the
 * `parse-workout` edge function: it needs a Supabase JWT (§7.3), a saved
 * `workouts` row to attach the result to, and a network round trip. The demo
 * screen sits BEFORE the account exists, may be running on a plane, and has to
 * answer inside the beat of a keystroke — none of which the real path can do.
 *
 * So this file reads the one line locally, in the same tick, and the demo tries
 * the real parser only as a second opinion when a session happens to exist
 * (`demo-parse-remote.ts` — a replay of onboarding from You).
 *
 * ## What it is NOT
 *
 * It is not a second source of truth and nothing it produces is ever written
 * into the record as a reading. What the person typed is kept VERBATIM
 * (`rawText`) and seeded as raw text after signup (`lib/onboarding-seed.ts`);
 * the real parser reads that text like any other line the moment there is an
 * account. This grammar only decides what the demo CARD says for the two
 * seconds it is on screen.
 *
 * ## The grammar
 *
 *     (exercise words) (number)(kg|lb)? (rep list separated by , or x)
 *
 * which covers the shapes the eval set calls "rep list commas after weight" and
 * "sets x reps" — `bench 100kg 5,5,4`, `deadlift 140 5x5`, `pull ups 3x8`. A
 * line it cannot read returns null, and the demo answers with the canned
 * example rather than an error (a demo must never dead-end).
 */

export type DemoSource = 'typed' | 'example' | 'dictated';

export interface DemoEntry {
  /** The person's own words, verbatim — the record contract's source of truth. */
  rawText: string;
  /** Canonical name (`canonicalLift`), or the typed words in title case. */
  exerciseName: string;
  /** ALWAYS kilograms, like every load in the app. Null when none was written. */
  weightKg: number | null;
  reps: number[];
  source: DemoSource;
  /** False when the reading came back from the real edge-function parser. */
  parsedLocally: boolean;
  /**
   * The unit as WRITTEN, for display only. Not in the task's field list and
   * kept anyway: someone who types `225lb` must not be shown `102 kg` back —
   * the card is supposed to be their own line, read.
   */
  unit: 'kg' | 'lb';
}

/** What the grammar can get out of one line, before a source is attached. */
export interface DemoReading {
  exerciseName: string;
  weightKg: number | null;
  reps: number[];
  unit: 'kg' | 'lb';
}

/** The demo's canned line — the exact shape `parse-eval-cases.json` covers. */
export const DEMO_EXAMPLE = 'bench 100kg 5,5,4';

// --- bounds -------------------------------------------------------------------
// Outside these a number is a typo, not training. They are deliberately wider
// than the stepper's range: this reads what a person WROTE, and refusing a real
// 260 kg deadlift would be worse than accepting an unlikely one.

const MAX_KG = 500;
const MAX_LB = 1100;
const MAX_REPS = 100;
const MAX_SETS = 20;

/**
 * The lifts the key-lift screen offers, with the shorthand people actually
 * type. Canonical names are spelled EXACTLY as `KEY_LIFTS` in the flow config,
 * so a demo line can pre-select a chip by string equality rather than by a
 * second fuzzy pass (`matchKeyLift`).
 */
const LIFT_ALIASES: Record<string, readonly string[]> = {
  'Bench press': ['bench', 'bench press', 'benchpress', 'bp', 'flat bench', 'barbell bench'],
  Squat: ['squat', 'squats', 'back squat', 'bs', 'barbell squat'],
  Deadlift: ['deadlift', 'deadlifts', 'dl', 'conventional deadlift'],
  // NO bare 'press': "incline db press", "leg press" and "chest press" are all
  // different movements, and a demo that renames one of them is worse than a
  // demo that keeps the words the person wrote.
  'Overhead press': ['ohp', 'overhead press', 'shoulder press', 'military press'],
  'Pull-ups': ['pull up', 'pull ups', 'pullup', 'pullups', 'pull-up', 'pull-ups', 'chin up', 'chin ups', 'chinup', 'chinups'],
  'Barbell row': ['row', 'rows', 'barbell row', 'bb row', 'bent over row', 'pendlay row'],
};

const normalize = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, ' ');

/**
 * A typed movement resolved to the name the rest of the flow uses, or null when
 * nothing matches. Alias-first, exactly like `db/exercises.ts` resolves a parsed
 * item — the difference is that this one runs with no database and no account.
 */
export function canonicalLift(name: string): string | null {
  const needle = normalize(name);
  if (!needle) return null;
  for (const [canonical, aliases] of Object.entries(LIFT_ALIASES)) {
    if (normalize(canonical) === needle) return canonical;
    if (aliases.includes(needle)) return canonical;
  }
  // A written line rarely stops at the movement ("bench press touch and go"),
  // so an alias CONTAINED in the words still resolves — longest alias first, so
  // "bench press" never loses to "press".
  const ranked = Object.entries(LIFT_ALIASES).flatMap(([canonical, aliases]) =>
    aliases.map((alias) => ({ canonical, alias })),
  );
  ranked.sort((a, b) => b.alias.length - a.alias.length);
  for (const { canonical, alias } of ranked) {
    if (needle === alias || needle.startsWith(`${alias} `) || needle.endsWith(` ${alias}`) || needle.includes(` ${alias} `)) {
      return canonical;
    }
  }
  return null;
}

/**
 * Which of the OFFERED lifts a demo line is about, or null. The offered list is
 * the flow's own (`KEY_LIFTS`), passed in so this file does not import a config
 * that only loads inside Metro.
 */
export function matchKeyLift(exerciseName: string, offered: readonly string[]): string | null {
  const canonical = canonicalLift(exerciseName);
  const needle = normalize(exerciseName);
  for (const lift of offered) {
    if (canonical && normalize(lift) === normalize(canonical)) return lift;
    if (normalize(lift) === needle) return lift;
  }
  return null;
}

/** Title case for a movement nobody has an alias for — "incline db press". */
function titleCase(words: string): string {
  const trimmed = words.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** `5,5,4` / `5 5 4` / `5x5` / `3 x 8` → the reps of each set, or null. */
function readReps(text: string): number[] | null {
  const setsByReps = text.match(/(\d{1,2})\s*[x×]\s*(\d{1,3})/i);
  if (setsByReps) {
    const sets = Number.parseInt(setsByReps[1]!, 10);
    const reps = Number.parseInt(setsByReps[2]!, 10);
    if (sets >= 1 && sets <= MAX_SETS && reps >= 1 && reps <= MAX_REPS) {
      return Array.from({ length: sets }, () => reps);
    }
    return null;
  }

  // A separated list: 5,5,4 — commas, slashes, or plain spaces between them.
  const list = text.match(/\b\d{1,3}(?:\s*[,/]\s*\d{1,3})+\b/);
  if (list) {
    const reps = list[0]!
      .split(/[,/]/)
      .map((n) => Number.parseInt(n.trim(), 10))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= MAX_REPS);
    return reps.length > 0 ? reps : null;
  }
  return null;
}

/**
 * Read one written line. Returns null when there is nothing here a record could
 * be made of — which is a first-class answer, not a failure (see the file note).
 */
export function parseDemoLine(input: string): DemoReading | null {
  const line = String(input ?? '').replace(/\s+/g, ' ').trim();
  if (!line || line.length > 200) return null;

  // 1. The weight: a number wearing a unit wins outright; otherwise the first
  //    bare number that is not part of the rep list (see below).
  let unit: 'kg' | 'lb' = 'kg';
  let weight: number | null = null;
  let weightAt = -1;
  const united = line.match(/(\d{1,4}(?:[.,]\d{1,2})?)\s*(kgs?|kilos?|kilograms?|lbs?|pounds?)\b/i);
  if (united) {
    const value = Number.parseFloat(united[1]!.replace(',', '.'));
    const written = united[2]!.toLowerCase();
    unit = written.startsWith('lb') || written.startsWith('pound') ? 'lb' : 'kg';
    const ceiling = unit === 'lb' ? MAX_LB : MAX_KG;
    // A number wearing a unit is unambiguous, so an impossible one makes the
    // WHOLE line unreadable rather than a line with no load: reading `9000kg
    // 5,5,5` back as "three sets, no weight" would be a misquote of what the
    // person wrote, and the demo's honest answer to that is the canned example.
    if (!Number.isFinite(value) || value <= 0 || value > ceiling) return null;
    weight = value;
    weightAt = united.index ?? -1;
  }

  // 2. The reps, read from what is left after the weight is taken out — so the
  //    100 in "100kg 5,5,4" can never be mistaken for a set of a hundred.
  const withoutWeight =
    weightAt >= 0 ? line.slice(0, weightAt) + ' ' + line.slice(weightAt + united![0]!.length) : line;
  const reps = readReps(withoutWeight);
  if (!reps || reps.length === 0) return null;

  // 3. A bare weight: the biggest remaining number that is not one of the reps,
  //    which is how "squat 100 5x5" reads to a person.
  if (weight == null) {
    const repText = withoutWeight.match(/(\d{1,2})\s*[x×]\s*(\d{1,3})|\b\d{1,3}(?:\s*[,/]\s*\d{1,3})+\b/);
    const withoutReps = repText ? withoutWeight.replace(repText[0]!, ' ') : withoutWeight;
    const bare = [...withoutReps.matchAll(/\b(\d{1,4}(?:[.,]\d{1,2})?)\b/g)]
      .map((m) => Number.parseFloat(m[1]!.replace(',', '.')))
      .filter((n) => Number.isFinite(n) && n > 0 && n <= MAX_KG);
    if (bare.length > 0) {
      weight = Math.max(...bare);
      weightAt = line.indexOf(String(bare[0]));
    }
  }

  // 4. The movement: the words BEFORE the first number of the line. Everything
  //    a person writes after the numbers is a comment on the set, not a name.
  const firstNumber = line.search(/\d/);
  const words = (firstNumber > 0 ? line.slice(0, firstNumber) : '').replace(/[^\p{L}\s-]/gu, ' ').trim();
  if (words.length < 2) return null;

  const canonical = canonicalLift(words);
  return {
    exerciseName: canonical ?? titleCase(words),
    weightKg: weight == null ? null : toKilograms(weight, unit),
    reps,
    unit,
  };
}

/** A written load in kilograms, rounded to a load a bar can actually hold. */
export function toKilograms(value: number, unit: 'kg' | 'lb'): number {
  const kg = unit === 'lb' ? value / LB_PER_KG : value;
  return Math.round(kg * 100) / 100;
}

/** Kilograms back in the unit the person wrote, on a real plate jump. */
export function inWrittenUnit(kg: number, unit: 'kg' | 'lb'): number {
  const value = unit === 'lb' ? kg * LB_PER_KG : kg;
  return toPlate(value, unit);
}

/** The smallest jump that still counts, in the person's unit (`loadStep`). */
export function demoIncrement(unit: 'kg' | 'lb'): number {
  return loadStep(unit);
}

/** A reading plus how it was made — what the store keeps. */
export function toDemoEntry(
  rawText: string,
  reading: DemoReading,
  source: DemoSource,
  parsedLocally: boolean,
): DemoEntry {
  return {
    rawText: rawText.trim(),
    exerciseName: reading.exerciseName,
    weightKg: reading.weightKg,
    reps: reading.reps,
    source,
    parsedLocally,
    unit: reading.unit,
  };
}

// --- storage ------------------------------------------------------------------
// The answers store holds STRINGS (see `state/onboarding.ts`), and this is the
// one answer that is an object. JSON, validated on the way back in: a snapshot
// written by an older build must degrade to "no demo", never to a crash.

export function serializeDemoEntry(entry: DemoEntry): string {
  return JSON.stringify(entry);
}

export function parseDemoEntry(raw: string | null | undefined): DemoEntry | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const o = parsed as Record<string, unknown>;
    const rawText = typeof o.rawText === 'string' ? o.rawText.trim() : '';
    const exerciseName = typeof o.exerciseName === 'string' ? o.exerciseName.trim() : '';
    if (!rawText || !exerciseName) return null;
    const weight = typeof o.weightKg === 'number' && Number.isFinite(o.weightKg) && o.weightKg > 0 ? o.weightKg : null;
    const reps = Array.isArray(o.reps)
      ? o.reps.filter((r): r is number => typeof r === 'number' && Number.isInteger(r) && r > 0 && r <= MAX_REPS)
      : [];
    const source: DemoSource =
      o.source === 'example' || o.source === 'dictated' || o.source === 'typed' ? o.source : 'typed';
    return {
      rawText,
      exerciseName,
      weightKg: weight,
      reps,
      source,
      parsedLocally: o.parsedLocally !== false,
      unit: o.unit === 'lb' ? 'lb' : 'kg',
    };
  } catch {
    return null;
  }
}
