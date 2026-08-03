// Relative + .ts extension: this file is BOTH bundled by Metro AND run under
// `node --test` — the same pattern as streak.ts and the other pure modules.
import { dayKeyFor, shiftDayKey, type DayKey } from './db/dates.ts';

/**
 * THE ACTIVITY GRID — one dot per day, one column per week, filled where the
 * athlete trained (`src/app/(tabs)/you.tsx`). Pure and tested: it takes days
 * and returns a grid.
 *
 * It is a RECORD, not a game. §20 rules out XP, levels, badges, rings and daily
 * goals, and this crosses none of them: there is no target to hit, no colour
 * for hitting it, nothing to lose, and a light month reads as a light month
 * rather than as failure. It is the same fact §16.2's streak counts, drawn
 * instead of summed — which is the one thing a number cannot show you, the
 * SHAPE of a training year.
 *
 * Deliberately NOT a heatmap: no intensity ramp, no five shades of green. A day
 * either has training on it or it does not, and grading days by volume would
 * quietly tell a lifter that their deload week was worth less (§15 — a leading
 * minus on a deload day reads as a scold).
 */

/**
 * Columns drawn. ~7 months — long enough that a layoff is visible as a gap,
 * and chosen against the CARD'S WIDTH rather than against the calendar: the
 * grid is laid out `space-between`, so too few columns stretches the horizontal
 * gaps to roughly twice the vertical ones and the whole thing stops reading as
 * a grid and starts reading as stripes. Thirty lands the two gaps within about
 * half a point of each other on every phone size.
 */
export const GRID_WEEKS = 30;

export interface GridDay {
  key: DayKey;
  trained: boolean;
  /** Days after today: rendered as empty space, never as an untrained day.
   * The week you are in is half-unlived, and drawing it as missed is a lie. */
  future: boolean;
}

export interface GridWeek {
  /** Monday → Sunday, always seven. */
  days: GridDay[];
  /** Three-letter month label, on the first column that opens a new month —
   * empty everywhere else, so the strip reads "MAY … JUN … JUL". */
  monthLabel: string;
}

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export interface MonthCursor {
  year: number;
  /** 0-based, like `Date`. */
  month: number;
}

export function cursorOf(day: DayKey): MonthCursor {
  const [y, m] = day.split('-').map(Number);
  return { year: y!, month: (m ?? 1) - 1 };
}

export function monthName(cursor: MonthCursor): string {
  return MONTHS_SHORT[cursor.month] ?? '';
}

/**
 * One calendar month laid out MONDAY-FIRST: leading nulls for the days that
 * belong to the previous month, then each day's key, padded to whole weeks.
 *
 * Shared by the day picker on Today and the history calendar on You. It used to
 * be duplicated in `calendar-sheet.tsx`; two copies of "where does the month
 * start" is the kind of divergence §7.7 keeps having to diagnose.
 */
export function monthGrid(cursor: MonthCursor): (DayKey | null)[] {
  const first = new Date(cursor.year, cursor.month, 1);
  const leading = (first.getDay() + 6) % 7; // 0 = Monday
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();

  const cells: (DayKey | null)[] = Array.from({ length: leading }, () => null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(dayKeyFor(new Date(cursor.year, cursor.month, d)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * Every month from `to` back to `from`, NEWEST FIRST — the order you read a
 * history in. Inclusive at both ends, and never empty: a record that starts and
 * ends inside one month is still one month.
 */
export function monthsDescending(from: DayKey, to: DayKey): MonthCursor[] {
  const start = cursorOf(from);
  const end = cursorOf(to);
  const count = (end.year - start.year) * 12 + (end.month - start.month);
  if (count < 0) return [cursorOf(to)]; // a stamp from the future reads as today

  const out: MonthCursor[] = [];
  for (let i = 0; i <= count; i++) {
    const d = new Date(end.year, end.month - i, 1);
    out.push({ year: d.getFullYear(), month: d.getMonth() });
  }
  return out;
}

/** The Monday of the week `day` falls in (weeks start Monday, like §10.2). */
export function mondayOf(day: DayKey): DayKey {
  const [y, m, d] = day.split('-').map(Number);
  const offset = (new Date(y!, m! - 1, d!).getDay() + 6) % 7; // 0 = Monday
  return dayKeyFor(new Date(y!, m! - 1, d! - offset));
}

/**
 * Build the grid ending in the week that contains `today`.
 *
 * `trainedDays` is the set of days with a non-empty note — exactly what
 * `getLoggedDayKeys` returns, so the grid, the streak and the calendar dots all
 * read the same source and cannot disagree.
 */
export function buildActivityGrid(
  trainedDays: Iterable<DayKey>,
  today: DayKey,
  weeks = GRID_WEEKS,
): GridWeek[] {
  const trained = trainedDays instanceof Set ? trainedDays : new Set(trainedDays);
  const thisMonday = mondayOf(today);

  const out: GridWeek[] = [];
  let lastMonth = '';

  for (let w = weeks - 1; w >= 0; w--) {
    const monday = shiftDayKey(thisMonday, -7 * w);
    const days: GridDay[] = [];
    for (let d = 0; d < 7; d++) {
      const key = shiftDayKey(monday, d);
      days.push({ key, trained: trained.has(key), future: key > today });
    }

    // The label belongs to the month the week STARTS in — a week straddling a
    // boundary would otherwise print two labels one column apart.
    const month = MONTHS_SHORT[Number(monday.slice(5, 7)) - 1] ?? '';
    const monthLabel = month !== lastMonth ? month : '';
    if (monthLabel) lastMonth = month;

    out.push({ days, monthLabel });
  }

  return out;
}
