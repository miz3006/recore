/**
 * Session receipt (CLAUDE.md §9) — PURE, zero I/O, runs under `node --test`.
 *
 * When a whole workout is typed in at once (the end-of-session "dump"), the
 * per-line gutter is replaced by ONE summary under the note: what the app
 * understood and what it means. Same voice as the gutter — mono numbers,
 * ↑ = ↓ PR — just relocated. The note itself is never rewritten; the receipt
 * is a projection below it.
 */
import { type GutterSignal, type LineSignal, type ParseResult } from './types.ts';
import {
  countedSets,
  doneKeyFor,
  parsedDistance,
  parsedVolume,
  setsLineText,
  setTableOf,
  type SetTable,
} from './summarize.ts';

export interface ReceiptRow {
  /** Physical line — long-press opens the FixSheet for it. */
  line: number;
  /** Canonical exercise — tap opens the ExerciseSheet for it. */
  exercise: string;
  /** Faithful per-set reading, e.g. "82.5 kg × 8·8·8·8", "80 kg × 8·7·6",
   * "120·100·90 kg × 10·15·8", "16·16·15", "60 s" — every working set as typed,
   * never a collapsed top set. Ready to render as-is. */
  setText: string;
  /** The SAME sets, one per row, for the mini table under the exercise name.
   * `setText` stays the compact voice (previews, done keys, tight sheets). */
  table: SetTable;
  /** Comparison vs the previous session (↑ = ↓ PR). Null = no history yet —
   * the signal column stays SILENT, not labeled. */
  signal: GutterSignal | null;
}

export interface ReceiptData {
  rows: ReceiptRow[];
  /** Counted sets (non-warmup, non-drop) across the session. */
  totalSets: number;
  /** Volume in kg, warm-ups excluded. */
  volume: number;
  /** Distance in meters (runs, sled, carries) — a run-only session totals
   * in km instead of an empty 0 kg. */
  distanceM: number;
}

/**
 * Build the receipt from a parsed result and its per-line signals. A line's
 * comparison signal belongs to the FIRST item on that line (supersets share a
 * physical line but the gutter computed one signal per line); echo-kind
 * signals ('set') are not comparisons and never show in the signal column —
 * the set text already says what happened.
 */
/** The exercise words the user actually typed on a line — everything before
 * the first digit ("tricpes 27kgx12x2" → "tricpes"). Empty when the line
 * starts with a number or has no letters. */
export function typedNameOf(lineText: string): string {
  const beforeDigit = lineText.split(/\d/, 1)[0] ?? '';
  return beforeDigit
    .replace(/[^\p{L} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Letters-only, plural-insensitive comparison key ("Weighted Dips" →
 * "weighteddip"). The shared currency of all loose name matching. */
export function nameKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}]+/gu, '')
    .replace(/s$/u, '');
}

/**
 * Loose same-exercise test: keys with containment either way — "dips" matches
 * "Dip", "incline smith machine" matches "Incline Smith Machine Press". A typo
 * like "tricpes" does NOT match "Triceps Pushdown": that's a real correction,
 * worth marking in the ledger. Keys under three letters never match — a
 * two-letter fragment contains no evidence.
 */
export function namesMatch(a: string, b: string): boolean {
  const ka = nameKey(a);
  const kb = nameKey(b);
  if (ka.length < 3 || kb.length < 3) return false;
  return ka.includes(kb) || kb.includes(ka);
}

/**
 * Which plan row does a typed/parsed exercise name check off? Exact key
 * equality wins outright; otherwise a SINGLE unambiguous containment match;
 * anything ambiguous ("press" against both Bench Press and Overhead Press)
 * checks nothing — silence beats a guess (CLAUDE.md §7.4).
 */
export function matchPlanIndex(name: string, planKeys: string[]): number | null {
  const n = nameKey(name);
  if (n.length < 3) return null;

  const exact = planKeys.findIndex((k) => k === n);
  if (exact !== -1) return exact;

  let found = -1;
  for (let i = 0; i < planKeys.length; i++) {
    const k = planKeys[i]!;
    if (k.length < 3) continue;
    if (k.includes(n) || n.includes(k)) {
      if (found !== -1 && planKeys[found] !== k) return null; // ambiguous
      if (found === -1) found = i;
    }
  }
  return found === -1 ? null : found;
}

/**
 * The last set on the record right now — "Bench Press · 120 × 5".
 *
 * Today's resting pill uses it as the live context DURING a session, where the
 * day's running total is the one number the athlete already knows and the set
 * they just finished is the one they are still thinking about. It reads the
 * bottom of the receipt (the last row's last COUNTED set) rather than tracking
 * anything of its own: a warm-up or a set marked not-done is not what you just
 * did, by the same rule that keeps them out of the totals.
 *
 * Null when there is nothing counted to report.
 */
export interface LastSet {
  exercise: string;
  /** "120 × 5", "5 km", "1:30" — ready to render, unit already attached. */
  reading: string;
}

export function lastSetOf(receipt: ReceiptData): LastSet | null {
  for (let i = receipt.rows.length - 1; i >= 0; i--) {
    const row = receipt.rows[i]!;
    const counted = row.table.rows.filter((r) => r.counted);
    const set = counted[counted.length - 1];
    if (!set) continue;

    const load = set.load && set.load !== 'bw' ? `${set.load}${row.table.loadHead === 'KG' ? ' kg' : ''}` : '';
    const reading = load && set.work ? `${load} × ${set.work}` : load || set.work;
    if (!reading) continue;
    return { exercise: row.exercise, reading };
  }
  return null;
}

export function buildReceipt(
  result: ParseResult,
  signals: LineSignal[],
  /** Keys of exercises the user marked NOT DONE — kept as rows (the record
   * stays) but excluded from the session totals (they weren't performed). */
  undone: Set<string> = new Set(),
): ReceiptData {
  const signalByLine = new Map<number, GutterSignal>();
  for (const s of signals) {
    if (s.signal.kind !== 'set' && !signalByLine.has(s.line)) {
      signalByLine.set(s.line, s.signal);
    }
  }

  const rows: ReceiptRow[] = [];
  const linesUsed = new Set<number>();

  for (const item of result.items) {
    const setText = setsLineText(item.sets);
    if (!setText) continue;

    const first = !linesUsed.has(item.line);
    linesUsed.add(item.line);

    rows.push({
      line: item.line,
      exercise: item.exercise,
      setText,
      table: setTableOf(item.sets),
      signal: first ? (signalByLine.get(item.line) ?? null) : null,
    });
  }

  // Totals count only PERFORMED work — "not done" cards stay above as rows but
  // never inflate the tonnage/sets (the same rule warm-ups follow).
  const performed = undone.size
    ? {
        ...result,
        items: result.items.filter(
          (it) => !undone.has(doneKeyFor(it.exercise, setsLineText(it.sets) ?? '')),
        ),
      }
    : result;

  return {
    rows,
    totalSets: countedSets(performed),
    volume: parsedVolume(performed),
    distanceM: parsedDistance(performed),
  };
}
