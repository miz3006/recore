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

function mondayOf(day: DayKey): DayKey {
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
            SUM(CASE WHEN s.kind <> 'warmup' AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
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
