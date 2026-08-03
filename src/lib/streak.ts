// Relative + .ts extension: this file is BOTH bundled by Metro AND run under
// `node --test` (which can't resolve the `@/` alias) — the same pattern as the
// other pure, tested modules (plan/prescribe.ts → ../predict/engine.ts).
import { daysBetween, type DayKey } from './db/dates.ts';

/**
 * The streak counts CONSECUTIVE TRAINING DAYS (CLAUDE.md §16.2, ruled 28 July
 * 2026; PLAN D6). Pure and testable — it takes days and returns a number.
 *
 * The old version stepped back one CALENDAR day at a time, so Mon/Wed/Fri read
 * 1 and a programmed rest day looked like failure. That is wrong about the
 * sport: programmed rest IS training, and a record that punishes it is lying to
 * a lifter who is doing everything right. Train Monday, Wednesday and Friday and
 * this reads 3.
 *
 * What breaks it is a real absence: MORE THAN A WEEK between two training days,
 * and a most-recent session that is itself more than a week old reads zero.
 *
 * THE TOLERANCE IS A FIXED WEEK BY DESIGN. Deriving it from a weekly target the
 * user sets would be exactly the configuration §8.2 refuses to ask for — we
 * never ask an athlete to describe training we can read out of the log. Do not
 * add a setting for this.
 *
 * Because the unit is a session rather than a calendar day, the streak stops
 * being a daily goal, and §20 keeps its "no daily goals, no gamification"
 * clause intact — the contradiction resolved in §20's favour.
 */
export const STREAK_GAP_TOLERANCE_DAYS = 7;

/** Distinct, chronologically descending, nothing in the future. */
function normalize(days: DayKey[], today: DayKey): DayKey[] {
  // A day key sorts lexicographically exactly as it sorts chronologically.
  return [...new Set(days)].filter((d) => d <= today).sort().reverse();
}

/**
 * The current streak: how many training days back you can walk before a gap
 * longer than a week. A same-day double session counts once (the input is a set
 * of days, not of sessions).
 */
export function currentStreak(days: DayKey[], today: DayKey): number {
  const sorted = normalize(days, today);
  if (sorted.length === 0) return 0;
  // A head older than a week is not a streak in progress, it is a layoff.
  if (daysBetween(sorted[0]!, today) > STREAK_GAP_TOLERANCE_DAYS) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    if (daysBetween(sorted[i]!, sorted[i - 1]!) > STREAK_GAP_TOLERANCE_DAYS) break;
    streak += 1;
  }
  return streak;
}

/** The longest run anywhere in the history, by the same rule. */
export function longestStreak(days: DayKey[]): number {
  const sorted = [...new Set(days)].sort();
  if (sorted.length === 0) return 0;

  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    if (daysBetween(sorted[i - 1]!, sorted[i]!) > STREAK_GAP_TOLERANCE_DAYS) run = 1;
    else run += 1;
    if (run > best) best = run;
  }
  return best;
}
