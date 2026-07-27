import { getDb } from '@/lib/db/index';

/**
 * Dev-only demo data (`__DEV__` only).
 *
 * Progress, Lifts and the Coach are all read-only projections of logged work —
 * which means every one of them is invisible until weeks of sessions exist. That
 * is a genuine development problem, not a shortcut: nobody can iterate on a
 * chart by first spending two months in a gym.
 *
 * So this writes a realistic twelve weeks straight into local SQLite: four
 * exercises on a push/pull/legs rotation, three sessions a week, loads that
 * progress the way double progression actually progresses — a small climb with
 * a deload in the middle, not a straight line, because a straight line hides
 * exactly the chart bugs worth finding.
 *
 * It writes `raw_text` as well as structure, because §18.1 says `raw_text` is
 * the source of truth and structure is a projection. Seed data that skipped it
 * would be a shape the real app can never produce.
 *
 * Everything it writes is marked clean (`dirty = 0`) so the sync loop never
 * pushes demo data to a real account.
 */

const PLAN: { label: string; lifts: { name: string; start: number; step: number; reps: number[] }[] }[] = [
  {
    label: 'Push',
    lifts: [
      { name: 'Bench Press', start: 70, step: 2.5, reps: [8, 8, 7] },
      { name: 'Overhead Press', start: 40, step: 2.5, reps: [8, 8, 8] },
    ],
  },
  {
    label: 'Pull',
    lifts: [
      { name: 'Barbell Row', start: 60, step: 2.5, reps: [8, 8, 8] },
      { name: 'Pull Up', start: 0, step: 2.5, reps: [8, 7, 6] },
    ],
  },
  {
    label: 'Legs',
    lifts: [
      { name: 'Squat', start: 90, step: 5, reps: [5, 5, 5] },
      { name: 'Romanian Deadlift', start: 80, step: 5, reps: [8, 8, 8] },
    ],
  },
];

const WEEKS = 12;
const DAYS_IN_WEEK = [1, 3, 5]; // Mon / Wed / Fri

function isoDay(daysAgo: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function uid(prefix: string, n: number): string {
  return `dev-${prefix}-${n}`;
}

/**
 * Loads climb, then deload in week 8, then climb again — the shape double
 * progression produces in the wild. A monotonic ramp would make every chart
 * look correct even when it is not.
 */
function loadFor(start: number, step: number, week: number): number {
  const deloaded = week >= 8 ? week - 3 : week;
  return start + step * Math.max(0, deloaded);
}

export interface SeedResult {
  sessions: number;
  sets: number;
}

/** Wipe anything a previous seed wrote, so re-running is safe and idempotent. */
export function clearDevSeed(userId: string): void {
  if (!__DEV__) return;
  const db = getDb();
  db.runSync(`DELETE FROM sets WHERE item_id IN (SELECT id FROM items WHERE workout_id LIKE 'dev-w-%')`);
  db.runSync(`DELETE FROM items WHERE workout_id LIKE 'dev-w-%'`);
  db.runSync(`DELETE FROM workouts WHERE user_id = ? AND id LIKE 'dev-w-%'`, [userId]);
  db.runSync(`DELETE FROM exercises WHERE user_id = ? AND id LIKE 'dev-e-%'`, [userId]);
}

export function seedDevData(userId: string): SeedResult {
  if (!__DEV__) return { sessions: 0, sets: 0 };

  const db = getDb();
  const now = new Date().toISOString();
  clearDevSeed(userId);

  // Exercises first — items reference them.
  const exerciseId = new Map<string, string>();
  let e = 0;
  for (const day of PLAN) {
    for (const lift of day.lifts) {
      if (exerciseId.has(lift.name)) continue;
      const id = uid('e', e++);
      exerciseId.set(lift.name, id);
      db.runSync(
        `INSERT INTO exercises (id, user_id, canonical, aliases, modality, increment_kg, dirty)
         VALUES (?, ?, ?, ?, 'strength', ?, 0)`,
        [id, userId, lift.name, JSON.stringify([lift.name.toLowerCase()]), lift.step],
      );
    }
  }

  let sessions = 0;
  let setCount = 0;
  let w = 0;
  let itemN = 0;
  let setN = 0;

  db.execSync('BEGIN');
  try {
    for (let week = WEEKS - 1; week >= 0; week--) {
      for (let d = 0; d < DAYS_IN_WEEK.length; d++) {
        // A missed week, so the "sessions flat" and "no sessions" insight rules
        // have something real to fire on.
        if (week === 4 && d > 0) continue;

        const dayPlan = PLAN[(sessions + d) % PLAN.length]!;
        const daysAgo = week * 7 + (6 - DAYS_IN_WEEK[d]!);
        const day = isoDay(daysAgo);
        const workoutId = uid('w', w++);

        const lines = dayPlan.lifts.map((lift) => {
          const load = loadFor(lift.start, lift.step, WEEKS - 1 - week);
          return `${lift.name.toLowerCase()} ${lift.reps.length}x${lift.reps[0]} ${load}`;
        });

        db.runSync(
          `INSERT INTO workouts (id, user_id, performed_at, raw_text, parse_version, created_at, updated_at, dirty, structure_dirty, needs_parse)
           VALUES (?, ?, ?, ?, 1, ?, ?, 0, 0, 0)`,
          [workoutId, userId, day, lines.join('\n'), now, now],
        );

        dayPlan.lifts.forEach((lift, position) => {
          const itemId = uid('i', itemN++);
          db.runSync(
            `INSERT INTO items (id, workout_id, position, exercise_id, group_key, group_pos)
             VALUES (?, ?, ?, ?, NULL, NULL)`,
            [itemId, workoutId, position, exerciseId.get(lift.name)!],
          );
          const load = loadFor(lift.start, lift.step, WEEKS - 1 - week);
          lift.reps.forEach((reps, sp) => {
            db.runSync(
              `INSERT INTO sets (id, item_id, position, kind, reps, weight_kg)
               VALUES (?, ?, ?, 'working', ?, ?)`,
              [uid('s', setN++), itemId, sp, reps, load],
            );
            setCount++;
          });
        });

        sessions++;
      }
    }
    db.execSync('COMMIT');
  } catch (error) {
    db.execSync('ROLLBACK');
    throw error;
  }

  return { sessions, sets: setCount };
}
