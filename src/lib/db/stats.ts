import { sessionMinutes, type RatedSession } from '@/lib/session-effort';

import { dayKeyFor, shiftDayKey, todayKey, type DayKey } from './dates';
import { getDb } from './index';

/**
 * Weekly summary data for /stats (CLAUDE.md §8): ONE chart — volume over the
 * last 8 ISO weeks — plus the facts behind two quiet insight lines. Warm-ups
 * are excluded from all volume math (CLAUDE.md §3).
 */
export interface WeekVolume {
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: DayKey;
  volume: number;
  sessions: number;
}

export interface StatsSummary {
  weeks: WeekVolume[]; // oldest → newest, exactly 8
  /** Volume change vs the previous week, in percent, when both weeks trained. */
  weekOverWeekPct: number | null;
  sessionsThisWeek: number;
}

export function mondayOf(day: DayKey): DayKey {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  const offset = (date.getDay() + 6) % 7; // 0 = Monday
  return dayKeyFor(new Date(y!, m! - 1, d! - offset));
}

export function getStatsSummary(userId: string): StatsSummary {
  const db = getDb();
  const thisMonday = mondayOf(todayKey());
  const firstMonday = shiftDayKey(thisMonday, -7 * 7);

  const rows = db.getAllSync<{ performed_at: string; volume: number | null }>(
    `SELECT w.performed_at,
            SUM(CASE WHEN s.kind NOT IN ('warmup', 'skipped') AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
                     THEN s.reps * s.weight_kg ELSE 0 END) AS volume
     FROM workouts w
     LEFT JOIN items i ON i.workout_id = w.id
     LEFT JOIN sets s ON s.item_id = i.id
     WHERE w.user_id = ? AND trim(w.raw_text) <> ''
     GROUP BY w.id
     ORDER BY w.performed_at ASC`,
    [userId],
  );

  const byWeek = new Map<DayKey, { volume: number; sessions: number }>();
  for (const r of rows) {
    const week = mondayOf(dayKeyFor(new Date(r.performed_at)));
    if (week < firstMonday) continue;
    const entry = byWeek.get(week) ?? { volume: 0, sessions: 0 };
    entry.volume += Math.round(r.volume ?? 0);
    entry.sessions += 1;
    byWeek.set(week, entry);
  }

  const weeks: WeekVolume[] = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = shiftDayKey(thisMonday, -7 * i);
    const entry = byWeek.get(weekStart);
    weeks.push({ weekStart, volume: entry?.volume ?? 0, sessions: entry?.sessions ?? 0 });
  }

  const current = weeks[weeks.length - 1]!;
  const previous = weeks[weeks.length - 2]!;
  const weekOverWeekPct =
    current.volume > 0 && previous.volume > 0
      ? Math.round(((current.volume - previous.volume) / previous.volume) * 100)
      : null;

  return { weeks, weekOverWeekPct, sessionsThisWeek: current.sessions };
}

/**
 * Every session's rating and duration, for the Progress tab's weekly load
 * (`lib/session-effort.ts`).
 *
 * ONE ROW PER SESSION, INCLUDING THE UNRATED ONES, and that is the whole point
 * of the query. `weekIsComplete` refuses to total a week that has an unrated
 * session in it, so the sessions with a null rating are exactly the rows the
 * arithmetic needs to see. Selecting only the rated ones would hand the screen
 * a set of weeks that all look complete.
 *
 * A session is what the log calls one — a workout row with text in it — the
 * same definition `getStatsSummary` above and the brief's `sessions7` use.
 *
 * The duration is derived here rather than stored, from the row's own
 * timestamps, and `sessionMinutes` throws out the spans that cannot be a
 * session (under ten minutes, over six hours). A rated session with an
 * unusable span therefore counts as UNRATED for this purpose, which is
 * correct: without a duration there is no load, and a week holding one cannot
 * be totalled either.
 */
export function getLoadSessions(userId: string): RatedSession[] {
  return getDb()
    .getAllSync<{
      performed_at: string;
      session_effort: number | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT performed_at, session_effort, created_at, updated_at
       FROM workouts
       WHERE user_id = ? AND trim(raw_text) <> ''
       ORDER BY performed_at ASC`,
      [userId],
    )
    .map((r) => ({
      day: dayKeyFor(new Date(r.performed_at)),
      rpe: r.session_effort,
      minutes: sessionMinutes(r.created_at, r.updated_at),
    }));
}
