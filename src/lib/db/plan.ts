import { typedNameOf } from '@/lib/parse/receipt';
import { resolveToday, weekdayMonFirst, type PlanDayLite } from '@/lib/plan/resolve';
import { jaccard } from '@/lib/predict/split';
import { getScheduleMode } from '@/lib/prefs';

import { type DayKey } from './dates';
import { findExerciseByName } from './exercises';
import { getDb, getMeta, newId, nowIso, setMeta } from './index';

/**
 * SQLite plumbing for the weekly split (pre-plan). A `plan_days` row is one
 * day-template ("Upper", "Push"…), authored as free text and parsed by the SAME
 * parser as a note — so authoring reuses note-surface.tsx and raw_text stays
 * the source of truth. The pure decision ("what's today") lives in
 * lib/plan/resolve.ts; this file only feeds it rows and stamps the cursor.
 */
export interface PlanDayRow {
  id: string;
  user_id: string;
  position: number;
  label: string;
  weekday_mask: number | null;
  raw_text: string;
  parse_version: number | null;
  created_at: string;
  updated_at: string;
  dirty: number;
}

export function listPlanDays(userId: string): PlanDayRow[] {
  return getDb().getAllSync<PlanDayRow>(
    'SELECT * FROM plan_days WHERE user_id = ? ORDER BY position',
    [userId],
  );
}

export function getPlanDay(id: string): PlanDayRow | null {
  return getDb().getFirstSync<PlanDayRow>('SELECT * FROM plan_days WHERE id = ?', [id]) ?? null;
}

export function hasSplit(userId: string): boolean {
  const row = getDb().getFirstSync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM plan_days WHERE user_id = ?',
    [userId],
  );
  return (row?.n ?? 0) > 0;
}

/** Append a new day-template at the end of the cycle. Returns its id. */
export function addPlanDay(userId: string, label: string, rawText = ''): string {
  const db = getDb();
  const now = nowIso();
  const id = newId();
  const maxPos =
    db.getFirstSync<{ m: number | null }>('SELECT MAX(position) AS m FROM plan_days WHERE user_id = ?', [
      userId,
    ])?.m ?? -1;
  db.runSync(
    `INSERT INTO plan_days (id, user_id, position, label, weekday_mask, raw_text, parse_version, created_at, updated_at, dirty)
     VALUES (?, ?, ?, ?, NULL, ?, NULL, ?, ?, 1)`,
    [id, userId, maxPos + 1, label.trim(), rawText, now, now],
  );
  return id;
}

/** Edit a day's label and/or its written movements. */
export function updatePlanDay(id: string, fields: { label?: string; rawText?: string }): void {
  const cur = getPlanDay(id);
  if (!cur) return;
  getDb().runSync(
    'UPDATE plan_days SET label = ?, raw_text = ?, updated_at = ?, dirty = 1 WHERE id = ?',
    [fields.label?.trim() ?? cur.label, fields.rawText ?? cur.raw_text, nowIso(), id],
  );
}

/** Pin/unpin a day to weekdays (weekday mode). null clears the pin. */
export function setPlanDayWeekday(id: string, mask: number | null): void {
  getDb().runSync('UPDATE plan_days SET weekday_mask = ?, updated_at = ?, dirty = 1 WHERE id = ?', [
    mask,
    nowIso(),
    id,
  ]);
}

export function deletePlanDay(id: string): void {
  getDb().runSync('DELETE FROM plan_days WHERE id = ?', [id]);
  // Tombstone so sync deletes it remotely too — otherwise the next pull would
  // resurrect it (readPlanDeletes/writePlanDeletes are hoisted, defined below).
  const dels = readPlanDeletes();
  if (!dels.includes(id)) writePlanDeletes([...dels, id]);
}

/** Persist a new cycle order (after a drag-reorder). Positions become 0..n-1. */
export function reorderPlanDays(userId: string, orderedIds: string[]): void {
  const db = getDb();
  const now = nowIso();
  db.withTransactionSync(() => {
    orderedIds.forEach((id, i) => {
      db.runSync(
        'UPDATE plan_days SET position = ?, updated_at = ?, dirty = 1 WHERE id = ? AND user_id = ?',
        [i, now, id, userId],
      );
    });
  });
}

/**
 * The day-template the athlete is due for today, or null (no split / rest day).
 * Rotation mode DERIVES its cursor from history — the plan day that best matches
 * the last logged session — so "next" is the day after it, with no stored
 * pointer to drift and no Finish hook to miss. Mirrors predict/split.ts: the
 * rotation always ends at the latest session, so a missed day just slides.
 */
export function resolveTodayPlanDay(userId: string, today: DayKey): PlanDayRow | null {
  const days = listPlanDays(userId);
  if (days.length === 0) return null;
  const mode = getScheduleMode();
  const lite: PlanDayLite[] = days.map((d) => ({
    id: d.id,
    position: d.position,
    weekdayMask: d.weekday_mask,
  }));
  const cursor = mode === 'rotation' ? derivedCursor(userId, days) : null;
  const picked = resolveToday(lite, mode, weekdayMonFirst(dateForKey(today)), cursor);
  return picked ? days.find((d) => d.id === picked.id) ?? null : null;
}

const MATCH_THRESHOLD = 0.3;

/** The rotation cursor, derived: the position of the plan day whose movements
 * best overlap the most recent logged session (Jaccard on exercise ids). No
 * logged session, or nothing above threshold, → null (start of the cycle). */
function derivedCursor(userId: string, days: PlanDayRow[]): number | null {
  const last = new Set(lastSessionExerciseIds(userId));
  if (last.size === 0) return null;
  let best: { position: number; score: number } | null = null;
  for (const day of days) {
    const ids = new Set(planDayExerciseIds(userId, day));
    if (ids.size === 0) continue;
    const score = jaccard(last, ids);
    if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { position: day.position, score };
    }
  }
  return best ? best.position : null;
}

/** Distinct exercise ids of the most recent workout that resolved any. */
function lastSessionExerciseIds(userId: string): string[] {
  const db = getDb();
  const workout = db.getFirstSync<{ id: string }>(
    `SELECT w.id FROM workouts w
     WHERE w.user_id = ?
       AND EXISTS (SELECT 1 FROM items i WHERE i.workout_id = w.id AND i.exercise_id IS NOT NULL)
     ORDER BY w.performed_at DESC LIMIT 1`,
    [userId],
  );
  if (!workout) return [];
  return db
    .getAllSync<{ exercise_id: string }>(
      'SELECT DISTINCT exercise_id FROM items WHERE workout_id = ? AND exercise_id IS NOT NULL',
      [workout.id],
    )
    .map((r) => r.exercise_id);
}

/** Resolve a plan day's written movements to exercise ids (local, read-only). */
function planDayExerciseIds(userId: string, day: PlanDayRow): string[] {
  const ids: string[] = [];
  for (const line of day.raw_text.split('\n')) {
    const name = typedNameOf(line.trim());
    if (!name) continue;
    const ex = findExerciseByName(userId, name);
    if (ex) ids.push(ex.id);
  }
  return ids;
}

function dateForKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

// --- sync (push/pull; mirrors db/predictions.ts) ------------------------------
// plan_days carries a local `dirty` flag like every synced table. Deletes need a
// tombstone list (in the meta KV, per-account) because a hard-deleted row leaves
// nothing to push — without it the row would come back on the next pull.

const DELETES_KEY = 'plan_days_deleted';

function readPlanDeletes(): string[] {
  const raw = getMeta(DELETES_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

function writePlanDeletes(ids: string[]): void {
  setMeta(DELETES_KEY, ids.length ? JSON.stringify(ids) : null);
}

/** Ids the user deleted locally, awaiting a remote delete (tombstones). */
export function getPlanDeletes(): string[] {
  return readPlanDeletes();
}

export function clearPlanDeletes(ids: string[]): void {
  const done = new Set(ids);
  writePlanDeletes(readPlanDeletes().filter((id) => !done.has(id)));
}

export function getDirtyPlanDays(userId: string): PlanDayRow[] {
  return getDb().getAllSync<PlanDayRow>('SELECT * FROM plan_days WHERE user_id = ? AND dirty = 1', [
    userId,
  ]);
}

export function markPlanDaysClean(ids: string[]): void {
  const db = getDb();
  for (const id of ids) db.runSync('UPDATE plan_days SET dirty = 0 WHERE id = ?', [id]);
}

export function upsertPlanDayFromRemote(row: {
  id: string;
  user_id: string;
  position: number;
  label: string;
  weekday_mask: number | null;
  raw_text: string;
  parse_version: number | null;
  created_at: string;
  updated_at: string;
}): void {
  getDb().runSync(
    `INSERT INTO plan_days (id, user_id, position, label, weekday_mask, raw_text, parse_version, created_at, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(id) DO UPDATE SET
       position = excluded.position,
       label = excluded.label,
       weekday_mask = excluded.weekday_mask,
       raw_text = excluded.raw_text,
       parse_version = excluded.parse_version,
       updated_at = excluded.updated_at
     WHERE plan_days.dirty = 0`,
    [
      row.id,
      row.user_id,
      row.position,
      row.label,
      row.weekday_mask,
      row.raw_text,
      row.parse_version,
      row.created_at,
      row.updated_at,
    ],
  );
}

/** After a full pull, drop local rows that are gone remotely and not locally
 * dirty — so a day deleted on another device propagates here too. */
export function deleteStalePlanDays(userId: string, remoteIds: string[]): void {
  const keep = new Set(remoteIds);
  const db = getDb();
  const rows = db.getAllSync<{ id: string; dirty: number }>(
    'SELECT id, dirty FROM plan_days WHERE user_id = ?',
    [userId],
  );
  for (const r of rows) {
    if (!keep.has(r.id) && r.dirty === 0) db.runSync('DELETE FROM plan_days WHERE id = ?', [r.id]);
  }
}
