import { type GutterSignal, type LineSignal, type ParseResult } from './types.ts';
import { countedSets, doneKeyFor, parsedDistance, parsedVolume, setsLineText } from './summarize.ts';

/**
 * What a day adds up to — pure, zero I/O, `node --test`-runnable.
 *
 * This is what v2 called the "receipt", and the name went with the feature: §8.8
 * removed receipt MODE (a summary that appeared only when ≥ 4 exercises were
 * typed inside a minute, so the same action produced different screens on
 * different days). The arithmetic survived it, because the accessory bar's
 * running total and the session summary both need exactly these numbers.
 */

export interface SessionRow {
  /** Physical line — long-press opens the repair sheet for it. */
  line: number;
  /** Canonical exercise — tap opens its Lift. */
  exercise: string;
  /** The faithful per-set reading, every working set as typed (§8.3). */
  setText: string;
  /** Comparison vs the previous session. Null = no history yet, so: silence. */
  signal: GutterSignal | null;
}

export interface SessionTotals {
  rows: SessionRow[];
  /** Counted sets (non-warmup, non-drop) across the session. */
  totalSets: number;
  /** Volume in kg, warm-ups excluded — always, everywhere (§18.2). */
  volume: number;
  /** Distance in metres. A run-only session totals in km, not an empty 0 kg. */
  distanceM: number;
}

export function buildSessionTotals(
  result: ParseResult,
  signals: LineSignal[],
  /** Keys of exercises the user marked NOT DONE — kept as rows (the record
   * stays) but excluded from the session totals (they weren't performed). */
  undone: Set<string> = new Set(),
): SessionTotals {
  const signalByLine = new Map<number, GutterSignal>();
  for (const s of signals) {
    if (s.signal.kind !== 'set' && !signalByLine.has(s.line)) {
      signalByLine.set(s.line, s.signal);
    }
  }

  const rows: SessionRow[] = [];
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
