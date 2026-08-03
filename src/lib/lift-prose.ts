// Relative + .ts extension: this file is BOTH bundled by Metro AND run under
// `node --test` (which can't resolve the `@/` alias) — the same pattern as
// brief-prose.ts and the other pure modules.
import { fmtNumber } from './parse/summarize.ts';

/**
 * The lift sheet's closing summary — the per-lift twin of `brief-prose.ts`
 * (CLAUDE.md §8.5), owner-asked 29 July: "a summary of the loads from previous
 * sessions".
 *
 * It is COMPOSITION, not generation. Every number below is already on the
 * screen above it — a SQL read of this lift's own sets — and the sentences are
 * templates in a fixed order: how big the record is → how the top set moved →
 * whether it is standing still → the heaviest thing in it. Same history, same
 * paragraph, offline, forever. A model may only REPHRASE the result
 * (`explain-brief` + `brief-guard.ts`, whose number whitelist is what keeps the
 * rewrite honest), never author it.
 *
 * Two rules this paragraph must keep, because it sits on the archive:
 *  - **No prescription.** Progress and the lift sheet are the record; the next
 *    weight lives on Today and on Next (§16.5). Nothing here says what to do.
 *  - **A delta is a word** — "up 10 kg", "down 5 kg" — never a bare `+`/`−`
 *    and never a colour (§5.1). Nothing here praises (§15).
 *
 * A field with nothing true to say contributes no sentence (§1.1 inv. 6); with
 * nothing at all, the paragraph is empty and the card is not rendered.
 */
export interface LiftBrief {
  canonical: string;
  /** Every session ever recorded for this lift. */
  sessionCount: number;
  /** Label of the first day ever recorded, or null to leave it unsaid (the
   * caller drops it when it would read as "since Today"). */
  firstDayLabel: string | null;
  /** Sessions in the charted window (≤ 10), oldest → newest. */
  windowSessions: number;
  /** Top-set weight at each end of that window. */
  firstWeight: number | null;
  lastWeight: number | null;
  /** Top-set reps at each end — bodyweight lifts carry the story in reps. */
  firstReps: number | null;
  lastReps: number | null;
  /** The heaviest working set in the whole record. */
  bestWeight: number | null;
  bestReps: number | null;
  bestDayLabel: string | null;
  /** Best estimated 1RM in the whole record (Epley over counted sets). */
  e1rmBest: number | null;
  /** How many of the most recent sessions topped out at the same weight. */
  stallSessions: number;
}

const kg = (n: number) => `${fmtNumber(n)} kg`;

export function liftProse(b: LiftBrief): string {
  const parts: string[] = [];

  // 1. How much record there is. The count is the whole history, not the
  //    charted window — the tile above says the same number.
  if (b.sessionCount > 0) {
    const times = b.sessionCount === 1 ? 'once' : `${b.sessionCount} times`;
    const since = b.firstDayLabel ? ` since ${b.firstDayLabel}` : '';
    parts.push(`You have logged ${b.canonical} ${times}${since}.`);
  }

  // 2. How the top set moved across the window that is drawn above.
  let heldFlat = false;
  if (b.windowSessions >= 2) {
    const weighted = b.firstWeight != null && b.lastWeight != null;
    if (weighted) {
      const delta = (b.lastWeight as number) - (b.firstWeight as number);
      if (delta === 0) {
        heldFlat = true;
        parts.push(`The top set has held at ${kg(b.lastWeight as number)} across those sessions.`);
      } else {
        parts.push(
          `Across the last ${b.windowSessions} sessions the top set went from ${kg(
            b.firstWeight as number,
          )} to ${kg(b.lastWeight as number)} — ${delta > 0 ? 'up' : 'down'} ${kg(Math.abs(delta))}.`,
        );
      }
    } else if (b.firstReps != null && b.lastReps != null) {
      const delta = b.lastReps - b.firstReps;
      if (delta === 0) {
        heldFlat = true;
        parts.push(`The top set has held at ${b.lastReps} reps across those sessions.`);
      } else {
        parts.push(
          `Across the last ${b.windowSessions} sessions the top set went from ${b.firstReps} to ${b.lastReps} reps — ${
            delta > 0 ? 'up' : 'down'
          } ${Math.abs(delta)}.`,
        );
      }
    }
  }

  // 3. Standing still, stated as arithmetic and nothing else. Skipped when the
  //    sentence above already said the load never moved.
  if (!heldFlat && b.stallSessions >= 3 && b.lastWeight != null) {
    parts.push(`The last ${b.stallSessions} sessions all topped out at ${kg(b.lastWeight)}.`);
  }

  // 4. The heaviest thing in the record, and the estimate over it.
  if (b.bestWeight != null) {
    const reps = b.bestReps != null ? ` × ${b.bestReps}` : '';
    const on = b.bestDayLabel ? `, on ${b.bestDayLabel}` : '';
    const est = b.e1rmBest != null ? `, for an estimated 1RM of ${kg(b.e1rmBest)}` : '';
    parts.push(`The heaviest working set in the record is ${kg(b.bestWeight)}${reps}${on}${est}.`);
  } else if (b.bestReps != null) {
    const on = b.bestDayLabel ? `, on ${b.bestDayLabel}` : '';
    parts.push(`The best set in the record is ${b.bestReps} reps${on}.`);
  }

  return parts.join(' ');
}
