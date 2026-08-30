// Relative + .ts extension: this file is BOTH bundled by Metro AND run under
// `node --test` (which can't resolve the `@/` alias) — the same pattern as
// onboarding.ts, streak.ts and plan/prescribe.ts.
import { canonicalName, readWrittenLine, splitSegments, type ReadItem } from './demo-read.ts';
import { LB_PER_KG, loadStep, toPlate } from './onboarding.ts';
import type { ParsedItem, ParseResult } from './parse/types.ts';

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

// --- the grammar ---------------------------------------------------------------

/**
 * READING A LINE IS `lib/demo-read.ts` (23 Aug 2026, owner: "use the same
 * parser logic as in Today, it does not read well").
 *
 * This file used to hold the grammar itself — one weight, one rep list, one
 * exercise per line — and it read 41 of the 79 lines in the corpus the REAL
 * parser is evaluated against, several of them wrongly (`100x8 90x10` came back
 * as a hundred sets of eight). The grammar moved to its own file, was rebuilt
 * around the shapes people actually write, and is scored against that corpus on
 * every test run. What stayed here is the flow's own vocabulary: the answers it
 * stores, the units it displays, and the `ParseResult` it hands to Today's
 * receipt.
 */

/** Reps above this are a typo, not training — the storage validator's bound. */
const MAX_REPS = 100;

/** A movement resolved to the name the rest of the flow uses, or null. */
export function canonicalLift(name: string): string | null {
  return canonicalName(name);
}

/**
 * Which of the OFFERED lifts a demo line is about, or null. The offered list is
 * the flow's own (`KEY_LIFTS`), passed in so this file does not import a config
 * that only loads inside Metro.
 */
export function matchKeyLift(exerciseName: string, offered: readonly string[]): string | null {
  const canonical = canonicalLift(exerciseName);
  const needle = nameKeyOf(exerciseName);
  for (const lift of offered) {
    if (canonical && nameKeyOf(lift) === nameKeyOf(canonical)) return lift;
    if (nameKeyOf(lift) === needle) return lift;
  }
  return null;
}

const nameKeyOf = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Read ONE line as a single reading — the shape the store keeps and the shape
 * the remote parser answers in. A line carrying several movements answers with
 * the first of them; the demo screen reads the page with `demoParseText`, which
 * keeps them all.
 */
export function parseDemoLine(input: string): DemoReading | null {
  const item = readWrittenLine(input)[0];
  if (!item) return null;
  const reps = item.sets.map((s) => s.reps).filter((r): r is number => r != null && r > 0);
  if (reps.length === 0) return null;
  const weights = item.sets
    .map((s) => s.weightKg)
    .filter((w): w is number => w != null && w > 0);
  return {
    exerciseName: item.name,
    weightKg: weights.length > 0 ? Math.max(...weights) : null,
    reps,
    unit: item.unit,
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

// --- the page, as the app's own parse result ---------------------------------

/**
 * THE DEMO READS A PAGE THE WAY TODAY READS ONE (owner, 23 Aug 2026: "make the
 * parser actually work exactly like it does in Today — everything the same,
 * the table too").
 *
 * `parseDemoLine` above answers one line with a `DemoReading`, which was enough
 * when the demo screen drew its own little card. The demo screen is Today now,
 * and Today does not render readings — it renders a `ParseResult` through
 * `buildReceipt`, which is what produces the per-set table, the compact set
 * text, the done keys and the totals. So this turns what the grammar reads into
 * exactly that shape, and the screen renders it with the app's own components.
 *
 * Two consequences worth naming:
 *
 *  · **Several exercises on one line work.** `bench 3x8, rows 3x10` is two
 *    cards in Today and is two cards here (`splitLineSegments`). A rep list is
 *    never split: the separator only counts when WORDS follow it, so
 *    `bench 100kg 5,5,4` stays one exercise.
 *  · **What the grammar cannot read is kept, not lost.** A line with no items
 *    renders as Today renders one — the words, "kept as a note · not counted" —
 *    and it still reaches the record verbatim at signup, where the real parser
 *    reads it like any other line.
 *
 * WHAT IT IS NOT: the app's parser. That one is an edge function behind a user
 * JWT (§7.3) and there is no account on the fourth screen of a funnel. This is
 * the same small offline grammar it always was, wearing the app's own result
 * shape so that everything DOWNSTREAM of the parse — the receipt, the table,
 * the totals — is genuinely the same code rather than a lookalike.
 */

/**
 * Zero, and deliberately not `CLIENT_PARSE_VERSION`: nothing this function
 * produces is ever cached, written to SQLite, or synced. A demo result that
 * carried the real version number could be mistaken for one.
 */
export const DEMO_PARSE_VERSION = 0;

/**
 * One physical line, split where a NEW exercise starts. The rule and its one
 * safety (a separator only counts when WORDS follow it, so `5,5,4` is never
 * split) live with the grammar; this re-export is what the flow and its tests
 * have always called it.
 */
export function splitLineSegments(line: string): string[] {
  return splitSegments(line);
}

/** One reading as a parsed item on a given physical line. */
export function demoItemOf(reading: DemoReading, line: number): ParsedItem {
  return itemOf(
    {
      name: reading.exerciseName,
      unit: reading.unit,
      sets: reading.reps.map((reps) => ({
        kind: 'working' as const,
        reps,
        weightKg: reading.weightKg,
        distanceM: null,
        durationS: null,
        rir: null,
      })),
    },
    line,
  );
}

/** One read exercise as the app's own parsed item. */
function itemOf(item: ReadItem, line: number): ParsedItem {
  return {
    exercise: item.name,
    aliases_seen: [],
    // The modality the sets themselves describe: a distance or a duration with
    // no reps is cardio, everything else is strength. Nothing here guesses.
    modality: item.sets.some((s) => s.reps == null && (s.distanceM != null || s.durationS != null))
      ? 'cardio'
      : 'strength',
    group_key: null,
    line,
    sets: item.sets.map((s) => ({
      kind: s.kind,
      reps: s.reps,
      weight_kg: s.weightKg,
      distance_m: s.distanceM,
      duration_s: s.durationS,
      rir: s.rir,
      parent: null,
      note: null,
    })),
  };
}

/** The whole written page, as the result `buildReceipt` expects. */
export function demoParseText(text: string): ParseResult {
  const items: ParsedItem[] = [];
  const lines = String(text ?? '').split('\n');
  for (let line = 0; line < lines.length; line++) {
    for (const item of readWrittenLine(lines[line]!)) items.push(itemOf(item, line));
  }
  return { items, parse_version: DEMO_PARSE_VERSION };
}

/**
 * A parsed item back as the answer the flow stores (`demoEntries`). The load is
 * the heaviest working set, which is what every later screen means by "what you
 * work with now"; the unit is the one the line was WRITTEN in, so somebody who
 * typed 225 lb is never shown 102 kg back on the key-lift screen.
 */
export function demoEntryOfItem(item: ParsedItem, rawLine: string): DemoEntry {
  const weights = item.sets
    .map((s) => s.weight_kg)
    .filter((w): w is number => w != null && w > 0);
  return {
    rawText: rawLine.trim(),
    exerciseName: item.exercise,
    weightKg: weights.length > 0 ? Math.max(...weights) : null,
    reps: item.sets.map((s) => s.reps).filter((r): r is number => r != null && r > 0),
    source: 'typed',
    parsedLocally: true,
    // A digit in front, and no leading \b: "225lb" has no word boundary
    // between the 5 and the l, which is exactly how people write it.
    unit: /\d\s*(?:lbs?|pounds?)\b/i.test(rawLine) ? 'lb' : 'kg',
  };
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

/**
 * THE WHOLE PAGE, not one line (owner, 23 Aug 2026: the demo screen became the
 * Today page and takes two or three exercises).
 *
 * `demoEntry` still holds the LEAD entry — the one the key-lift chip, the
 * overload card and the projection were already built out of — so nothing
 * downstream had to change to keep working. This array holds every line that
 * READ, in the order it was written, and it is what the key-lift screen now
 * pre-selects up to three chips from.
 *
 * A stored array from an older build, a truncated row, an object where a list
 * belongs: every one of them degrades to "no lines", never to a crash.
 */
export function serializeDemoEntries(entries: readonly DemoEntry[]): string {
  return JSON.stringify(entries);
}

export function parseDemoEntries(raw: string | null | undefined): DemoEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: DemoEntry[] = [];
    for (const item of parsed) {
      const entry = parseDemoEntry(JSON.stringify(item));
      if (entry) out.push(entry);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * The one entry the rest of the flow is built out of, chosen from a page of
 * them: the first that carries a LOAD, and otherwise the first that read at
 * all.
 *
 * The load is the tie-breaker because of what reads it downstream — the
 * overload card's two weeks and the projection's start-to-target are both
 * arithmetic on a starting number, and an entry with no weight ("pull ups
 * 3x8") sends both to their fallbacks while a perfectly good `squat 100kg 5x5`
 * sits one line below it.
 */
export function leadDemoEntry(entries: readonly DemoEntry[]): DemoEntry | null {
  return entries.find((e) => e.weightKg != null && e.weightKg > 0) ?? entries[0] ?? null;
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
