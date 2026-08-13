// Relative + .ts extension: this module is BOTH bundled by Metro AND run under
// `node --test` — the same pattern as plan/prescribe.ts and activity.ts.
import { entryNoteKey } from '../entry-note.ts';
import { fmtNumber } from '../parse/summarize.ts';

import type { Brief, BriefNote } from '../db/brief.ts';
import type { Move } from '../plan/prescribe.ts';

/**
 * The Next tab's VIEW MODEL — pure, zero I/O, fully tested.
 *
 * `db/brief.ts` answers "what is true?"; this file answers "where does each
 * true thing belong on the page?". The split exists because the second
 * question turned out to have rules of its own that were worth testing, and
 * because the session-type chips land on this screen next: a section that
 * takes a `NextSections` and renders it does not care how many chips sit
 * above it.
 *
 * ## The one-exercise-one-home rule (owner, 12 Aug 2026)
 *
 * Before this, a lift that was prescribed, plateaued AND climbing appeared in
 * three sections telling three different stories about itself — "3×12 120 kg",
 * "3 sessions at the same weight", "up 6.5 kg" — and a reader had to
 * reconcile them. They are all true; they are not all worth equal space.
 *
 * So an exercise appears EXACTLY ONCE, in the first of these that claims it:
 *
 *     Next session  >  Standing still  >  Moving
 *
 * The information the losing sections held is not thrown away. A plateau on a
 * lift that IS in the next session becomes that row's WATCH line, where it is
 * more useful than it ever was as a separate block: it sits next to the load
 * it is about.
 *
 * ## Dedupe is on the CANONICAL name, never the display one
 *
 * A session row's `name` can be the plan's spelling or the ghost's; the stall
 * and mover rows carry the record's. `BriefLine.canonical` is the resolved
 * one, and `entryNoteKey` normalizes all of them the same way — the same
 * function the per-entry notes key on, so two surfaces cannot disagree about
 * whether "Bench Press" and "bench press" are one lift.
 */

/**
 * A trend larger than this share of the lift's current e1RM is not believed.
 * See `movingReading` for what happens instead and why.
 */
export const DELTA_SUSPECT_RATIO = 0.25;

/** Below this share of settled prescriptions the record stays unsaid (§1). */
export const ADHERENCE_MIN_RATIO = 0.5;

const MOVING_LIMIT = 3;
/** Two points is a line segment, not a trend — a sparkline needs a shape. */
const SPARK_MIN_POINTS = 3;
/** Under a kilo of spread across the window, the line is flat and adds nothing. */
const SPARK_MIN_SPREAD_KG = 1;

export interface WatchLine {
  /** Sessions already spent at this weight. */
  sessions: number;
  /** What the engine's deload rule will drop to if it stalls once more. */
  deloadTo: number;
}

/**
 * The double-progression decision, as the row says it out loud.
 *
 * `label` is the lever ("ADD A REP"); `tone` is what the palette is allowed to
 * do about it. This is where `signal` green finally earns its keep: on a WORD
 * that describes a plan, at eyebrow scale, instead of on a digit that has to
 * be read. Amber marks the two moves that are not progress.
 */
export interface MoveLabel {
  label: string;
  tone: 'signal' | 'attention';
}

export interface SessionRow {
  key: string;
  name: string;
  /** Which lever the engine moved, in words. Null on the ghost path. */
  move: MoveLabel | null;
  bestKg: number | null;
  /** "3×5 120" — the record the prescription grew from. */
  last: string | null;
  /** "3×12 120 kg" — the not-yet-lifted number. Green, and only here. */
  prescription: string | null;
  /** The engine's reason, revealed on tap. */
  why: string | null;
  /** The plateau this lift is sitting on, when it has one. */
  watch: WatchLine | null;
  note: BriefNote | null;
}

export interface StandingRow {
  key: string;
  name: string;
  weight: number;
  sessions: number;
  deloadTo: number | null;
}

/**
 * What a mover's right-hand reading says.
 *
 * `delta` is the number. `direction` is the fallback for a delta the guard
 * refused — the trend is still real and still worth showing, but the figure
 * attached to it is not trustworthy enough to print.
 */
export type MovingReading =
  | { kind: 'delta'; text: string }
  | { kind: 'direction'; text: string };

export interface MovingRow {
  key: string;
  name: string;
  reading: MovingReading;
  /** "est. 1RM · 8 wk" — one window, spelled the same on every row. */
  subtext: string;
  /** Sparkline values, or [] when the trend is flat and the line would lie
   * about having a shape. */
  series: number[];
}

export interface NextSections {
  /** One stat and one highlight. Two lines at most, on any type size. */
  headline: string;
  /** "3 of 5 prescriptions followed", or null. Never "0 of N". */
  adherenceChip: string | null;
  provenance: string;
  sessionTitle: string;
  sessionRows: SessionRow[];
  /** The ghost's sentence, when no row claimed it as its WHY. */
  sessionNote: string | null;
  standing: StandingRow[];
  moving: MovingRow[];
}

const keyOf = (name: string | null | undefined): string => entryNoteKey(name);

/**
 * The engine's lever, phrased for the top of a row.
 *
 * WHY THIS IS THE MOST USEFUL LINE ON THE SCREEN. Every serious review of this
 * category lands on the same test, and it is not about numbers: *"You don't
 * know whether to add weight or reps this week."* An app passes when **you
 * never stand at the bar wondering which one today is.** The row used to print
 * `last 3×5 120 → 3×12 120 kg` and leave the reader to diff two strings for
 * the answer the engine already had.
 *
 * It also fixes what Nielsen's own rule says about the previous build: progressive
 * disclosure asks you to "disclose everything users frequently need up front"
 * and defer the rest. The DECISION is needed every session; the arithmetic
 * behind it is not. The decision comes up; the WHY sentence stays one tap down.
 *
 * The weight move carries its own increment, because "+2.5 kg" answers the
 * second half of the same question ("you don't know how much weight") in three
 * characters.
 */
export function moveLabel(move: Move | null | undefined): MoveLabel | null {
  if (!move) return null;
  switch (move.kind) {
    case 'weight':
      return { label: `ADD ${fmtNumber(move.deltaKg)} KG`, tone: 'signal' };
    case 'rep':
      return { label: 'ADD A REP', tone: 'signal' };
    case 'hold':
      return { label: 'HOLD THE WEIGHT', tone: 'attention' };
    case 'backoff':
      return { label: 'BACK OFF', tone: 'attention' };
    default:
      return null;
  }
}

/**
 * The predictor's record, as a chip — or silence.
 *
 * §1's rule, and it is a rule about honesty rather than presentation: a record
 * below half is not phrased more gently, it is NOT SHOWN. "0 of 4 followed" is
 * a true sentence that no product needs to say about itself, and a screen that
 * says it has confused candour with self-harm. The threshold matches
 * `predictorIsProven` (insights.ts) so the two surfaces cannot drift.
 */
export function adherenceChip(record: Brief['adherence']): string | null {
  if (!record) return null;
  const { followed, settled } = record;
  if (settled <= 0 || followed <= 0) return null;
  if (followed < settled * ADHERENCE_MIN_RATIO) return null;
  return `${followed} of ${settled} prescriptions followed`;
}

/** "3 sessions this week." — the stat half of the headline. */
function sessionsClause(n: number): string {
  if (n <= 0) return 'No sessions logged this week.';
  return n === 1 ? '1 session this week.' : `${n} sessions this week.`;
}

/**
 * The highlight half: ONE lift, chosen by how much it deserves the sentence.
 *
 * A PR in reach outranks a plateau outranks a climb, because that is the order
 * in which they change what the athlete does today. Names are printed as the
 * RECORD spells them — the app never re-capitalises what someone typed.
 */
function highlightClause(brief: Brief): string | null {
  if (brief.prReach) return `${brief.prReach.name} is in reach of its heaviest yet.`;
  const stall = brief.stalls[0];
  if (stall) return `${stall.canonical} is your lift to watch.`;
  const mover = brief.movers[0];
  if (mover) return `${mover.canonical} is your biggest climb.`;
  const lead = brief.lines.find((l) => l.value);
  if (lead) return `${lead.name} leads your next session.`;
  return null;
}

export function briefHeadline(brief: Brief): string {
  const highlight = highlightClause(brief);
  const stat = sessionsClause(brief.sessions7);
  return highlight ? `${stat} ${highlight}` : stat;
}

/**
 * THE TRUST GUARD (owner, 12 Aug 2026).
 *
 * The Moving section was printing figures like "+64 kg" — arithmetically what
 * the code computed, and nonsense as a claim about eight weeks of training. A
 * number that absurd does not read as a bug, it reads as an app that does not
 * know what it is measuring, and it costs more trust than the whole section
 * earns (§7.4: predict conservatively or not at all).
 *
 * So the display layer refuses it. Above a quarter of the lift's CURRENT e1RM,
 * the direction is still shown — the trend is real, the athlete did climb —
 * but the figure is withheld rather than printed. Withholding a number we
 * cannot stand behind is the honest half of showing the ones we can.
 *
 * TODO(est-1rm-window): fix the root cause in `findMovers` (`db/brief.ts`).
 * The delta is `last.e1rm - first.e1rm` over whatever `getE1rmSeries`
 * (`db/insights.ts`) returned, and that function's `limit` counts SESSIONS,
 * not weeks — so "8 wk" is a label over a window nobody bounded to eight
 * weeks. Worse, `first` is a single session: one rep-out day (3×12 at 60 →
 * e1RM 84) against a later heavy single (3×5 at 120 → e1RM 140) produces a
 * +56 kg "gain" out of two honest sessions. A baseline over the earliest few
 * points, and a window measured in days, would let this guard go quiet.
 */
export function movingReading(
  mover: { canonical: string; deltaKg: number; weeks: number; currentE1rm: number },
  warn?: (message: string, detail: unknown) => void,
): MovingReading {
  const { deltaKg, currentE1rm } = mover;
  const usable =
    Number.isFinite(deltaKg) && Number.isFinite(currentE1rm) && currentE1rm > 0;
  if (!usable || Math.abs(deltaKg) > currentE1rm * DELTA_SUSPECT_RATIO) {
    warn?.('next: e1RM delta refused as implausible', {
      lift: mover.canonical,
      deltaKg,
      currentE1rm,
      ratio: DELTA_SUSPECT_RATIO,
    });
    return { kind: 'direction', text: deltaKg < 0 ? 'falling' : 'climbing' };
  }
  const sign = deltaKg < 0 ? '−' : '+';
  return { kind: 'delta', text: `${sign}${fmtNumber(Math.abs(deltaKg))} kg` };
}

/** The sparkline's values, or [] when the line would have no shape to draw. */
export function sparkSeries(series: number[] | undefined): number[] {
  const values = (series ?? []).filter((v) => Number.isFinite(v));
  if (values.length < SPARK_MIN_POINTS) return [];
  const spread = Math.max(...values) - Math.min(...values);
  return spread < SPARK_MIN_SPREAD_KG ? [] : values;
}

/**
 * The ghost's one sentence, moved off the page and INTO the card.
 *
 * It names its own lift ("Two sessions stuck at 120 on bench press…" —
 * `sentenceFor` in predict/data.ts), so it can be attached to exactly the row
 * it is about rather than to whichever row happens to be first. A sentence
 * about the bench filed under the squat would be a fabricated attribution, and
 * §9.1 has no room for one. When no row matches, it stays a card-level line.
 */
function attachSentence(
  rows: SessionRow[],
  sentence: string | null,
): { rows: SessionRow[]; leftover: string | null } {
  if (!sentence) return { rows, leftover: null };
  const haystack = sentence.toLowerCase();
  const target = rows.find((r) => r.key.length > 0 && haystack.includes(r.key) && !r.why);
  if (!target) return { rows, leftover: sentence };
  return {
    rows: rows.map((r) => (r === target ? { ...r, why: sentence } : r)),
    leftover: null,
  };
}

/**
 * Prescription lines → session rows, with the plateau folded in.
 *
 * Exported (13 Aug) so the Next tab's SPLIT PREVIEW builds its rows through the
 * same function the due day does: a lift being previewed must carry the same
 * WATCH line, the same key and the same shape it would if that day were today.
 * A second mapping would be a second set of rules to keep in sync.
 *
 * `sentence` is the ghost's line and is only ever passed for the day actually
 * due — a preview passes null, because a sentence about the session you are due
 * for, attached to a row on a day you are not, is a fabricated attribution.
 */
export function sessionRowsOf(
  lines: Brief['lines'],
  stalls: Brief['stalls'],
  sentence: string | null,
): { rows: SessionRow[]; leftover: string | null } {
  const rawRows: SessionRow[] = lines.map((l) => ({
    key: keyOf(l.canonical ?? l.name),
    name: l.name,
    move: moveLabel(l.move),
    bestKg: l.bestKg ?? null,
    last: l.last ?? null,
    prescription: l.value,
    why: l.why,
    watch: null,
    note: l.note ?? null,
  }));

  // A plateau on a claimed lift becomes that row's WATCH line. A stall with no
  // backoff load has nothing to warn about, so it never becomes a WATCH.
  const withWatch = rawRows.map((row) => {
    const stall = stalls.find((s) => keyOf(s.canonical) === row.key);
    return stall && stall.deloadTo != null
      ? { ...row, watch: { sessions: stall.sessions, deloadTo: stall.deloadTo } }
      : row;
  });

  return attachSentence(withWatch, sentence);
}

export function buildSections(
  brief: Brief,
  opts?: {
    /** True when the expandable prose is the model's phrasing, not the
     * composed one — the provenance line has to stay truthful about which. */
    phrased?: boolean;
    warn?: (message: string, detail: unknown) => void;
  },
): NextSections {
  // 1. The session card claims its lifts first, and 2. folds in their plateaus.
  const { rows: sessionRows, leftover } = sessionRowsOf(
    brief.lines,
    brief.stalls,
    brief.headline,
  );
  const claimed = new Set(sessionRows.map((r) => r.key).filter(Boolean));

  const standing: StandingRow[] = brief.stalls
    .filter((s) => !claimed.has(keyOf(s.canonical)))
    .map((s) => ({
      key: keyOf(s.canonical),
      name: s.canonical,
      weight: s.weight,
      sessions: s.sessions,
      deloadTo: s.deloadTo,
    }));
  const standingKeys = new Set(standing.map((s) => s.key));

  // 3. Moving takes what is left, biggest trend first.
  const moving: MovingRow[] = brief.movers
    .filter((m) => {
      const k = keyOf(m.canonical);
      return !claimed.has(k) && !standingKeys.has(k);
    })
    .sort((a, b) => Math.abs(b.deltaKg) - Math.abs(a.deltaKg))
    .slice(0, MOVING_LIMIT)
    .map((m) => ({
      key: keyOf(m.canonical),
      name: m.canonical,
      reading: movingReading(m, opts?.warn),
      subtext: `est. 1RM · ${m.weeks} wk`,
      series: sparkSeries(m.series),
    }));

  return {
    headline: briefHeadline(brief),
    adherenceChip: adherenceChip(brief.adherence),
    provenance: opts?.phrased
      ? 'Phrased from your brief — every number read from your record.'
      : 'Every number read from your record.',
    sessionTitle: brief.forToday ? `Today · ${brief.dayLabel ?? 'your split'}` : 'Next session',
    sessionRows,
    sessionNote: leftover,
    standing,
    moving,
  };
}
