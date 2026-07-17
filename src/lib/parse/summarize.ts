/**
 * Pure set-summary helpers — zero I/O, shared by the gutter's signal math
 * (`db/history.ts`) and the session receipt (`parse/receipt.ts`), and
 * runnable under `node --test`. ONE voice for "what did this session do":
 * the echo text here is the same voice the ghost prediction speaks in.
 */
import { type ParseResult } from './types.ts';

/** The day's top effort for one exercise occurrence. */
export interface SetSummary {
  weight: number | null;
  repsAtWeight: number | null;
  distance: number | null;
  duration: number | null;
  /** How many counted (non-warmup, non-drop) sets there were. */
  count: number;
}

/** Works over parsed sets AND raw SQLite set rows — hence the loose kind. */
export interface SummarizableSet {
  kind: string;
  weight_kg: number | null;
  reps: number | null;
  distance_m: number | null;
  duration_s: number | null;
}

/** Working-set kinds that count toward "top set" comparisons: warm-ups are
 * excluded from all math (CLAUDE.md §3); drops chain off a parent and don't
 * represent the day's top effort. */
const skipped = (kind: string) => kind === 'warmup' || kind === 'drop';

export function topOfSets(sets: SummarizableSet[]): SetSummary {
  let weight: number | null = null;
  let repsAtWeight: number | null = null;
  let bodyweightReps: number | null = null; // best reps when NOTHING is loaded
  let distance = 0;
  let duration = 0;
  let hasDistance = false;
  let hasDuration = false;
  let count = 0;

  for (const s of sets) {
    if (skipped(s.kind)) continue;
    count += 1;
    if (s.weight_kg != null) {
      if (weight === null || s.weight_kg > weight) {
        weight = s.weight_kg;
        repsAtWeight = s.reps;
      } else if (s.weight_kg === weight && s.reps != null) {
        repsAtWeight = Math.max(repsAtWeight ?? 0, s.reps);
      }
    } else if (s.reps != null) {
      bodyweightReps = Math.max(bodyweightReps ?? 0, s.reps);
    }
    if (s.distance_m != null) {
      distance += s.distance_m;
      hasDistance = true;
    }
    if (s.duration_s != null) {
      duration = Math.max(duration, s.duration_s);
      hasDuration = true;
    }
  }

  return {
    weight,
    // Loaded sets own the top set; a purely bodyweight exercise (dips,
    // pull-ups) tops out at its best reps — without this, BW work never got
    // an echo OR a ↑/↓/= comparison.
    repsAtWeight: weight != null ? repsAtWeight : bodyweightReps,
    distance: hasDistance ? distance : null,
    duration: hasDuration ? duration : null,
    count,
  };
}

export const fmtNumber = (n: number): string => String(Math.round(n * 100) / 100);

/**
 * The normalized top set as text — "3×12 100" (sets×reps weight), "3×10" for
 * bodyweight, "4× 20 m", "60 s". Null when there is nothing to say.
 */
export function echoTextOf(top: SetSummary): string | null {
  const scheme = top.repsAtWeight != null ? `${top.count}×${top.repsAtWeight}` : null;

  if (top.weight != null) {
    return scheme ? `${scheme} ${fmtNumber(top.weight)}` : `${fmtNumber(top.weight)} kg`;
  }
  if (scheme != null) return scheme;
  if (top.distance != null) {
    return top.count > 1
      ? `${top.count}× ${fmtNumber(top.distance / top.count)} m`
      : `${fmtNumber(top.distance)} m`;
  }
  if (top.duration != null) {
    return top.count > 1 ? `${top.count}× ${top.duration} s` : `${top.duration} s`;
  }
  return null;
}

/** Session distance from PARSED sets (runs, sled, carries), in meters. The
 * page speaks kg first, but a run-only session totals in distance — Recore is
 * a training log, not only a barbell log. */
export function parsedDistance(result: ParseResult): number {
  let total = 0;
  for (const item of result.items) {
    for (const s of item.sets) {
      if (s.kind === 'warmup') continue;
      if (s.distance_m != null) total += s.distance_m;
    }
  }
  return Math.round(total);
}

/** "5.2 km" above a kilometer, "400 m" below it. */
export function formatDistanceTotal(meters: number): string {
  if (meters >= 1000) return `${Math.round(meters / 100) / 10} km`;
  return `${meters} m`;
}

/** Session volume from PARSED sets, excluding warm-ups (CLAUDE.md §3). */
export function parsedVolume(result: ParseResult): number {
  let total = 0;
  for (const item of result.items) {
    for (const s of item.sets) {
      if (s.kind === 'warmup') continue;
      if (s.reps != null && s.weight_kg != null) total += s.reps * s.weight_kg;
    }
  }
  return Math.round(total);
}

/** Counted sets across the whole session (non-warmup, non-drop). */
export function countedSets(result: ParseResult): number {
  let total = 0;
  for (const item of result.items) {
    for (const s of item.sets) {
      if (!skipped(s.kind)) total += 1;
    }
  }
  return total;
}
