import { dayKeyFor } from './db/dates';
import { getDb } from './db/index';
import { getFunnelSnapshot } from './funnel';

/**
 * JSON export (CLAUDE.md §13, PLAN D2).
 *
 * The CSV is the interchange format — a shape Hevy, Strong and a spreadsheet
 * can read — and it loses the one thing that actually belongs to the user:
 * THEIR OWN WORDS. `raw_text` is the source of truth in this app (§1.1
 * invariant 1); an export that drops it hands back a projection and keeps the
 * record. So this is the complete file: the note as typed, the structure read
 * out of it, the corrections that taught the parser, the shorthands, the plan,
 * the preferences, and the local counters (§2.1 — the user can read exactly
 * what is being counted about them, because it is on their phone).
 *
 * Free forever, never gated, never degraded, never delayed — including on a
 * lapsed subscription (§20). Synchronous over the local mirror, so it works in
 * airplane mode like everything else.
 */
const EXPORT_SCHEMA = 1;

interface SetRow {
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
}

interface ItemRow {
  id: string;
  workout_id: string;
  position: number;
  canonical: string | null;
  modality: string | null;
  group_key: string | null;
  group_pos: number | null;
}

/** Drop nulls so the file reads as a record, not a database dump. */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== null && v !== undefined) out[k] = v;
  return out as Partial<T>;
}

export function buildExportJson(userId: string): string {
  const db = getDb();

  const workouts = db.getAllSync<{
    id: string;
    performed_at: string;
    raw_text: string;
    reflection: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, performed_at, raw_text, reflection, created_at, updated_at
     FROM workouts WHERE user_id = ? AND trim(raw_text) <> '' ORDER BY performed_at ASC`,
    [userId],
  );

  const items = db.getAllSync<ItemRow>(
    `SELECT i.id, i.workout_id, i.position, e.canonical, e.modality, i.group_key, i.group_pos
     FROM items i
     JOIN workouts w ON i.workout_id = w.id
     LEFT JOIN exercises e ON e.id = i.exercise_id
     WHERE w.user_id = ?
     ORDER BY i.workout_id, i.position ASC`,
    [userId],
  );

  const sets = db.getAllSync<SetRow>(
    `SELECT s.item_id, s.position, s.kind, s.parent_set_id, s.reps, s.weight_kg,
            s.distance_m, s.duration_s, s.rir, s.note
     FROM sets s
     JOIN items i ON s.item_id = i.id
     JOIN workouts w ON i.workout_id = w.id
     WHERE w.user_id = ?
     ORDER BY s.item_id, s.position ASC`,
    [userId],
  );

  const setsByItem = new Map<string, SetRow[]>();
  for (const s of sets) {
    const list = setsByItem.get(s.item_id);
    if (list) list.push(s);
    else setsByItem.set(s.item_id, [s]);
  }

  const itemsByWorkout = new Map<string, ItemRow[]>();
  for (const i of items) {
    const list = itemsByWorkout.get(i.workout_id);
    if (list) list.push(i);
    else itemsByWorkout.set(i.workout_id, [i]);
  }

  const payload = {
    app: 'Recore',
    schema: EXPORT_SCHEMA,
    exported_at: new Date().toISOString(),
    note: 'raw_text is what you typed and is the record. Everything under "items" was read out of it and can be rebuilt from it. "reflection" is your own note about how the session went — it is never parsed and never changes a number.',
    workouts: workouts.map((w) => ({
      date: dayKeyFor(new Date(w.performed_at)),
      performed_at: w.performed_at,
      raw_text: w.raw_text,
      // §12: reflection notes are included in the account export. `compact`
      // drops it when there is none, so a skipped check-in leaves no key
      // rather than a null someone has to interpret.
      ...(w.reflection ? { reflection: w.reflection } : {}),
      created_at: w.created_at,
      updated_at: w.updated_at,
      items: (itemsByWorkout.get(w.id) ?? []).map((i) =>
        compact({
          position: i.position,
          exercise: i.canonical,
          modality: i.modality,
          group_key: i.group_key,
          group_pos: i.group_pos,
          sets: (setsByItem.get(i.id) ?? []).map((s) =>
            compact({
              position: s.position,
              kind: s.kind,
              reps: s.reps,
              weight_kg: s.weight_kg,
              distance_m: s.distance_m,
              duration_s: s.duration_s,
              rir: s.rir,
              note: s.note,
              /** Present on a dropset/myo set: the working set it hangs off. */
              is_child: s.parent_set_id ? true : null,
            }),
          ),
        }),
      ),
    })),
    plan_days: db.getAllSync<{ position: number; label: string; weekday_mask: number | null; raw_text: string }>(
      'SELECT position, label, weekday_mask, raw_text FROM plan_days WHERE user_id = ? ORDER BY position ASC',
      [userId],
    ),
    corrections: db.getAllSync<{ line_text: string; before_json: string | null; after_json: string; created_at: string }>(
      'SELECT line_text, before_json, after_json, created_at FROM corrections WHERE user_id = ? ORDER BY created_at ASC',
      [userId],
    ),
    shorthands: db.getAllSync<{ alias: string; canonical: string | null }>(
      `SELECT a.alias, e.canonical FROM alias_overrides a
       LEFT JOIN exercises e ON e.id = a.exercise_id
       WHERE a.user_id = ? ORDER BY a.alias ASC`,
      [userId],
    ),
    predictions: db.getAllSync<{ for_date: string; ghost_text: string; reason: string | null; outcome: string | null }>(
      'SELECT for_date, ghost_text, reason, outcome FROM predictions WHERE user_id = ? ORDER BY for_date ASC',
      [userId],
    ),
    // Preferences the user set, and the local counters described in the privacy
    // policy. Both are the user's own data; hiding either would make the export
    // less than complete, which §20 does not allow.
    preferences: Object.fromEntries(
      db
        .getAllSync<{ key: string; value: string | null }>(
          "SELECT key, value FROM meta WHERE key LIKE 'pref_%' OR key = 'onboarding_done' ORDER BY key ASC",
        )
        .map((r) => [r.key, r.value]),
    ),
    usage_counters: getFunnelSnapshot(),
  };

  if (payload.workouts.length === 0) return '';
  return JSON.stringify(payload, null, 2);
}
