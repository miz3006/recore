// Relative + .ts extension: this module is BOTH bundled by Metro AND run under
// `node --test` — the same pattern as plan/prescribe.ts and activity.ts.
import { shortDayLabel, type DayKey } from '../db/dates.ts';
import { entryNoteKey } from '../entry-note.ts';
import { fmtNumber } from '../parse/summarize.ts';
import { patternOf } from '../split/pattern.ts';

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
 * So an exercise appeared EXACTLY ONCE, in the first of these that claimed it:
 *
 *     Next session  >  Standing still  >  Moving
 *
 * **Only the first of those is still on this screen** (29 August 2026). The
 * other two — "your other lifts", the ones the coming session does not name —
 * are a question about lifts ACROSS lifts, which is Progression's, and they
 * moved there folded into rows that were already showing those lifts. The rule
 * survives its own sections: one lift, one home, and the home is now one of two
 * TABS rather than one of three blocks.
 *
 * What the losing sections held was never thrown away. A plateau on a lift that
 * IS in the next session becomes that row's reason line, where it is more
 * useful than it ever was as a separate block: it sits next to the load it is
 * about.
 *
 * ## Dedupe is on the CANONICAL name, never the display one
 *
 * A session row's `name` can be the plan's spelling or the ghost's; the stall
 * and mover rows carry the record's. `BriefLine.canonical` is the resolved
 * one, and `entryNoteKey` normalizes all of them the same way — the same
 * function the per-entry notes key on, so two surfaces cannot disagree about
 * whether "Bench Press" and "bench press" are one lift.
 */

/** Below this share of settled prescriptions the record stays unsaid (§1). */
export const ADHERENCE_MIN_RATIO = 0.5;

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
  /** The lift as the RECORD spells it, or null when the name never resolved.
   * It is what the card's "Full history" opener hands to the exercise sheet —
   * and a row that has no canonical name has no history to open, so it shows no
   * opener rather than guessing at one (the same rule Progression's cards
   * follow). */
  canonical: string | null;
  /**
   * WHICH LEVER THE ENGINE MOVED, as the engine states it.
   *
   * It held `MoveLabel` — the decision already phrased for a chip — until
   * 28 August 2026. The row's reason line needs the ARITHMETIC ("up 2.5"), not
   * the phrase, and one fact stored twice in two shapes is how two surfaces
   * start disagreeing about one lift. `moveLabel()` still turns this into the
   * words, for VoiceOver and for anything that wants the lever as a label.
   *
   * No longer null on the ghost path: `predict/data.ts` persists the levers it
   * always computed (`predictions.lines_json`).
   */
  move: Move | null;
  bestKg: number | null;
  /** "3×5 120" — the record the prescription grew from. */
  last: string | null;
  /** The local day `last` was performed — what makes the reason line
   * checkable. Null whenever `last` is. */
  lastDay: DayKey | null;
  /** "3×12 120 kg" — the not-yet-lifted number. Green, and only here. */
  prescription: string | null;
  /**
   * The two halves of `prescription`, as VALUES rather than as a sentence —
   * the load at the top of the card's type scale and the scheme one step under
   * it, the way Progression sets a lift's latest reading and its delta.
   *
   * Both are null on the ghost path (which stores text and nothing else) and on
   * cardio or bodyweight lines (which have no load). The card falls back to
   * printing the whole of `prescription` there, one size down: a row that
   * cannot fill the big slot honestly leaves it empty rather than inventing a
   * figure to put in it.
   */
  loadKg: number | null;
  scheme: string | null;
  /** True when this load would out-lift the lift's own heaviest counted set.
   * The stakes of the row, as arithmetic — never a badge, never a reward. */
  beatsBest: boolean;
  /** The engine's reason, revealed on tap. */
  why: string | null;
  /** The plateau this lift is sitting on, when it has one. */
  watch: WatchLine | null;
  note: BriefNote | null;
}

export interface NextSections {
  /** One stat and one highlight. Two lines at most, on any type size. */
  headline: string;
  /** "3 of 5 prescriptions followed", or null. Never "0 of N". */
  adherenceChip: string | null;
  provenance: string;
  /**
   * WHAT THIS SESSION IS — the title block's first line (Symmetry's shape,
   * 28 Aug 2026). The session's own NAME and nothing else: "Push day", or
   * "Next session" when the record has not declared one, or "Due now" for a
   * lifter who follows no split and is therefore not owed a day's name. It
   * read "Today · Push day" until the title block existed to say the WHEN on
   * its own line.
   */
  sessionTitle: string;
  sessionRows: SessionRow[];
  /** The ghost's sentence, when no row claimed it as its WHY. */
  sessionNote: string | null;
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
 * THE REASON LINE — every row explains its own target (owner, 28 Aug 2026).
 *
 * *"A derived plan the user can't audit is a plan they won't trust."* This is
 * the sentence under every prescribed load on Next: secondary type, always
 * present, never a tooltip and never behind a tap. It replaced the card's
 * WHY/WATCH accordion, whose one-tap disclosure was itself the claim that the
 * reason was optional.
 *
 * ## What it is allowed to say
 *
 * Only what the engine already decided. `Move` is the engine's own lever and
 * carries its own arithmetic — the increment, the load a deload backs off
 * from — so nothing here computes a number, phrases one, or infers one from a
 * string. The DATE comes from `LastSetHint.day`, the record's own
 * `performed_at`. Every line is therefore a claim the reader can go and check,
 * which is the whole point of printing it.
 *
 * ## Priority, and why the plateau wins
 *
 * A plateau outranks the lever, exactly as the retired card's meta line ranked
 * it: it is the fact that changes what the athlete does, and "3 sessions at
 * this weight" explains a held target better than "same weight as Fri 8 Aug"
 * ever could. It carries `watch` tone — amber is already the app's colour for
 * a plateau, a backoff and a pause — and the WORDS say it too, so the hue is
 * never the only carrier (§14).
 *
 * ## When it says nothing
 *
 * A row with no prescription gets NO line. The slot is evidence for a number,
 * and a row with no number has no evidence to give; filling it with "write one
 * session and this fills in" would put an instruction where the reader has
 * learned to find proof (owner, 28 Aug). The instruction belongs once, under
 * the title block. §8.3's older form of the same rule: no reason, no line.
 */
export type ReasonTone = 'plain' | 'planned' | 'watch';

export interface ReasonSegment {
  text: string;
  tone: ReasonTone;
}

/** The line, as segments, so the row renders tone without parsing a string. */
export type ReasonLine = ReasonSegment[];

const plain = (text: string): ReasonSegment => ({ text, tone: 'plain' });

export function reasonLine(row: SessionRow): ReasonLine | null {
  // No number, no evidence. The empty slot is the honest one.
  if (!row.prescription) return null;

  // A plateau is the reason, and outranks the lever that answered it.
  if (row.watch) {
    const n = row.watch.sessions;
    return [{ text: `${n} ${n === 1 ? 'session' : 'sessions'} at this weight`, tone: 'watch' }];
  }

  const line = leverLine(row.move, row.lastDay) ?? recordLine(row);
  if (!line) return null;

  // The stakes, stated as arithmetic and never as a badge (§15). A backoff
  // cannot also be a record, so it never reaches this.
  if (row.beatsBest) line.push({ text: ' · heaviest yet', tone: 'planned' });
  return line;
}

/** " from Fri 8 Aug" — omitted whole when the name never resolved to history.
 * A dateless line still says something true; an invented date would not. */
function since(day: DayKey | null, preposition: string): string {
  return day ? ` ${preposition} ${shortDayLabel(day)}` : '';
}

/**
 * The lever, as what changed and what it changed from.
 *
 * ONE GRAMMAR for all four: `<what changed> <since when>`. The emphasised
 * segment is the planned MAGNITUDE where there is one — green for a load going
 * up, amber for one backing off, matching the tone `moveLabel` gives the same
 * decision. "One more rep" and "same weight" carry no figure, so they carry no
 * colour: green marks a planned quantity, and there is none to mark.
 */
function leverLine(move: Move | null, day: DayKey | null): ReasonLine | null {
  if (!move) return null;
  switch (move.kind) {
    case 'weight':
      return [
        plain('up '),
        { text: fmtNumber(move.deltaKg), tone: 'planned' },
        plain(since(day, 'from')),
      ];
    case 'rep':
      return [plain(`one more rep${since(day, 'than')}`)];
    case 'hold':
      return [plain(`same weight${since(day, 'as')}`)];
    case 'backoff':
      return [
        plain('down '),
        { text: fmtNumber(move.fromKg - move.toKg), tone: 'watch' },
        plain(since(day, 'from')),
      ];
    default:
      return null;
  }
}

/**
 * The fallback when there is no lever: the record the target grew out of.
 *
 * A cardio or carry line, and any ghost cached before `lines_json` existed,
 * reaches here. It states the evidence without claiming a decision was made —
 * which is exactly the truth about those rows.
 */
function recordLine(row: SessionRow): ReasonLine | null {
  if (!row.last) return null;
  return [plain(`from ${row.last}${since(row.lastDay, 'on')}`)];
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
  const rawRows: SessionRow[] = lines.map((l) => {
    const loadKg = l.loadKg ?? null;
    const bestKg = l.bestKg ?? null;
    return {
      key: keyOf(l.canonical ?? l.name),
      name: l.name,
      canonical: l.canonical ?? null,
      move: l.move ?? null,
      bestKg,
      last: l.last ?? null,
      lastDay: l.lastDay ?? null,
      prescription: l.value,
      loadKg,
      scheme: l.scheme ?? null,
      // Strictly greater: matching your best is not beating it, and a row that
      // claimed it would be the screen flattering the record (§15).
      beatsBest: loadKg != null && bestKg != null && loadKg > bestKg,
      why: l.why,
      watch: null,
      note: l.note ?? null,
    };
  });

  /**
   * THE STAKES ARE STATED ONCE (owner, 29 Aug 2026 — seen on a device).
   *
   * `beatsBest` is true of every row whose target out-lifts that lift's own
   * record, and on a climbing week that is most of the session: three cards in
   * a row each ending "· heaviest yet" is the hype reel §15 bans, and it makes
   * the one that matters unreadable. `brief.prReach` already caps the same
   * fact at one "because two 'heaviest ever' lines are a hype reel" — this is
   * that rule applied to the rows, and it picks the same one: the FIRST in
   * plan order.
   */
  let claimedBest = false;
  const capped = rawRows.map((row) => {
    if (!row.beatsBest) return row;
    if (claimedBest) return { ...row, beatsBest: false };
    claimedBest = true;
    return row;
  });

  // A plateau on a claimed lift becomes that row's WATCH line. A stall with no
  // backoff load has nothing to warn about, so it never becomes a WATCH.
  const withWatch = capped.map((row) => {
    const stall = stalls.find((s) => keyOf(s.canonical) === row.key);
    return stall && stall.deloadTo != null
      ? { ...row, watch: { sessions: stall.sessions, deloadTo: stall.deloadTo } }
      : row;
  });

  return attachSentence(withWatch, sentence);
}

/**
 * The title block's first line.
 *
 * A FLAT lifter is not owed a day's name, and inventing one for them would be
 * the screen apologising for an answer they gave on purpose. "Due now" is the
 * truth about their screen: these are the lifts the record says are up next,
 * ranked by the dates their own reason lines carry. No split, no day, no
 * apology.
 */
export function sessionTitleOf(brief: Brief, flat: boolean): string {
  if (brief.lines.length === 0) return 'Nothing due yet';
  if (flat) return 'Due now';
  if (brief.dayLabel) return brief.dayLabel;
  return brief.forToday ? 'Today' : 'Next session';
}

/**
 * When this session was last done — the most recent day any of its lifts was
 * performed.
 *
 * Derived from the rows rather than queried, which is what makes it the SAME
 * date the reason lines print. A session whose lifts were last touched on
 * different days resolves to the most recent, because that is the honest
 * answer to "when did I last do this".
 */
export function lastDoneOf(rows: readonly SessionRow[]): DayKey | null {
  let latest: DayKey | null = null;
  for (const row of rows) {
    if (row.lastDay && (latest == null || row.lastDay > latest)) latest = row.lastDay;
  }
  return latest;
}

/**
 * "6 lifts · push, pull" — what the session targets, in counted facts.
 *
 * Symmetry puts a Muscle distribution strip here, three cards deep, with a
 * percentage under each. We have movement PATTERNS, not muscles, and we have
 * them as a tested lexicon (`lib/split/pattern.ts`) rather than as a claim
 * about anatomy — so the strip says what the record can support and stops
 * there. Patterns are listed by how many of the session's lifts vote for them,
 * biggest first; a lift the lexicon does not know simply does not vote, which
 * is `patternOf`'s own rule.
 */
export function targetsLine(rows: readonly SessionRow[]): string {
  const n = rows.length;
  const counted = `${n} ${n === 1 ? 'lift' : 'lifts'}`;
  if (n === 0) return counted;

  const votes = new Map<string, number>();
  for (const row of rows) {
    const pattern = patternOf(row.canonical ?? row.name);
    if (pattern) votes.set(pattern, (votes.get(pattern) ?? 0) + 1);
  }
  if (votes.size === 0) return counted;

  const patterns = [...votes.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([pattern]) => pattern);
  return `${counted} · ${patterns.join(', ')}`;
}

export function buildSections(
  brief: Brief,
  opts?: {
    /** True when the expandable prose is the model's phrasing, not the
     * composed one — the provenance line has to stay truthful about which. */
    phrased?: boolean;
    /** The athlete answered "I don't follow a split" (onboarding screen 14).
     * Passed in rather than read here, because this module is pure and runs
     * under `node --test`: it may not touch prefs. */
    flat?: boolean;
    warn?: (message: string, detail: unknown) => void;
  },
): NextSections {
  // 1. The session card claims its lifts first, and 2. folds in their plateaus.
  const { rows: sessionRows, leftover } = sessionRowsOf(
    brief.lines,
    brief.stalls,
    brief.headline,
  );

  return {
    headline: briefHeadline(brief),
    adherenceChip: adherenceChip(brief.adherence),
    provenance: opts?.phrased
      ? 'Phrased from your brief — every number read from your record.'
      : 'Every number read from your record.',
    sessionTitle: sessionTitleOf(brief, opts?.flat === true),
    sessionRows,
    sessionNote: leftover,
  };
}
