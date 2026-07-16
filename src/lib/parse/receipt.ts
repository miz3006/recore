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
import { countedSets, echoTextOf, parsedVolume, topOfSets } from './summarize.ts';

export interface ReceiptRow {
  /** Physical line — long-press opens the FixSheet for it. */
  line: number;
  /** Canonical exercise — tap opens the ExerciseSheet for it. */
  exercise: string;
  /** Normalized top set, e.g. "4×8 82.5", "3×12", "60 s". */
  setText: string;
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
}

/**
 * Build the receipt from a parsed result and its per-line signals. A line's
 * comparison signal belongs to the FIRST item on that line (supersets share a
 * physical line but the gutter computed one signal per line); echo-kind
 * signals ('set') are not comparisons and never show in the signal column —
 * the set text already says what happened.
 */
export function buildReceipt(result: ParseResult, signals: LineSignal[]): ReceiptData {
  const signalByLine = new Map<number, GutterSignal>();
  for (const s of signals) {
    if (s.signal.kind !== 'set' && !signalByLine.has(s.line)) {
      signalByLine.set(s.line, s.signal);
    }
  }

  const rows: ReceiptRow[] = [];
  const linesUsed = new Set<number>();

  for (const item of result.items) {
    const setText = echoTextOf(topOfSets(item.sets));
    if (!setText) continue;

    const first = !linesUsed.has(item.line);
    linesUsed.add(item.line);

    rows.push({
      line: item.line,
      exercise: item.exercise,
      setText,
      signal: first ? (signalByLine.get(item.line) ?? null) : null,
    });
  }

  return { rows, totalSets: countedSets(result), volume: parsedVolume(result) };
}
