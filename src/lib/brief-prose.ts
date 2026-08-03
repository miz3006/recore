// Relative + .ts extension: this file is BOTH bundled by Metro AND run under
// `node --test` (which can't resolve the `@/` alias) — the same pattern as
// streak.ts and the other pure modules. The Brief import is type-only, so the
// db layer behind it never loads in a test.
import type { Brief } from './db/brief.ts';
import { fmtNumber } from './parse/summarize.ts';

/**
 * The briefing's lead paragraph — Next's own voice (owner, 28 July 2026;
 * re-shaped 30 July against product-direction §9).
 *
 * §9 fixes the reading order: the brief answers *what training happened
 * recently* before it says a word about the coming session, and it closes with
 * *one useful thing to watch* — so the paragraph runs week → next session →
 * stakes → moving → holding → the record → the watch item. The reference
 * pattern (Mobbin: Strava's Athlete Intelligence, Tempo's readiness) is a
 * labelled card carrying a few short sentences over the structured data — and
 * the part those references get wrong is the voice: "You crushed it —
 * seriously impressive" is exactly the sentence §9.2 forbids.
 *
 * So this is COMPOSITION, not generation: every sentence is a template over
 * the already-computed `Brief` (SQL reads + the pure engine), assembled in
 * deterministic order. Same history, same paragraph, offline, forever. "No
 * model ever authors a plan" stands untouched; the model may only REWRITE this
 * paragraph (§9.1), and this module is where such a rewrite takes its input
 * from. The copy never says "AI" (the mechanism is not the promise), never
 * praises, and every number is specific. The watch item is chosen by a
 * priority rule in code — the first stall, the one place the engine is
 * already about to act — never by a model.
 *
 * A section with nothing true to say contributes no sentence; with nothing at
 * all, the paragraph is empty and the screen keeps its empty state.
 */
export function briefProse(brief: Brief): string {
  const parts: string[] = [];

  // §9's opener: the athlete's own week, then what's next — one sentence when
  // both exist, so the lede reads as a summary and not a header.
  const week =
    brief.sessions7 > 0
      ? brief.sessions7 === 1
        ? 'One session in the last seven days'
        : `${brief.sessions7} sessions in the last seven days`
      : null;

  if (brief.lines.length > 0) {
    const n = brief.lines.length;
    const movements = n === 1 ? 'one movement' : `${n} movements`;
    const next =
      brief.forToday && brief.dayLabel
        ? `today reads as ${brief.dayLabel} — ${movements}, loads already set below`
        : `your next session is ready — ${movements}, each load worked out from your own last sets`;
    parts.push(week ? `${week}, and ${next}.` : `${cap(next)}.`);
  } else if (week) {
    parts.push(`${week}.`);
  }

  if (brief.prReach) {
    // The stakes of the session, as arithmetic — a comparison of two numbers
    // the user already owns, never a cheer. The PR label itself is only
    // ever awarded after the lift.
    parts.push(
      `${fmtNumber(brief.prReach.weightKg)} kg on ${brief.prReach.name} would be your heaviest ever.`,
    );
  }

  if (brief.movers.length > 0) {
    const top = brief.movers[0]!;
    const rest = brief.movers.length - 1;
    const tail =
      rest > 0
        ? `, with ${rest === 1 ? 'one more lift' : `${rest} more lifts`} climbing behind it`
        : '';
    parts.push(
      `${top.canonical} is moving — up ${fmtNumber(top.deltaKg)} kg of estimated 1RM in ${top.weeks} weeks${tail}.`,
    );
  }

  if (brief.stalls.length > 0) {
    const s = brief.stalls[0]!;
    const others = brief.stalls.length - 1;
    const more =
      others > 0 ? ` ${others === 1 ? 'One more lift is' : `${others} more lifts are`} holding too.` : '';
    parts.push(`${s.canonical} has held ${fmtNumber(s.weight)} kg for ${s.sessions} sessions.${more}`);
  }

  if (brief.adherence && brief.adherence.settled > 0) {
    parts.push(
      `You followed ${brief.adherence.followed} of the last ${brief.adherence.settled} prescriptions.`,
    );
  }

  // §9's close: one useful thing to watch, looking forward. The stall carries
  // its own consequence here — the engine's deload rule, shown one session
  // early — so the fact sentence above stays a fact and this one stays advice
  // the code already decided.
  if (brief.stalls.length > 0) {
    const s = brief.stalls[0]!;
    parts.push(
      s.deloadTo != null
        ? `Worth watching next session: whether reps move on ${s.canonical} — one more flat session and the prescription backs off to ${fmtNumber(s.deloadTo)} kg.`
        : `Worth watching next session: whether reps move on ${s.canonical} at ${fmtNumber(s.weight)} kg.`,
    );
  }

  return parts.join(' ');
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * The paragraph's first sentence, split off for display: the lede renders one
 * notch over body, the rest at body — an article's shape, not a form's. Works
 * on the composed paragraph and on the model's rewrite alike, and is DISPLAY
 * ONLY: the cache and the guard always see the whole paragraph. A '.' inside
 * a number is never followed by a space, so the first '. ' is a sentence
 * boundary.
 */
export function splitLede(paragraph: string): { lead: string; rest: string } {
  const i = paragraph.indexOf('. ');
  if (i < 0) return { lead: paragraph, rest: '' };
  return { lead: paragraph.slice(0, i + 1), rest: paragraph.slice(i + 2) };
}

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * "Wednesday, 30 July" — the brief is dated because it is written for a day,
 * not for a screen. Own tables rather than Intl: the same string under Hermes
 * and `node --test`, and the composed brief speaks English until the model
 * rewrite translates it.
 */
export function briefDateline(d: Date): string {
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}
