import { entryNoteKey } from '@/lib/entry-note';

import { getAdherenceRecord, getE1rmSeries, type AdherenceRecord } from './insights';
import { noteForLift, recentEntryNotes } from './entry-notes';
import { computePlanStrip, planStripFor } from './strip';
import type { PlanDayRow } from './plan';
import { getLastSetHint } from './last-set';
import { getPredictionForOpen } from './predictions';
import { listLifts } from './lifts';
import { roundToPlate } from '@/lib/predict/engine';
import type { Move } from '@/lib/plan/prescribe';
import { getSmallestPlateKg } from '@/lib/prefs';

import { dayRangeIso, shiftDayKey, todayKey, type DayKey } from './dates';
import { getDb } from './index';

/**
 * The Next briefing (owner, 28 July 2026) — everything the app can honestly say
 * about what happens next, assembled in one synchronous pass over the local
 * mirror.
 *
 * WHY THIS EXISTS. §16 says the prediction is the single strongest retention
 * mechanism in the product — "a reason to open the app on a training day that
 * exists before the user has done anything" — and until now it had no door of
 * its own. It was a thin strip on Today and a card under the composer. This
 * gives it a surface.
 *
 * WHAT IT IS NOT, and the line is not negotiable: **no number here comes from a
 * language model.** §1.1 invariant 3 — code computes, the model may only
 * rephrase an already-computed sentence (§8.3, `explain-prediction`). Every
 * figure below is a SQL read or the pure engine's arithmetic, so the same
 * history produces the same briefing every time, in airplane mode, forever.
 * That reproducibility is also what makes the adherence record at the bottom
 * mean anything: you cannot measure "followed 7 of the last 9" against a plan
 * that changes its mind.
 *
 * Everything is optional. A section with nothing true to say is absent, not
 * empty (§1.1 invariant 6).
 */

/** How many recent lifts to examine for stalls and movement. Bounded on purpose:
 * this runs on open, and a briefing that scans a five-year history is a hitch. */
const SCAN_LIFTS = 10;
/** A lift is "standing still" after this many sessions at the same top weight. */
const STALL_SESSIONS = 3;
/** The window a mover has to have moved within. */
const MOVER_WEEKS = 8;
const MOVER_MIN_KG = 2.5;

export interface BriefLine {
  name: string;
  /** The lift as the RECORD spells it, once the name resolved to history —
   * the key the one-exercise-one-home rule dedupes on (`lib/next/sections.ts`).
   * `name` is display text and may be a plan's or a ghost's spelling of the
   * same lift, so it cannot do this job. Null when nothing resolved. */
  canonical?: string | null;
  /** "82.5 kg × 5·5·5", or null when there is no history to progress from. */
  value: string | null;
  /** The engine's own reason, as a fragment. Null when there is none. */
  why: string | null;
  /** WHICH LEVER MOVED — add weight, add a rep, hold, back off. The engine
   * already decided it (`Reason.code`); this carries it to the screen so the
   * row can lead with the decision instead of asking the reader to diff
   * `last` against `value`. Absent on the ghost path, which stores only text. */
  move?: Move | null;
  /** The record the prescription grew from — "3×8 80", the gutter echo's own
   * voice (§20's framing: never what to do, only what to beat). On screen it
   * reads as the FROM of a from → to pair, so the row shows its work. Silence
   * when the name doesn't resolve or there is no history. */
  last?: string | null;
  /** The heaviest counted set ever recorded for this lift, or null. */
  bestKg?: number | null;
  /** The athlete's own last remark about this lift, quoted verbatim beside the
   * prescription. Never an input to `value` — see `BriefNote`. */
  note?: BriefNote | null;
}

/**
 * One per-entry note, on its way to the screen.
 *
 * IT IS A QUOTE AND NOTHING ELSE. §8.1's line — "Next may quote a reflection
 * without inferring causation" — is the whole permission: the words are the
 * athlete's, they are shown beside the lift they were written about, and no
 * number on this screen moved because of them. What DOES move a load is the
 * effort marker on the same entry (`lib/effort.ts` → rir → the engine), which
 * is a value chosen from a bounded scale rather than a sentence interpreted by
 * anything.
 */
export interface BriefNote {
  /** The lift as the record spells it. */
  name: string;
  /** The athlete's words, verbatim, never summarized. */
  text: string;
  /** The local day it was written about. */
  day: DayKey;
}

export interface BriefStall {
  canonical: string;
  weight: number;
  sessions: number;
  /** What the engine will drop to if it stalls once more. Null without a plate. */
  deloadTo: number | null;
}

export interface BriefMover {
  canonical: string;
  /** Estimated 1RM gained over the window, in kg. Always positive here. */
  deltaKg: number;
  weeks: number;
  /** The latest estimated 1RM the delta is measured against. The display
   * layer's sanity guard needs a denominator: a +64 kg gain is nonsense on a
   * 100 kg e1RM and unremarkable on none at all (`lib/next/sections.ts`). */
  currentE1rm: number;
  /** The windowed e1RM values, oldest first — the sparkline's own data. Kept
   * as bare numbers because that is all `Sparkline` reads. */
  series: number[];
}

export interface Brief {
  /** "Upper A" — the declared split day, when today has one. */
  dayLabel: string | null;
  /** True when `lines` came from the plan for TODAY rather than the next-session
   * ghost — the two are phrased differently on screen. */
  forToday: boolean;
  lines: BriefLine[];
  /** The ghost's one sentence, already phrased (and possibly already rewritten
   * in the user's language by `explain-prediction`). */
  headline: string | null;
  stalls: BriefStall[];
  movers: BriefMover[];
  adherence: AdherenceRecord | null;
  /** When one prescribed load exceeds that lift's all-time best: the stakes of
   * the session, stated as arithmetic. One at most — the first in plan order —
   * because two "heaviest ever" lines are a hype reel (§15). */
  prReach: { name: string; weightKg: number } | null;
  /** Sessions written in the last 7 local days — the paragraph's opening
   * clause (product-direction §9: the brief answers "what training happened
   * recently?" before anything else). A session is what the log calls one:
   * a workout row with text in it. */
  sessions7: number;
  /** Sessions in the last 8 weeks — the provenance line's own number
   * ("based on N sessions"), computed, never estimated. */
  sessions8w: number;
  /** Recent per-entry notes that are NOT already quoted on a prescription row —
   * the athlete's own words about lifts the coming session does not name.
   * Nothing is ever said twice. */
  notes: BriefNote[];
}

interface TopRow {
  canonical: string;
  performed_at: string;
  weight_kg: number | null;
  reps: number | null;
}

/**
 * The heaviest counted set of each session, per lift, newest first — the same
 * shape the engine's deload rule reads. Warm-ups, drops and skipped sets are
 * excluded here exactly as they are in every other aggregate (§1.1 invariant 5).
 */
function topSetsFor(userId: string, canonicals: string[], perLift: number): Map<string, TopRow[]> {
  const out = new Map<string, TopRow[]>();
  if (canonicals.length === 0) return out;

  const placeholders = canonicals.map(() => '?').join(',');
  const rows = getDb().getAllSync<TopRow>(
    `SELECT lower(e.canonical) AS canonical, w.performed_at AS performed_at,
            MAX(s.weight_kg) AS weight_kg, MAX(s.reps) AS reps
     FROM sets s
     JOIN items i ON s.item_id = i.id
     JOIN exercises e ON i.exercise_id = e.id
     JOIN workouts w ON i.workout_id = w.id
     WHERE w.user_id = ?
       AND lower(e.canonical) IN (${placeholders})
       AND s.kind NOT IN ('warmup','drop','skipped')
       AND s.weight_kg IS NOT NULL
     GROUP BY lower(e.canonical), w.id
     ORDER BY w.performed_at DESC`,
    [userId, ...canonicals],
  );

  for (const r of rows) {
    const list = out.get(r.canonical);
    if (list) {
      if (list.length < perLift) list.push(r);
    } else {
      out.set(r.canonical, [r]);
    }
  }
  return out;
}

/**
 * Lifts that have not moved: the same top weight for `STALL_SESSIONS` sessions
 * running, with reps never improving across them.
 *
 * This is the engine's own deload condition read one session early, which is
 * the honest thing to surface — it is not a new opinion about training, it is
 * the app showing its work before it acts.
 */
function findStalls(tops: Map<string, TopRow[]>, display: Map<string, string>): BriefStall[] {
  const plate = getSmallestPlateKg();
  const out: BriefStall[] = [];

  for (const [key, rows] of tops) {
    if (rows.length < STALL_SESSIONS) continue;
    const window = rows.slice(0, STALL_SESSIONS);
    const weight = window[0]!.weight_kg;
    if (weight == null || weight <= 0) continue;
    if (!window.every((r) => r.weight_kg === weight)) continue;
    // Reps must be flat or falling — a rising rep count IS progress at the same
    // weight, and calling that a stall would be wrong about the sport.
    const reps = window.map((r) => r.reps);
    const improving = reps.some(
      (r, i) => i > 0 && r != null && reps[i - 1] != null && reps[i - 1]! > r,
    );
    if (improving) continue;

    out.push({
      canonical: display.get(key) ?? key,
      weight,
      sessions: STALL_SESSIONS,
      deloadTo: plate != null ? roundToPlate(weight * 0.9, plate) : null,
    });
  }
  return out.sort((a, b) => b.weight - a.weight).slice(0, 3);
}

/** Lifts whose estimated 1RM has genuinely climbed inside the window. */
function findMovers(userId: string, canonicals: string[]): BriefMover[] {
  const cutoff = Date.now() - MOVER_WEEKS * 7 * 86_400_000;
  const out: BriefMover[] = [];

  for (const canonical of canonicals) {
    const series = getE1rmSeries(userId, canonical, 24).filter(
      (p) => Date.parse(p.day) >= cutoff || Number.isNaN(Date.parse(p.day)),
    );
    if (series.length < 2) continue;
    const first = series[0]!;
    const last = series[series.length - 1]!;
    const delta = Math.round((last.e1rm - first.e1rm) * 10) / 10;
    if (delta < MOVER_MIN_KG) continue;
    out.push({
      canonical,
      deltaKg: delta,
      weeks: MOVER_WEEKS,
      currentE1rm: last.e1rm,
      series: series.map((p) => p.e1rm),
    });
  }
  return out.sort((a, b) => b.deltaKg - a.deltaKg).slice(0, 3);
}

/**
 * The record behind each prescription (§20: only what to beat), the lift's
 * all-time best, the one load that would out-lift it, and the athlete's own
 * remark about it.
 *
 * Split out of `buildBrief` on 13 Aug so the Next tab's split preview can
 * enrich a NOT-due day's lines exactly the way the due day's are. One
 * expression of "what does this row know about itself" — two would drift.
 *
 * All of it reads the same counted sets every other aggregate reads; a name
 * that doesn't resolve is silence, not a guess (`getLastSetHint`'s own rule).
 * The note is attached whether or not the name resolves to history: a remark
 * about a lift is worth showing beside it even the first time it is prescribed
 * from a plan. Quoting is ALL that happens to notes — no arithmetic anywhere
 * reads them (§8.1: quote without inferring causation).
 */
function enrichLines(
  userId: string,
  lines: BriefLine[],
  /** Prescribed load per line, parallel to `lines` — the heaviest-ever check
   * only, never displayed. */
  prescribed: (number | null)[],
  recentNotes: ReturnType<typeof recentEntryNotes>,
): { lines: BriefLine[]; prReach: Brief['prReach']; quoted: Set<string> } {
  const quoted = new Set<string>();
  let prReach: Brief['prReach'] = null;

  const out = lines.map((line, i) => {
    const hint = getLastSetHint(userId, line.name, null);
    const found = noteForLift(recentNotes, hint?.canonical ?? line.name);
    const note = found ? { name: found.exercise, text: found.note, day: found.day } : null;
    if (note) quoted.add(entryNoteKey(note.name));

    if (!hint) return note ? { ...line, note } : line;
    const best = bestWeightFor(userId, hint.canonical);
    const target = prescribed[i] ?? null;
    if (prReach == null && best != null && target != null && target > best) {
      prReach = { name: hint.canonical, weightKg: target };
    }
    return { ...line, canonical: hint.canonical, last: hint.echo, bestKg: best, note };
  });

  return { lines: out, prReach, quoted };
}

/**
 * The prescription lines for ONE named split day — the Next tab's preview when
 * the athlete taps a day they are not due for.
 *
 * Read-only in every sense: it resolves nothing, writes nothing, and does not
 * touch which day is due. The numbers come from `planStripFor`, so a preview
 * cannot state a load the real strip would not.
 */
export function planDayLines(userId: string, planDay: PlanDayRow): BriefLine[] {
  const strip = planStripFor(userId, planDay);
  if (!strip) return [];
  const lines: BriefLine[] = strip.rows.map((r) => ({
    name: r.name,
    value: r.value,
    why: r.why ?? null,
    move: r.move ?? null,
  }));
  const prescribed = strip.rows.map((r) => r.weightKg ?? null);
  return enrichLines(userId, lines, prescribed, recentEntryNotes(userId)).lines;
}

export function buildBrief(userId: string): Brief {
  const today = todayKey();

  // WHAT'S NEXT. The declared split day for today wins when there is one — it
  // is what the athlete said they would do. Otherwise the ghost, which is the
  // progression of the session they are due for (§8.2).
  const strip = computePlanStrip(userId, today);
  const prediction = getPredictionForOpen(userId, today);

  let lines: BriefLine[] = [];
  /** Prescribed load per line, parallel to `lines` — for the heaviest-ever
   * check only, never displayed. */
  let prescribed: (number | null)[] = [];
  let forToday = false;
  if (strip && strip.rows.length > 0) {
    forToday = true;
    lines = strip.rows.map((r) => ({
      name: r.name,
      value: r.value,
      why: r.why ?? null,
      move: r.move ?? null,
    }));
    // The engine's own number, carried through `PlanRow.weightKg` — the value
    // string ("82.5 × 5·5·5") is display and is never parsed back.
    prescribed = strip.rows.map((r) => r.weightKg ?? null);
  } else if (prediction) {
    // The ghost's lines are already the parseable prescription ("bench press
    // 3×5  82.5 kg"). Split at the first digit rather than through
    // `typedNameOf`, so the numbers survive verbatim — this is the text the
    // composer would accept, and reformatting it here would let the briefing
    // and the note disagree about one session.
    lines = prediction.ghost_text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const m = /^([^\d]+?)\s+(.*)$/.exec(l);
        return {
          name: (m?.[1] ?? l).trim(),
          value: (m?.[2] ?? '').trim() || null,
          why: null,
        };
      });
    // Ghost strength lines end in "… 82.5 kg" (`strengthLine` in
    // predict/data.ts); bodyweight and cardio lines carry no kg and stay null.
    prescribed = lines.map((l) => {
      const m = l.value?.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
      return m ? parseFloat(m[1]!.replace(',', '.')) : null;
    });
  }

  // The record behind each prescription (§20: only what to beat), and the one
  // load that would out-lift the lift's all-time best. Both read the same
  // counted sets every other aggregate reads; a name that doesn't resolve is
  // silence, not a guess (`getLastSetHint`'s own rule).
  // The athlete's own recent remarks, read once. Quoting is all that happens to
  // them: `BriefNote` carries the words to the screen and no arithmetic
  // anywhere reads this array (§8.1 — quote without inferring causation).
  const recentNotes = recentEntryNotes(userId);
  const enriched = enrichLines(userId, lines, prescribed, recentNotes);
  lines = enriched.lines;
  const prReach = enriched.prReach;
  const quoted = enriched.quoted;

  const lifts = listLifts(userId).slice(0, SCAN_LIFTS);
  const keys = lifts.map((l) => l.key);
  const display = new Map(lifts.map((l) => [l.key, l.canonical]));

  const adherence = getAdherenceRecord(userId);

  // The brief's own provenance: how much record it is standing on. Counted the
  // way the log counts a session — a workout row with text — over local days,
  // so "this week" means the athlete's week, not UTC's.
  const [since7] = dayRangeIso(shiftDayKey(today, -6));
  const [since8w] = dayRangeIso(shiftDayKey(today, -55));
  const counts = getDb().getFirstSync<{ n7: number; n8w: number }>(
    `SELECT COUNT(CASE WHEN performed_at >= ? THEN 1 END) AS n7, COUNT(*) AS n8w
     FROM workouts WHERE user_id = ? AND performed_at >= ? AND trim(raw_text) <> ''`,
    [since7, userId, since8w],
  );

  return {
    dayLabel: strip?.label ?? null,
    forToday,
    lines,
    headline: prediction?.reason ?? null,
    stalls: findStalls(topSetsFor(userId, keys, STALL_SESSIONS), display),
    movers: findMovers(
      userId,
      lifts.map((l) => l.canonical),
    ),
    adherence: adherence.settled > 0 ? adherence : null,
    prReach,
    sessions7: counts?.n7 ?? 0,
    sessions8w: counts?.n8w ?? 0,
    // Whatever the prescription rows did not already carry — capped, because a
    // wall of quotes is a diary, and this screen is a briefing.
    notes: recentNotes
      .filter((n) => !quoted.has(entryNoteKey(n.exercise)))
      .slice(0, 3)
      .map((n) => ({ name: n.exercise, text: n.note, day: n.day })),
  };
}

/** The heaviest counted set ever recorded for one lift, or null. */
function bestWeightFor(userId: string, canonical: string): number | null {
  const row = getDb().getFirstSync<{ best: number | null }>(
    `SELECT MAX(s.weight_kg) AS best
     FROM sets s
     JOIN items i ON s.item_id = i.id
     JOIN workouts w ON i.workout_id = w.id
     JOIN exercises e ON e.id = i.exercise_id
     WHERE w.user_id = ? AND lower(e.canonical) = lower(?)
       AND s.kind NOT IN ('warmup','drop','skipped') AND s.weight_kg IS NOT NULL`,
    [userId, canonical],
  );
  return row?.best ?? null;
}
