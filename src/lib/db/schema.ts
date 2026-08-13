/**
 * Local SQLite schema (CLAUDE.md §3) — mirrors the Postgres migration.
 *
 * Sync bookkeeping lives in extra LOCAL-ONLY columns/tables that are never
 * pushed: `dirty` / `structure_dirty` / `needs_parse` flags, the `meta` KV
 * table, and `parse_cache` (the last parse result + gutter signals per
 * workout, kept so the gutter renders instantly after a cold start).
 */
export const SCHEMA_VERSION = 5;

export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT
);

-- 1. One row = one workout note. raw_text is NEVER rewritten.
CREATE TABLE IF NOT EXISTS workouts (
  id              TEXT PRIMARY KEY NOT NULL,
  user_id         TEXT NOT NULL,
  performed_at    TEXT NOT NULL,            -- UTC ISO; the DAY this workout belongs to
  raw_text        TEXT NOT NULL,            -- exactly what the user typed
  reflection      TEXT,                     -- the athlete's own end-of-session note (§8.1)
  entry_notes     TEXT,                     -- JSON {exercise key: the athlete's note on that entry}
  parse_version   INTEGER,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  dirty           INTEGER NOT NULL DEFAULT 1,  -- row needs push
  structure_dirty INTEGER NOT NULL DEFAULT 0,  -- items/sets need re-push
  needs_parse     INTEGER NOT NULL DEFAULT 0   -- parse failed/offline; retry on sync
);
CREATE INDEX IF NOT EXISTS workouts_user_performed_idx ON workouts (user_id, performed_at DESC);

-- 2. One row = one exercise occurrence within a workout.
CREATE TABLE IF NOT EXISTS items (
  id          TEXT PRIMARY KEY NOT NULL,
  workout_id  TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  exercise_id TEXT REFERENCES exercises(id),
  group_key   TEXT,
  group_pos   INTEGER
);
CREATE INDEX IF NOT EXISTS items_workout_idx ON items (workout_id);
CREATE INDEX IF NOT EXISTS items_exercise_idx ON items (exercise_id);

-- 3. Sets. ONE table for lifting AND cardio AND holds.
CREATE TABLE IF NOT EXISTS sets (
  id            TEXT PRIMARY KEY NOT NULL,
  item_id       TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'working',
  parent_set_id TEXT REFERENCES sets(id),
  reps          INTEGER,
  weight_kg     REAL,
  distance_m    REAL,
  duration_s    INTEGER,
  rir           REAL,
  note          TEXT
);
CREATE INDEX IF NOT EXISTS sets_item_idx ON sets (item_id);

-- 4. Exercises + aliasing. aliases is a JSON string array (SQLite has no text[]).
CREATE TABLE IF NOT EXISTS exercises (
  id           TEXT PRIMARY KEY NOT NULL,
  user_id      TEXT,                        -- null = global/default exercise
  canonical    TEXT NOT NULL,
  aliases      TEXT NOT NULL DEFAULT '[]',
  modality     TEXT DEFAULT 'strength',
  increment_kg REAL,
  dirty        INTEGER NOT NULL DEFAULT 0
);

-- Prediction cache: computed AFTER a workout, read on open.
-- accepted_at/outcome = adherence instrumentation (CLAUDE.md §7.2 Gap 3):
-- did the ghost get accepted (Start) and was the prescription followed?
CREATE TABLE IF NOT EXISTS predictions (
  id          TEXT PRIMARY KEY NOT NULL,
  user_id     TEXT NOT NULL,
  for_date    TEXT NOT NULL,                -- YYYY-MM-DD
  ghost_text  TEXT NOT NULL,
  reason      TEXT,
  created_at  TEXT NOT NULL,
  accepted_at TEXT,
  outcome     TEXT,                         -- followed | edited | ignored
  dirty       INTEGER NOT NULL DEFAULT 1,
  UNIQUE (user_id, for_date)
);

-- Weekly split (pre-plan). One row = one day-template in the user's split
-- ("Upper", "Push"…), AUTHORED AS FREE TEXT and parsed by the SAME parser as a
-- note (raw_text is the source of truth, same as workouts). Undated & reusable
-- — never a workout, so it lives in its own table. position = the rotation
-- order; weekday_mask (NULL = rotation-only) pins the day to weekdays (bit i,
-- 0=Mon … 6=Sun) when the user opts into weekday mode. LOCAL adds dirty.
CREATE TABLE IF NOT EXISTS plan_days (
  id            TEXT PRIMARY KEY NOT NULL,
  user_id       TEXT NOT NULL,
  position      INTEGER NOT NULL,
  label         TEXT NOT NULL,
  weekday_mask  INTEGER,
  raw_text      TEXT NOT NULL DEFAULT '',
  parse_version INTEGER,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  dirty         INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS plan_days_user_position_idx ON plan_days (user_id, position);

-- Parser correction loop (CLAUDE.md §6.2): every user fix is training data —
-- the raw line, what the parser said, what the user said it should be. Pushed
-- to Supabase, never pulled. applyParseResult overlays these by exact line
-- text so a fix STICKS across re-parses of the same note.
CREATE TABLE IF NOT EXISTS corrections (
  id          TEXT PRIMARY KEY NOT NULL,
  user_id     TEXT NOT NULL,
  workout_id  TEXT REFERENCES workouts(id) ON DELETE CASCADE,
  line_text   TEXT NOT NULL,                -- the raw line as typed (trimmed)
  before_json TEXT,                         -- ParsedItem the parser produced
  after_json  TEXT NOT NULL,                -- ParsedItem the user corrected to
  created_at  TEXT NOT NULL,
  dirty       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS corrections_workout_idx ON corrections (workout_id);

-- Alias overrides (CLAUDE.md §6.2): "this user's shorthand → that exercise",
-- consulted BEFORE any other resolution. Lets a correction re-point shorthand
-- at GLOBAL exercises too (whose alias arrays are read-only), with no
-- duplicate shadow rows and no fragmented history.
CREATE TABLE IF NOT EXISTS alias_overrides (
  user_id     TEXT NOT NULL,
  alias       TEXT NOT NULL,                -- normalized (trim/lower/one-space)
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  dirty       INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, alias)
);

-- LOCAL ONLY: last parse result + computed gutter signals per workout, so the
-- right gutter survives an app restart without re-calling the edge function.
CREATE TABLE IF NOT EXISTS parse_cache (
  workout_id   TEXT PRIMARY KEY NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  raw_snapshot TEXT NOT NULL,               -- the raw_text this result belongs to
  result_json  TEXT NOT NULL,
  signals_json TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
`;

/** v1 → v2: correction loop + alias overrides + prediction adherence columns.
 * New tables ride along via SCHEMA_SQL's IF NOT EXISTS; existing tables need
 * explicit ALTERs (CREATE IF NOT EXISTS never adds columns). */
export const MIGRATION_2_SQL = `
ALTER TABLE predictions ADD COLUMN accepted_at TEXT;
ALTER TABLE predictions ADD COLUMN outcome TEXT;
`;

/** v2 → v3: `plan_days` (weekly split) is a brand-new table, so it needs NO
 * ALTER — migrate() runs SCHEMA_SQL for any current < SCHEMA_VERSION and its
 * IF NOT EXISTS creates it on a fresh or upgrading install. */

/**
 * v3 → v4: the end-of-session reflection (§8.1).
 *
 * A COLUMN ON `workouts`, not a table of its own, and the shape is the argument:
 * a reflection is one per finished session, so it is the workout's own field.
 * It therefore inherits — with no new machinery and no way to forget one —
 * the account scoping (`user_id` + the row's RLS policy), the sync path, the
 * JSON export, and the delete-account wipe. §12 demands "the same account
 * scoping, export, and deletion guarantees as workout records"; being an actual
 * workout record is the cheapest way to keep that promise.
 *
 * It sits BESIDE `raw_text` rather than inside it. `raw_text` is the source of
 * truth that the parser reads and re-reads; a reflection is prose about the
 * session that no parser should ever see (§3, and `lib/reflection.ts`).
 */
export const MIGRATION_4_SQL = `
ALTER TABLE workouts ADD COLUMN reflection TEXT;
`;

/**
 * v4 → v5: the per-entry note (owner, 4 Aug 2026).
 *
 * ONE COLUMN HOLDING A SMALL JSON MAP, for the same reason the reflection is a
 * column: a note belongs to a session's entry, so riding the workout row makes
 * §12's promise — "the same account scoping, export, and deletion guarantees as
 * workout records" — true by construction. RLS is row-level, the account
 * cascade takes it, `buildExportJson` reads the row, `ensureLocalUser` wipes it.
 *
 * WHY NOT A ROW PER NOTE. A table would need its own RLS policy, its own push
 * and pull, its own delete path and its own foreign key — four places to forget
 * something — to store what is at most a handful of short strings per session.
 * The map is read and written whole, so there is nothing to reconcile.
 *
 * WHY NOT ON `sets.note`. That column belongs to the PARSE (it is rebuilt from
 * raw_text on every re-parse, `applyParseResult` deletes and re-inserts the
 * rows). A note the athlete wrote must survive a re-parse; a projection cannot
 * hold it.
 *
 * The keys are canonical exercise names, normalized by `entryNoteKey` — line
 * indexes shift and set text changes when a number is corrected, so neither can
 * identify an entry a day later.
 */
export const MIGRATION_5_SQL = `
ALTER TABLE workouts ADD COLUMN entry_notes TEXT;
`;
