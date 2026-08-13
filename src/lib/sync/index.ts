import { AppState } from 'react-native';

import {
  getDirtyAliasOverrides,
  markAliasOverridesClean,
  upsertAliasOverrideFromRemote,
} from '@/lib/db/alias-overrides';
import { getDirtyCorrections, markCorrectionsClean } from '@/lib/db/corrections';
import { getDirtyExercises, markExercisesClean, upsertExerciseFromRemote } from '@/lib/db/exercises';
import { getDb, getMeta, setMeta } from '@/lib/db/index';
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
import { devLog } from '@/lib/log';
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
    await retryPendingParses(userId);
    await pushWorkouts(userId);
    await pushExercises(userId);
    // Overrides/corrections AFTER exercises + workouts: their FKs must exist.
    await pushAliasOverrides(userId);
    await pushCorrections(userId);
    await pushPredictions(userId);
    await pushPlanDays(userId);
    await pullRemote(userId);
  } catch (err) {
    devLog('sync pass failed (offline?)', err instanceof Error ? err.message : '');
  } finally {
    syncing = false;
    if (queued) {
      queued = false;
      scheduleSync();
    }
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
  parse_version: number | null;
  created_at: string;
  updated_at: string;
  structure_dirty: number;
}

async function pushWorkouts(userId: string) {
  const db = getDb();
  const rows = db.getAllSync<LocalWorkout>(
    'SELECT * FROM workouts WHERE user_id = ? AND dirty = 1 LIMIT 50',
    [userId],
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

async function pullRemote(userId: string) {
  const db = getDb();
  const since = getMeta(LAST_PULL_KEY) ?? '1970-01-01T00:00:00.000Z';

  const { data: workouts, error } = await supabase
    .from('workouts')
    .select(
      'id, user_id, performed_at, raw_text, reflection, entry_notes, parse_version, created_at, updated_at',
    )
    .gt('updated_at', since)
    .order('updated_at', { ascending: true })
    .limit(100);
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
      `INSERT INTO workouts (id, user_id, performed_at, raw_text, reflection, entry_notes, parse_version, created_at, updated_at, dirty, structure_dirty, needs_parse)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)
       ON CONFLICT(id) DO UPDATE SET
         performed_at = excluded.performed_at,
         raw_text = excluded.raw_text,
         reflection = excluded.reflection,
         entry_notes = excluded.entry_notes,
         parse_version = excluded.parse_version,
         updated_at = excluded.updated_at
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

  // Exercises: the whole visible catalog is small — pull it flat.
  const { data: exercises, error: exError } = await supabase
    .from('exercises')
    .select('id, user_id, canonical, aliases, modality, increment_kg');
  if (exError) throw exError;
  for (const e of exercises ?? []) upsertExerciseFromRemote(e);

  // Alias overrides: the user's shorthand map — small, pull it flat too.
  const { data: overrides, error: ovError } = await supabase
    .from('alias_overrides')
    .select('user_id, alias, exercise_id, created_at');
  if (ovError) throw ovError;
  for (const o of overrides ?? []) upsertAliasOverrideFromRemote(o);

  // Predictions: the ghost window is two weeks (GHOST_MAX_AGE_DAYS) — pull
  // enough that a device that sat idle still shows the latest ghost.
  const { data: predictions, error: pError } = await supabase
    .from('predictions')
    .select('id, user_id, for_date, ghost_text, reason, created_at, accepted_at, outcome')
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
async function retryPendingParses(userId: string) {
  const pending = getWorkoutsNeedingParse(userId);
  for (const w of pending) {
    const outcome = await parseWorkout(userId, w.id);
    if (outcome) parseListener?.(outcome);
  }
}
