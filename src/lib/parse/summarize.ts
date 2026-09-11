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
  /**
   * Index of the set this one hangs off, for a drop or myo chain. Present on
   * `ParsedSet`; absent on the SQLite row shape, which carries the same fact as
   * `parent_set_id` and is not read here. A row without it still marks the
   * chain from its KIND, which is why this is optional rather than required.
   */
  parent?: number | null;
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

/**
 * The same identity, made UNIQUE when a note repeats itself.
 *
 * `doneKeyFor` alone is not an identity when two cards read the same — a note
 * that says "plank 3x60s" twice, or a circuit written out round by round,
 * produced ONE key for both cards. Un-checking either un-checked both, and
 * `applyParseResult` then marked both occurrences `'skipped'`: half a session
 * quietly out of the tonnage because one of its twins was not performed. In
 * `LiveLedger` the same string was also the React key, so the duplicate was a
 * rendering warning as well.
 *
 * The FIRST occurrence keeps the plain key, so checks stored by an earlier
 * build still match; later ones carry their number. Call the returned function
 * once per item, in the order the items are read, and every consumer of the
 * same result agrees.
 */
export function makeDoneKeyer(): (exercise: string, setText: string) => string {
  const seen = new Map<string, number>();
  return (exercise, setText) => {
    const base = doneKeyFor(exercise, setText);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} #${count + 1}`;
  };
}

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

  /**
   * Cardio, holds and carries keep the top-set summary voice — but with EVERY
   * metric the sets carry, not the first one only.
   *
   * `echoTextOf` answers with a single fact and stops, which is right for the
   * gutter's one-line echo and wrong here: a loaded carry ("farmers carry 2x40m
   * 32kg") rendered "32 kg" with no distance, a weighted plank ("plank +10kg
   * 45s") rendered "10 kg" with no time, and a rowed 2 km with a split ("row
   * 2000m 7:45") rendered "2000 m" with no time. The dropped half is the half
   * those lines exist for. The per-set TABLE has always shown both (it rides
   * the second metric along as a note); this is the compact line catching up.
   */
  const top = topOfSets(sets);
  const scheme = top.repsAtWeight != null ? `${top.count}×${top.repsAtWeight}` : null;
  const parts: string[] = [];
  if (scheme && top.weight != null) parts.push(`${scheme} ${fmtNumber(top.weight)}`);
  else if (scheme) parts.push(scheme);
  else if (top.weight != null) parts.push(`${fmtNumber(top.weight)} kg`);
  if (top.distance != null) {
    parts.push(
      top.count > 1
        ? `${top.count}× ${fmtNumber(top.distance / top.count)} m`
        : `${fmtNumber(top.distance)} m`,
    );
  }
  if (top.duration != null) {
    // Beside a distance the time is that distance's SPLIT and reads as a clock
    // ("2000 m · 7:45"); on its own it is the work itself ("3× 60 s").
    parts.push(
      top.distance != null
        ? formatDurationShort(top.duration)
        : top.count > 1
          ? `${top.count}× ${top.duration} s`
          : `${top.duration} s`,
    );
  }
  return parts.length > 0 ? parts.join(' · ') : null;
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

/**
 * One rendered set — pure text, ready for a row.
 *
 * ## Kind and position are two facts, not one (11 September 2026)
 *
 * `label` used to be *either* the set's number *or* its kind ("warm", "drop",
 * "skip"), which quietly asserted that a set can only be one of those things.
 * Three of the six kinds the parser reads disagree: `amrap`, `myo` and
 * `failure` are COUNTED work — they have a number — and they were rendered as
 * a plain numbered set with the kind silently dropped. Someone who wrote "push
 * ups AMRAP 22" got a row that said `1 · 22` and nothing else; the parser had
 * read the AMRAP and the table threw it away.
 *
 * So the two facts are two fields. `label` is the position in the counted
 * numbering, `mark` is the word that REPLACES it when a set is outside that
 * numbering, and `kindTag` qualifies a set that is inside it. Exactly one of
 * `label` / `mark` is ever non-empty.
 */
export interface SetTableRow {
  /** "1", "2", … over COUNTED sets; "" when `mark` carries the position. */
  label: string;
  /** The word that stands in for a number: "warm-up" · "drop" · "skipped". */
  mark: string | null;
  /** A counted set's kind, when it is not plain work: "AMRAP" · "MYO" ·
   * "FAILURE". Uppercase because it is a LABEL on the set, not a reading. */
  kindTag: string | null;
  /** Load cell: "100", "bw" when this set alone is unloaded, "" for cardio. */
  load: string;
  /** Work cell: reps "10", distance "400 m", duration "1:30". */
  work: string;
  /**
   * Reps in reserve as digits — "2", "0", "-1". The word "RIR" is NOT in here:
   * the table sets the label and the number in two different faces (design
   * skill §Structure, "number and unit are typographically two things"), and a
   * caller that wants the sentence asks `setSentence`.
   */
  rir: string | null;
  /** The second metric the work cell could not hold — "1:00", "400 m". Only
   * that: the kind and the RIR have their own fields now. */
  note: string;
  /** This set hangs off the one above it (a drop or myo chain), so it indents
   * under its parent instead of starting a new position at the margin. */
  chained: boolean;
  /** Counts toward the session totals (non-warmup, non-drop, non-skipped). */
  counted: boolean;
}

export interface SetTable {
  rows: SetTableRow[];
  /** Header over the load column — null when nothing here is loaded. */
  loadHead: string | null;
  /** Work column header: "REPS" · "DIST" · "TIME". */
  workHead: string | null;
  /** At least one row says something beyond its numbers — an RIR, a kind, a
   * second metric. Drives the stacking threshold and `worthTable`. */
  hasNote: boolean;
}

/** "45 s" under a minute, "1:30" above it. */
export function formatDurationShort(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const m = Math.floor(seconds / 60);
  const r = Math.round(seconds % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

/**
 * The word that REPLACES a set's number, for the kinds that are outside the
 * counted numbering. Spelled out, not abbreviated: "warm" and "skip" were
 * clipped to fit a 38 pt column that no longer exists, and a truncated word is
 * a worse distinction than a whole one. Tone alone was never allowed to carry
 * this (low-vision ruling, 9 Aug 2026) — the WORD is the mark.
 */
function markOf(kind: string): string | null {
  if (kind === 'warmup') return 'warm-up';
  if (kind === 'drop') return 'drop';
  if (kind === 'skipped') return 'skipped';
  return null;
}

/**
 * The label a COUNTED set carries beside its number when it is not plain work.
 *
 * These three are the kinds the table used to lose entirely: they pass
 * `skipped()`, so they were numbered like any working set and their kind was
 * dropped on the floor. An AMRAP is not a set of 22 — it is a set taken to
 * whatever came, which happened to be 22, and the difference is the whole
 * reason someone wrote the word.
 */
function kindTagOf(kind: string): string | null {
  if (kind === 'amrap') return 'AMRAP';
  if (kind === 'myo') return 'MYO';
  if (kind === 'failure') return 'FAILURE';
  return null;
}

/**
 * Does this set hang off the one before it? A drop and a myo set are not
 * independent work — they continue the set above them, which is why neither
 * belongs at the left margin. `parent` says so outright when the parser
 * supplied it; the KIND says so on its own for a row shape that did not carry
 * one (SQLite keeps the same fact as `parent_set_id`).
 */
function chainedKind(s: SummarizableSet): boolean {
  return s.parent != null || s.kind === 'drop' || s.kind === 'myo';
}

/**
 * Every set of one exercise as table rows. Warm-ups, drops and skipped work are
 * KEPT as rows (marked, never numbered) because the record is the record — they
 * are only excluded from the counted numbering, exactly as they are excluded
 * from tonnage everywhere else. AMRAP, myo and failure sets ARE counted and now
 * keep their kind beside their number instead of losing it.
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

    // The ride-along lane holds ONLY a second measurement now. RIR and the
    // kind used to be joined into the same grey string, which is how "AMRAP ·
    // RIR 2 · 1:00" happened: three unlike facts in one sentence, none of them
    // findable. They are three fields and the table draws them three ways.
    const notes: string[] = [];

    // One metric owns the work column; a second one rides along, so a weighted
    // carry ("40 kg × 20 m in 60 s") loses nothing.
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

    const mark = markOf(s.kind);
    rows.push({
      // Exactly one of the two carries the position, never both.
      label: mark ? '' : String(counted),
      mark,
      kindTag: isCounted ? kindTagOf(s.kind) : null,
      load: s.weight_kg != null ? fmtNumber(s.weight_kg) : anyLoad ? 'bw' : '',
      work,
      // Digits only — the table draws the word "RIR" itself, in its own face.
      rir: s.rir != null ? fmtNumber(s.rir) : null,
      note: notes.join(' · '),
      chained: chainedKind(s),
      counted: isCounted,
    });
  }

  return {
    rows,
    loadHead: anyLoad ? 'KG' : null,
    workHead: anyReps ? 'REPS' : anyDistance ? 'DIST' : anyDuration ? 'TIME' : null,
    // Anything in the middle lane competes with the numbers for width, so all
    // three of its inhabitants count towards "this table needs more room".
    hasNote: rows.some((r) => r.note.length > 0 || r.rir != null || r.kindTag != null),
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
