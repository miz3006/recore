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
  /** Reps in reserve, when the line carried one ("bench 100x8 @2"). */
  rir?: number | null;
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

// --- The per-set mini table (owner, 4 Aug 2026) ------------------------------
// `setsLineText` compresses an exercise into ONE faithful line, which stops
// being readable the moment a pyramid or a long run of sets arrives
// ("120·100·90 kg × 10·15·8" is exact and still has to be decoded). The ledger
// card and the receipt therefore show the same sets as a small TABLE — one set
// per row, columns aligned in tabular mono, so a session is scanned instead of
// parsed by eye. Nothing new is computed here: every cell is a set the parser
// already read, and the counted contract (warm-ups/drops/skipped stay out of
// the totals) is unchanged — they are simply visible now, labelled for what
// they are.

/** One rendered set — pure text, ready for a row. */
export interface SetTableRow {
  /** "1", "2", … over COUNTED sets; "warm", "drop", "skip" for the rest. */
  label: string;
  /** Load cell: "100", "bw" when this set alone is unloaded, "" for cardio. */
  load: string;
  /** Work cell: reps "10", distance "400 m", duration "1:30". */
  work: string;
  /** Trailing meta: "RIR 2", plus any second metric the work cell cannot hold. */
  note: string;
  /** Counts toward the session totals (non-warmup, non-drop, non-skipped). */
  counted: boolean;
}

export interface SetTable {
  rows: SetTableRow[];
  /** Header over the load column — null when nothing here is loaded. */
  loadHead: string | null;
  /** Header over the work column: "REPS" · "DIST" · "TIME". */
  workHead: string | null;
  /** At least one row has a note, so the column is worth its width. */
  hasNote: boolean;
}

/** "45 s" under a minute, "1:30" above it. */
export function formatDurationShort(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const m = Math.floor(seconds / 60);
  const r = Math.round(seconds % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** The label a non-counted set carries in the position column. */
function kindLabel(kind: string): string | null {
  if (kind === 'warmup') return 'warm';
  if (kind === 'drop') return 'drop';
  if (kind === 'skipped') return 'skip';
  return null;
}

/**
 * Every set of one exercise as table rows. Warm-ups, drops and skipped work are
 * KEPT as rows (labelled, never numbered) because the record is the record —
 * they are only excluded from the counted numbering, exactly as they are
 * excluded from tonnage everywhere else.
 */
export function setTableOf(sets: SummarizableSet[]): SetTable {
  const anyLoad = sets.some((s) => s.weight_kg != null);
  const anyReps = sets.some((s) => s.reps != null);
  const anyDistance = sets.some((s) => s.distance_m != null);
  const anyDuration = sets.some((s) => s.duration_s != null);

  const rows: SetTableRow[] = [];
  let counted = 0;

  for (const s of sets) {
    const isCounted = !skipped(s.kind);
    if (isCounted) counted += 1;

    const notes: string[] = [];
    if (s.rir != null) notes.push(`RIR ${fmtNumber(s.rir)}`);

    // One metric owns the work column; a second one rides along as a note, so a
    // weighted carry ("40 kg × 20 m in 60 s") loses nothing.
    let work = '';
    if (s.reps != null) {
      work = String(s.reps);
      if (s.distance_m != null) notes.push(formatDistanceTotal(s.distance_m));
      if (s.duration_s != null) notes.push(formatDurationShort(s.duration_s));
    } else if (s.distance_m != null) {
      work = formatDistanceTotal(s.distance_m);
      if (s.duration_s != null) notes.push(formatDurationShort(s.duration_s));
    } else if (s.duration_s != null) {
      work = formatDurationShort(s.duration_s);
    }

    rows.push({
      label: kindLabel(s.kind) ?? String(counted),
      load: s.weight_kg != null ? fmtNumber(s.weight_kg) : anyLoad ? 'bw' : '',
      work,
      note: notes.join(' · '),
      counted: isCounted,
    });
  }

  return {
    rows,
    loadHead: anyLoad ? 'KG' : null,
    workHead: anyReps ? 'REPS' : anyDistance ? 'DIST' : anyDuration ? 'TIME' : null,
    hasNote: rows.some((r) => r.note.length > 0),
  };
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
