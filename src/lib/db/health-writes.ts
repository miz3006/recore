import { SESSION_DONE_PREFIX } from './done-state';
import { getDb, nowIso } from './index';

/**
 * THE LEDGER OF WHAT HAS ALREADY GONE TO APPLE HEALTH — the database half of
 * `lib/health/`, which holds the rules and the HealthKit calls.
 *
 * Its whole job is that a session reaches somebody's Health app ONCE. HealthKit
 * has no upsert: `saveWorkoutSample` called twice with the same span produces
 * two workouts, sitting on top of each other in the Fitness app, and the second
 * one is not something Recore can take back later without deleting samples out
 * from under a person. So a write is recorded here in the same tick it lands,
 * and every candidate query starts by excluding what this table already names.
 *
 * ## Why the flag it reads is Finish, and not "has text"
 *
 * Health workouts are FINISHED sessions. A note being written is a note that
 * will still change — its end has not happened yet — and copying it out mid-set
 * would put a ten-minute workout in Health for a session that ran ninety.
 * `session_done:<id>` is the flag Finish sets (`db/done-state.ts`), and this is
 * the second reader of it.
 *
 * ## Why it is local-only
 *
 * It is never pushed and never pulled, and `sync/index.ts` enumerates its
 * columns everywhere, so it is invisible to both directions by construction.
 * That is correct rather than convenient: Health belongs to a PHONE. The same
 * account on a second device has its own Health store and has to write its own
 * copy — a synced ledger would tell the iPhone that the iPad had already done
 * it, and the training would be missing from the Health app the person
 * actually looks at.
 */

export interface PendingHealthSession {
  workoutId: string;
  createdAt: string;
  updatedAt: string;
  /** Parser modality per item that carried at least one set. Empty = unread. */
  modalities: string[];
}

/**
 * How far back one sweep will look. Big enough that turning the switch on
 * carries a real training history across, small enough that it cannot become a
 * thousand HealthKit round-trips on a cold start. `lib/health/index.ts` writes
 * in smaller batches than this; the cap is on what is CONSIDERED.
 */
export const HEALTH_SWEEP_LIMIT = 400;

/**
 * Finished sessions this device has not handed to Health yet, newest first.
 *
 * Newest first is deliberate: if a sweep is interrupted — the app backgrounded,
 * HealthKit busy, the person changing their mind — the sessions that made it
 * across are the ones they are most likely to go looking for.
 *
 * It does NOT apply the eligibility rules (span, parse). Those live in
 * `health/plan.ts`, pure and tested, and this query would have to duplicate
 * them in SQL to pre-filter — two copies of a rule that has to agree.
 */
export function pendingHealthSessions(
  userId: string,
  limit = HEALTH_SWEEP_LIMIT,
): PendingHealthSession[] {
  const db = getDb();
  const rows = db.getAllSync<{ id: string; created_at: string; updated_at: string }>(
    `SELECT w.id, w.created_at, w.updated_at
       FROM workouts w
       JOIN meta m ON m.key = ? || w.id AND m.value = '1'
       LEFT JOIN health_writes h ON h.workout_id = w.id
      WHERE w.user_id = ? AND h.workout_id IS NULL AND trim(w.raw_text) <> ''
      ORDER BY w.performed_at DESC, w.created_at DESC
      LIMIT ?`,
    [SESSION_DONE_PREFIX, userId, limit],
  );

  return rows.map((row) => ({
    workoutId: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    modalities: modalitiesOf(row.id),
  }));
}

/**
 * What kinds of training one session's read items describe.
 *
 * `EXISTS (… sets …)` is the difference between an item the parser produced and
 * an item that carries work: a line the reader recognised as a movement but
 * found no sets on says nothing about what the session WAS. A NULL
 * `exercise_id` falls back to `strength`, which is the same default
 * `parse/rehydrate.ts` applies — an unresolved movement is still a movement.
 */
function modalitiesOf(workoutId: string): string[] {
  return getDb()
    .getAllSync<{ modality: string }>(
      `SELECT DISTINCT COALESCE(e.modality, 'strength') AS modality
         FROM items i
         LEFT JOIN exercises e ON e.id = i.exercise_id
        WHERE i.workout_id = ?
          AND EXISTS (SELECT 1 FROM sets s WHERE s.item_id = i.id)`,
      [workoutId],
    )
    .map((r) => r.modality);
}

/**
 * Record a landed write. Called only after HealthKit has accepted the sample —
 * a row here means "this is in the person's Health app", and writing it
 * optimistically would turn one failed save into a session that never goes.
 *
 * `INSERT OR REPLACE` rather than a plain insert so a ledger row that somehow
 * survived its workout's re-creation cannot throw and abort a sweep.
 */
export function markHealthWritten(
  workoutId: string,
  startedAt: string,
  endedAt: string,
  activity: string,
): void {
  getDb().runSync(
    `INSERT OR REPLACE INTO health_writes (workout_id, started_at, ended_at, activity, written_at)
     VALUES (?, ?, ?, ?, ?)`,
    [workoutId, startedAt, endedAt, activity, nowIso()],
  );
}

export interface HealthLedger {
  /** Sessions of this account's record that are in Health, from this device. */
  written: number;
  /** When the most recent one went across. Null when none has. */
  lastAt: string | null;
}

export function healthLedger(userId: string): HealthLedger {
  const row = getDb().getFirstSync<{ n: number; last: string | null }>(
    `SELECT COUNT(*) AS n, MAX(h.written_at) AS last
       FROM health_writes h
       JOIN workouts w ON w.id = h.workout_id
      WHERE w.user_id = ?`,
    [userId],
  );
  return { written: row?.n ?? 0, lastAt: row?.last ?? null };
}

/**
 * FORGET WHAT WAS WRITTEN — and it is not an undo.
 *
 * The samples stay in Health. Nothing in this app may reach into somebody's
 * Health store and delete training they can see there; the only honest thing a
 * switch in Recore can do is stop adding to it. This exists for the one case
 * where the ledger is the thing that is wrong — a person who deleted Recore's
 * data from inside the Health app and wants their sessions back — and the
 * screen that calls it says exactly that, including that it can duplicate
 * anything Health still holds.
 */
export function clearHealthWrites(userId: string): number {
  const result = getDb().runSync(
    `DELETE FROM health_writes
      WHERE workout_id IN (SELECT id FROM workouts WHERE user_id = ?)`,
    [userId],
  );
  return result.changes ?? 0;
}
