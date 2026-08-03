import { getDb } from './index';

/**
 * How much record the user already has, in three numbers (block E, E6).
 *
 * It exists for one line: the paywall headline names what the user ALREADY HAS
 * rather than what is being sold. Mirroring an onboarding answer in the
 * headline outperforms most layout experiments, and it costs a string
 * interpolation — but only if there is something true to interpolate, which is
 * what this counts.
 *
 * One synchronous read over the local mirror, like everything else in the app,
 * so a paywall opened in airplane mode says the same thing.
 */
export interface LedgerSize {
  sessions: number;
  exercises: number;
  /** Whole months between the first and last logged session, at least 1. */
  months: number;
  /**
   * The first and last session instants, as ISO strings, or null on an empty
   * ledger. The lapsed screen states the range they describe (§2.2: "show the
   * person's own real numbers — the count of recorded sessions and the date
   * range"), which is why the query already selected them.
   */
  firstAt: string | null;
  lastAt: string | null;
}

export function getLedgerSize(userId: string): LedgerSize {
  const row = getDb().getFirstSync<{
    sessions: number;
    exercises: number;
    first_at: string | null;
    last_at: string | null;
  }>(
    `SELECT COUNT(DISTINCT w.id) AS sessions,
            COUNT(DISTINCT i.exercise_id) AS exercises,
            MIN(w.performed_at) AS first_at,
            MAX(w.performed_at) AS last_at
     FROM workouts w
     LEFT JOIN items i ON i.workout_id = w.id
     WHERE w.user_id = ? AND trim(w.raw_text) <> ''`,
    [userId],
  );

  const sessions = row?.sessions ?? 0;
  if (sessions === 0) {
    return { sessions: 0, exercises: 0, months: 0, firstAt: null, lastAt: null };
  }

  const first = row?.first_at ? Date.parse(row.first_at) : Number.NaN;
  const last = row?.last_at ? Date.parse(row.last_at) : Number.NaN;
  const months =
    Number.isFinite(first) && Number.isFinite(last)
      ? Math.max(1, Math.round((last - first) / (30.44 * 86_400_000)))
      : 1;

  return {
    sessions,
    exercises: row?.exercises ?? 0,
    months,
    firstAt: row?.first_at ?? null,
    lastAt: row?.last_at ?? null,
  };
}
