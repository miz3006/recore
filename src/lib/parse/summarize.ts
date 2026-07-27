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

/** Working-set kinds excluded from all counted math: warm-ups (CLAUDE.md §3),
 * drops (they chain off a parent, not the day's top effort), and `'skipped'` —
 * an exercise the user wrote but marked NOT DONE (recorded, not performed), so
 * it must never inflate tonnage/sets/records anywhere. */
const skipped = (kind: string) => kind === 'warmup' || kind === 'drop' || kind === 'skipped';

/** The stable identity of a composer card / exercise occurrence for the "done"
 * checklist — exercise name + its sets text. Pure so it can be shared by the
 * parser, the receipt, and the store without pulling in any I/O. */
export const doneKeyFor = (exercise: string, setText: string): string => `${exercise} ${setText}`;

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

/** "5·5·5" for a handful of sets, "5 ×8" once there are more than three. */
function joinReps(reps: number[]): string {
  if (reps.length > 3 && reps.every((r) => r === reps[0])) return `${reps[0]} ×${reps.length}`;
  return reps.join('·');
}

/**
 * The FAITHFUL one-line reading of an exercise's sets for the ledger card — it
 * shows EVERY working set's real weight and reps, never a collapsed top set
 * (that was the display bug where "120x10 100x15 90x8" rendered "120 kg ×
 * 10·10·10"). Uniform work stays compact ("100 kg × 5·5·5", "16·16·16"); when
 * only the reps vary the true sequence shows ("80 kg × 8·7·6"); when the weight
 * changes per set each set keeps its own weight, positionally aligned with its
 * reps ("120·100·90 kg × 10·15·8"). Cardio/holds/carries fall back to the top
 * summary voice. Warm-ups and drops are excluded (record contract). Null when
 * there is nothing countable to show.
 */
export function setsLineText(sets: SummarizableSet[]): string | null {
  const counted = sets.filter((s) => !skipped(s.kind));
  if (counted.length === 0) return null;

  const repBased = counted.every(
    (s) => s.reps != null && s.distance_m == null && s.duration_s == null,
  );
  if (repBased) {
    const weights = counted.map((s) => s.weight_kg);
    const reps = counted.map((s) => s.reps as number);

    if (weights.every((w) => w == null)) return joinReps(reps); // bodyweight
    if (weights.every((w) => w === weights[0])) {
      return `${fmtNumber(weights[0] as number)} kg × ${joinReps(reps)}`;
    }
    // Weight changes per set → show each set's real weight next to its reps.
    const weightText = weights.map((w) => (w == null ? 'bw' : fmtNumber(w))).join('·');
    return `${weightText} kg × ${reps.join('·')}`;
  }

  // Cardio / holds / carries keep the existing top-set summary voice.
  return echoTextOf(topOfSets(sets));
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
