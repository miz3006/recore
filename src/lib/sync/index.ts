import { AppState } from 'react-native';

import {
  getDirtyAliasOverrides,
  markAliasOverridesClean,
  upsertAliasOverrideFromRemote,
} from '@/lib/db/alias-overrides';
import { getDirtyCorrections, markCorrectionsClean } from '@/lib/db/corrections';
import {
  getDirtyExercises,
  markExercisesClean,
  mergeDuplicateExercises,
  upsertExerciseFromRemote,
} from '@/lib/db/exercises';
import { getDb, getMeta, nowIso, setMeta } from '@/lib/db/index';
import { mergeDuplicateWorkoutDays } from '@/lib/db/merge-days';
import {
  clearPlanDeletes,
  deleteStalePlanDays,
  getDirtyPlanDays,
  getPlanDeletes,
  markPlanDaysClean,
  upsertPlanDayFromRemote,
} from '@/lib/db/plan';
import {
  getDirtyPredictions,
  markPredictionsClean,
  upsertPredictionFromRemote,
} from '@/lib/db/predictions';
import { getWorkoutsNeedingParse } from '@/lib/db/workouts';
import { isSupabaseConfigured } from '@/lib/env';
import { devLog, errorText } from '@/lib/log';
import { parseWorkout, type ParseOutcome } from '@/lib/parse/client';
import { supabase } from '@/lib/supabase';

/**
 * Background push/pull to Supabase (CLAUDE.md §2). SQLite is the source of
 * truth on-device; Supabase is the sync/backup target. Nothing here ever
 * blocks the UI: every entry point is fire-and-forget, failures are swallowed
 * (the dirty flags keep the work queued), and the whole engine is a no-op
 * offline — gyms have no signal.
 *
 * Conflict rule: locally dirty rows win; pulls skip them (last-writer-wins,
 * good enough for a single-athlete, few-devices dataset).
 */
const LAST_PULL_KEY = 'last_pull_at';
const DEBOUNCE_MS = 4000;

/**
 * HOW MUCH ONE PASS MOVES, AND WHY A FULL BATCH BOOKS THE NEXT ONE.
 *
 * Both numbers are old; the re-queue is not (10 September 2026). A pass pushed
 * at most 50 workouts and pulled at most 100, and then simply stopped —
 * nothing scheduled the continuation. The next pass came only from a
 * foreground, a keystroke's debounce, or a parse landing.
 *
 * That is invisible in ordinary use, where a person writes one day at a time
 * and 50 is never reached. It is not invisible after `import/apply.ts`: a
 * tracker export writes a year of history in one transaction, every row
 * `dirty = 1`, and the account's backup then advanced FIFTY DAYS PER APP OPEN.
 * Somebody who imported and then went to train had most of their history still
 * only on the phone — which is the one state the sync loop exists to prevent,
 * and it reported no error while it lasted.
 *
 * So a batch that comes back FULL means "there is more", and says so. The
 * caps stay: they bound one pass's work, which is what they were for.
 */
const PUSH_BATCH = 50;
const PULL_BATCH = 100;

let syncing = false;
let queued = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let activeUserId: string | null = null;

export function startSync(userId: string) {
  activeUserId = userId;
  void syncNow();
}

export function stopSync() {
  activeUserId = null;
}

/** Debounced nudge after local writes. */
export function scheduleSync() {
  if (!activeUserId) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void syncNow(), DEBOUNCE_MS);
}

// Re-sync whenever the app returns to the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active' && activeUserId) void syncNow();
});

export async function syncNow(): Promise<void> {
  const userId = activeUserId;
  if (!userId || !isSupabaseConfigured()) return;
  if (syncing) {
    queued = true;
    return;
  }
  syncing = true;

  try {
    if (await pushWorkouts(userId)) queued = true;
    await pushExercises(userId);
    // Overrides/corrections AFTER exercises + workouts: their FKs must exist.
    await pushAliasOverrides(userId);
    await pushCorrections(userId);
    await pushPredictions(userId);
    await pushPlanDays(userId);

    /**
     * THE PULL COMES BEFORE THE PARSE, and it is not a preference.
     *
     * A parse resolves every reading against the LOCAL exercise catalogue, so
     * a device that has not pulled one yet — a fresh install, a restored
     * account, a wiped database — invents its own row for a movement the
     * account already has, pushes it, and the account ends up with the same
     * lift twice, its history split down the middle. Parsing after the pull
     * closes that window; `mergeDuplicateExercises` inside the pull heals
     * whatever slipped through it before.
     *
     * The pull is allowed to fail on its own without taking the parse with it:
     * a reading is the app's core promise and must not wait on sync being
     * healthy.
     */
    try {
      if (await pullRemote(userId)) queued = true;
    } catch (err) {
      devLog('pull failed:', errorText(err));
    }

    await repairDuplicateDays(userId);

    // Anything the parse writes is dirty; queue another pass to push it.
    if ((await retryPendingParses(userId)) > 0) queued = true;
  } catch (err) {
    // The cause, not a guess at it. "(offline?)" was a question the log could
    // already have answered and usually printed nothing after.
    devLog('sync pass failed:', errorText(err));
  } finally {
    syncing = false;
    if (queued) {
      queued = false;
      scheduleSync();
    }
  }
}

/**
 * ONE ACCOUNT, ONE DAY, ONE ROW — the one-off repair for days that already
 * split. `db/merge-days.ts` explains the rules and
 * `20260910191000_merge_duplicate_days.sql` is the identical pass on the
 * server; `db/day-id.ts` is what stops new ones being made.
 *
 * Guarded by a meta key so it costs one round trip per account for ever rather
 * than one per sync pass — and the key is written only after BOTH halves have
 * run, so an offline attempt simply happens again on the next pass. Both halves
 * are idempotent, which is what makes retrying free.
 *
 * A failure here is logged and dropped. It repairs history; it must never be
 * the reason a workout does not sync.
 */
async function repairDuplicateDays(userId: string): Promise<void> {
  const key = `day_merge_v1:${userId}`;
  if (getMeta(key)) return;
  try {
    const { error } = await supabase.rpc('merge_duplicate_workout_days');
    if (error) {
      devLog('duplicate-day repair (remote) failed:', errorText(error));
      return;
    }
    const local = mergeDuplicateWorkoutDays(getDb(), userId);
    setMeta(key, nowIso());
    if (local > 0) devLog(`folded ${local} duplicate workout row(s) into their day`);
  } catch (err) {
    devLog('duplicate-day repair failed:', errorText(err));
  }
}

// --- push --------------------------------------------------------------------

interface LocalWorkout {
  id: string;
  user_id: string;
  performed_at: string;
  raw_text: string;
  reflection: string | null;
  entry_notes: string | null;
  session_effort: number | null;
  parse_version: number | null;
  created_at: string;
  updated_at: string;
  structure_dirty: number;
}

/** Returns true when the batch came back full — i.e. there is more to push. */
async function pushWorkouts(userId: string): Promise<boolean> {
  const db = getDb();
  const rows = db.getAllSync<LocalWorkout>(
    'SELECT * FROM workouts WHERE user_id = ? AND dirty = 1 LIMIT ?',
    [userId, PUSH_BATCH],
  );

  for (const w of rows) {
    const { error } = await supabase.from('workouts').upsert({
      id: w.id,
      user_id: w.user_id, // RLS enforces this equals auth.uid()
      performed_at: w.performed_at,
      raw_text: w.raw_text,
      // The athlete's own note about the session (§8.1). It rides the workout
      // row, so it gets this row's RLS and this row's cascade delete.
      reflection: w.reflection,
      // The athlete's per-entry notes, as the JSON map the column stores. Same
      // row, same RLS, same cascade delete as the reflection beside it.
      entry_notes: w.entry_notes,
      // The session's own CR-10 rating (`lib/session-effort.ts`). A number, so
      // unlike the two notes above it needs no validation on the way back —
      // `sessionEffortOf` rounds whatever arrives onto the offered scale.
      session_effort: w.session_effort,
      parse_version: w.parse_version,
      created_at: w.created_at,
      updated_at: w.updated_at,
    });
    if (error) throw error;

    if (w.structure_dirty === 1) {
      await pushStructure(w.id);
      db.runSync('UPDATE workouts SET structure_dirty = 0 WHERE id = ?', [w.id]);
    }
    db.runSync('UPDATE workouts SET dirty = 0 WHERE id = ? AND updated_at = ?', [
      w.id,
      w.updated_at, // don't clear if the user typed again mid-push
    ]);
  }

  return rows.length === PUSH_BATCH;
}

/** Items/sets are a projection — replace them wholesale for the workout. */
async function pushStructure(workoutId: string) {
  const db = getDb();

  // New user-owned exercises must exist remotely before items reference them.
  const referenced = db.getAllSync<{ id: string; user_id: string | null; canonical: string; aliases: string; modality: string; increment_kg: number | null }>(
    `SELECT e.* FROM exercises e WHERE e.id IN (SELECT exercise_id FROM items WHERE workout_id = ?) AND e.user_id IS NOT NULL`,
    [workoutId],
  );
  for (const e of referenced) {
    const { error } = await supabase.from('exercises').upsert({
      id: e.id,
      user_id: e.user_id,
      canonical: e.canonical,
      aliases: JSON.parse(e.aliases) as string[],
      modality: e.modality,
      increment_kg: e.increment_kg,
    });
    if (error) throw error;
  }

  const { error: delError } = await supabase.from('items').delete().eq('workout_id', workoutId);
  if (delError) throw delError;

  const items = db.getAllSync<{
    id: string;
    workout_id: string;
    position: number;
    exercise_id: string | null;
    group_key: string | null;
    group_pos: number | null;
  }>('SELECT id, workout_id, position, exercise_id, group_key, group_pos FROM items WHERE workout_id = ?', [workoutId]);
  if (items.length === 0) return;

  const { error: itemsError } = await supabase.from('items').insert(items);
  if (itemsError) throw itemsError;

  const sets = db.getAllSync<{
    id: string;
    item_id: string;
    position: number;
    kind: string;
    parent_set_id: string | null;
    reps: number | null;
    weight_kg: number | null;
    distance_m: number | null;
    duration_s: number | null;
    rir: number | null;
    note: string | null;
  }>(
    `SELECT s.* FROM sets s WHERE s.item_id IN (SELECT id FROM items WHERE workout_id = ?)
     ORDER BY s.parent_set_id IS NOT NULL, s.position`, // parents insert before children (self-FK)
    [workoutId],
  );
  if (sets.length > 0) {
    const { error: setsError } = await supabase.from('sets').insert(sets);
    if (setsError) throw setsError;
  }
}

async function pushExercises(userId: string) {
  const dirty = getDirtyExercises(userId);
  if (dirty.length === 0) return;

  const payload = dirty.map((e) => ({
    id: e.id,
    user_id: e.user_id,
    canonical: e.canonical,
    aliases: JSON.parse(e.aliases) as string[],
    modality: e.modality,
    increment_kg: e.increment_kg,
  }));
  const { error } = await supabase.from('exercises').upsert(payload);
  if (error) throw error;
  markExercisesClean(dirty.map((e) => e.id));
}

/** Shorthand map — small, upserted whole rows, both directions. */
async function pushAliasOverrides(userId: string) {
  const dirty = getDirtyAliasOverrides(userId);
  if (dirty.length === 0) return;

  const payload = dirty.map((o) => ({
    user_id: o.user_id,
    alias: o.alias,
    exercise_id: o.exercise_id,
    created_at: o.created_at,
  }));
  const { error } = await supabase
    .from('alias_overrides')
    .upsert(payload, { onConflict: 'user_id,alias' });
  if (error) throw error;
  markAliasOverridesClean(userId, dirty.map((o) => o.alias));
}

/** Corrections are append-only training data (CLAUDE.md §6.2) — pushed up,
 * never pulled back. */
async function pushCorrections(userId: string) {
  const dirty = getDirtyCorrections(userId);
  if (dirty.length === 0) return;

  const payload = dirty.map((c) => ({
    id: c.id,
    user_id: c.user_id,
    workout_id: c.workout_id,
    line_text: c.line_text,
    before_json: c.before_json ? (JSON.parse(c.before_json) as unknown) : null,
    after_json: JSON.parse(c.after_json) as unknown,
    created_at: c.created_at,
  }));
  const { error } = await supabase.from('corrections').upsert(payload);
  if (error) throw error;
  markCorrectionsClean(dirty.map((c) => c.id));
}

async function pushPredictions(userId: string) {
  const dirty = getDirtyPredictions(userId);
  if (dirty.length === 0) return;

  const payload = dirty.map((p) => ({
    id: p.id,
    user_id: p.user_id,
    for_date: p.for_date,
    ghost_text: p.ghost_text,
    reason: p.reason,
    created_at: p.created_at,
    accepted_at: p.accepted_at,
    outcome: p.outcome,
  }));
  const { error } = await supabase
    .from('predictions')
    .upsert(payload, { onConflict: 'user_id,for_date' });
  if (error) throw error;
  markPredictionsClean(dirty.map((p) => p.id));
}

/** The declared weekly split (pre-plan). Tombstones are pushed as remote
 * deletes FIRST so the pull can't resurrect a day the user removed. */
async function pushPlanDays(userId: string) {
  const deletes = getPlanDeletes();
  if (deletes.length > 0) {
    const { error } = await supabase.from('plan_days').delete().in('id', deletes);
    if (error) throw error;
    clearPlanDeletes(deletes);
  }

  const dirty = getDirtyPlanDays(userId);
  if (dirty.length === 0) return;

  const payload = dirty.map((d) => ({
    id: d.id,
    user_id: d.user_id,
    position: d.position,
    label: d.label,
    weekday_mask: d.weekday_mask,
    raw_text: d.raw_text,
    parse_version: d.parse_version,
    created_at: d.created_at,
    updated_at: d.updated_at,
  }));
  const { error } = await supabase.from('plan_days').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
  markPlanDaysClean(dirty.map((d) => d.id));
}

// --- pull --------------------------------------------------------------------

/** Returns true when the workout page came back full — there is more to pull. */
async function pullRemote(userId: string): Promise<boolean> {
  const db = getDb();
  const since = getMeta(LAST_PULL_KEY) ?? '1970-01-01T00:00:00.000Z';

  /**
   * THE CATALOGUE COMES FIRST, AND EVERYTHING ELSE DEPENDS ON IT.
   *
   * `items.exercise_id` and `alias_overrides.exercise_id` are FOREIGN KEYS and
   * this database runs with `PRAGMA foreign_keys = ON` (`db/index.ts`). Pulling
   * a workout's structure before the exercises it points at therefore does not
   * degrade — it THROWS, `SQLITE_CONSTRAINT_FOREIGNKEY`, and takes the whole
   * pull down with it. Every pass. On any device that did not create those
   * items itself, which is every second device and every reinstall.
   *
   * Found 10 September 2026 by replaying this function's own SQL against a copy
   * of a device database: `last_pull_at` had never been written, so nothing had
   * ever been pulled — no workouts from the other device, no catalogue, no
   * alias fixes, no ghosts. And with no catalogue, every parse invented a new
   * exercise row and pushed it: thirty rows in the account for eight movements.
   *
   * So: exercises, then the shorthand that points at them, then the workouts
   * and their structure.
   */
  /**
   * EVERY PULL NAMES THE USER IT IS PULLING FOR. RLS IS THE SECOND LOCK, NEVER
   * THE ONLY ONE (10 September 2026).
   *
   * Until today these queries carried no `user_id` filter at all: they asked
   * for the whole table and let the row-level policies cut it down to the
   * caller's own rows. That is correct only while "what the policy allows" and
   * "what this device is allowed to store" are the same set — and the coaching
   * link is precisely the feature that separates them. The moment a coach may
   * SELECT a client's workouts, an unfiltered pull writes another person's raw
   * text, reflections and per-entry notes into the coach's local SQLite, on
   * every sync pass, silently, with no screen ever asking for it.
   *
   * So the filter is stated here, in the client, as well as in the policy. A
   * widened policy can then never widen what lands on a device: the two locks
   * fail independently, which is the only reason to have two.
   *
   * `exercises` is the one that is NOT `eq` — the global catalogue is
   * `user_id is null` and every account legitimately reads it (see
   * `exercises_select` in the initial migration), so its filter is "mine or
   * global" rather than "mine".
   */
  const { data: exercises, error: exError } = await supabase
    .from('exercises')
    .select('id, user_id, canonical, aliases, modality, increment_kg')
    .or(`user_id.eq.${userId},user_id.is.null`);
  if (exError) throw exError;
  for (const e of exercises ?? []) upsertExerciseFromRemote(e);
  // Now that the account's own names are here, fold away any row this device
  // invented for a movement that already had one (see the note in `syncNow`).
  const merged = mergeDuplicateExercises(userId, new Set((exercises ?? []).map((e) => e.id)));
  if (merged > 0) devLog(`merged ${merged} duplicate exercise row(s) after pull`);

  const { data: overrides, error: ovError } = await supabase
    .from('alias_overrides')
    .select('user_id, alias, exercise_id, created_at')
    .eq('user_id', userId);
  if (ovError) throw ovError;
  for (const o of overrides ?? []) upsertAliasOverrideFromRemote(o);

  const { data: workouts, error } = await supabase
    .from('workouts')
    .select(
      'id, user_id, performed_at, raw_text, reflection, entry_notes, session_effort, parse_version, created_at, updated_at',
    )
    .eq('user_id', userId)
    .gt('updated_at', since)
    .order('updated_at', { ascending: true })
    .limit(PULL_BATCH);
  if (error) throw error;

  let cursor = since;
  const pulledIds: string[] = [];

  for (const w of workouts ?? []) {
    cursor = w.updated_at > cursor ? w.updated_at : cursor;
    const local = db.getFirstSync<{ dirty: number }>('SELECT dirty FROM workouts WHERE id = ?', [
      w.id,
    ]);
    if (local?.dirty === 1) continue; // local edits win

    db.runSync(
      `INSERT INTO workouts (id, user_id, performed_at, raw_text, reflection, entry_notes, session_effort, parse_version, created_at, updated_at, dirty, structure_dirty, needs_parse)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)
       ON CONFLICT(id) DO UPDATE SET
         performed_at = excluded.performed_at,
         raw_text = excluded.raw_text,
         reflection = excluded.reflection,
         entry_notes = excluded.entry_notes,
         session_effort = excluded.session_effort,
         parse_version = excluded.parse_version,
         updated_at = excluded.updated_at,
         -- Text from another device is a DIFFERENT question, so whatever wait
         -- this device's own failed readings earned does not apply to it.
         -- See db/parse-backoff.ts (no backticks: this is inside a template
         -- literal, and one would end the string here).
         parse_attempts = 0,
         parse_next_at = NULL
       WHERE workouts.dirty = 0`,
      [
        w.id,
        w.user_id,
        w.performed_at,
        w.raw_text,
        w.reflection,
        // A remote row is untrusted text until `parseEntryNotes` reads it; it is
        // stored as it arrived and validated on every read, exactly like the
        // local column.
        typeof w.entry_notes === 'string' ? w.entry_notes : null,
        typeof w.session_effort === 'number' ? w.session_effort : null,
        w.parse_version,
        w.created_at,
        w.updated_at,
      ],
    );
    pulledIds.push(w.id);
  }

  if (pulledIds.length > 0) {
    await pullStructure(pulledIds);
  }

  // Predictions: the ghost window is two weeks (GHOST_MAX_AGE_DAYS) — pull
  // enough that a device that sat idle still shows the latest ghost.
  const { data: predictions, error: pError } = await supabase
    .from('predictions')
    .select('id, user_id, for_date, ghost_text, reason, created_at, accepted_at, outcome')
    .eq('user_id', userId)
    .gte('for_date', new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10));
  if (pError) throw pError;
  for (const p of predictions ?? []) upsertPredictionFromRemote(p);

  // Plan days: the declared split — small, pull it flat, then reconcile deletes
  // (rows gone remotely and not locally dirty) so a day removed on another
  // device disappears here too.
  const { data: planDays, error: pdError } = await supabase
    .from('plan_days')
    .select('id, user_id, position, label, weekday_mask, raw_text, parse_version, created_at, updated_at')
    .eq('user_id', userId);
  if (pdError) throw pdError;
  for (const d of planDays ?? []) upsertPlanDayFromRemote(d);
  deleteStalePlanDays(
    userId,
    (planDays ?? []).map((d) => d.id),
  );

  setMeta(LAST_PULL_KEY, cursor);

  return (workouts ?? []).length === PULL_BATCH;
}

async function pullStructure(workoutIds: string[]) {
  const db = getDb();

  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select('id, workout_id, position, exercise_id, group_key, group_pos')
    .in('workout_id', workoutIds);
  if (itemsError) throw itemsError;

  const itemIds = (items ?? []).map((i) => i.id);
  const { data: sets, error: setsError } = itemIds.length
    ? await supabase
        .from('sets')
        .select('id, item_id, position, kind, parent_set_id, reps, weight_kg, distance_m, duration_s, rir, note')
        .in('item_id', itemIds)
    : { data: [], error: null };
  if (setsError) throw setsError;

  db.withTransactionSync(() => {
    for (const id of workoutIds) {
      db.runSync('DELETE FROM items WHERE workout_id = ?', [id]);
    }
    for (const i of items ?? []) {
      db.runSync(
        'INSERT OR REPLACE INTO items (id, workout_id, position, exercise_id, group_key, group_pos) VALUES (?, ?, ?, ?, ?, ?)',
        [i.id, i.workout_id, i.position, i.exercise_id, i.group_key, i.group_pos],
      );
    }
    const ordered = [...(sets ?? [])].sort(
      (a, b) => Number(a.parent_set_id !== null) - Number(b.parent_set_id !== null),
    );
    for (const s of ordered) {
      db.runSync(
        'INSERT OR REPLACE INTO sets (id, item_id, position, kind, parent_set_id, reps, weight_kg, distance_m, duration_s, rir, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [s.id, s.item_id, s.position, s.kind, s.parent_set_id, s.reps, s.weight_kg, s.distance_m, s.duration_s, s.rir, s.note],
      );
    }
  });
}

// --- deferred parses ----------------------------------------------------------

/** The session store registers here so a parse that lands via the SYNC loop
 * (not the foreground debounce) still reaches the open screen — without this,
 * a retried parse updates SQLite but the gutter/receipt stay stale until the
 * next day-switch or app restart. Registration keeps the dependency one-way:
 * sync never imports UI state. */
let parseListener: ((outcome: ParseOutcome) => void) | null = null;

export function setParseListener(listener: ((outcome: ParseOutcome) => void) | null) {
  parseListener = listener;
}

/** Retry parses that failed offline (CLAUDE.md §6 step 4). */
/**
 * The deferred-parse queue: at most `PARSE_BATCH` days per pass, newest first.
 *
 * **It carries on when a full batch succeeds** (10 Sep 2026). The batch cap
 * exists so one sync pass cannot turn into a long series of model calls, but it
 * used to mean the queue only ever drained at the rate the app happened to sync
 * — and a device that pulled a history down has a queue tens of days long
 * (`parse/rehydrate.ts`: 23 of 66 on a real account had no structure to rebuild
 * from). Those days simply waited.
 *
 * Re-queueing is conditional on PROGRESS, not on the queue being non-empty: a
 * batch where nothing landed is offline, signed out, or rate-limited, and
 * asking again immediately would be a loop. One that fully succeeded has earned
 * the next one.
 */
const PARSE_BATCH = 5;

async function retryPendingParses(userId: string): Promise<number> {
  const pending = getWorkoutsNeedingParse(userId, PARSE_BATCH);
  let landed = 0;
  for (const w of pending) {
    const outcome = await parseWorkout(userId, w.id);
    if (outcome) {
      landed += 1;
      parseListener?.(outcome);
    }
  }
  if (landed === PARSE_BATCH) scheduleSync();
  return landed;
}
