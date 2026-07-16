/**
 * Local SQLite schema (CLAUDE.md §3) — mirrors the Postgres migration.
 *
 * Sync bookkeeping lives in extra LOCAL-ONLY columns/tables that are never
 * pushed: `dirty` / `structure_dirty` / `needs_parse` flags, the `meta` KV
 * table, and `parse_cache` (the last parse result + gutter signals per
 * workout, kept so the gutter renders instantly after a cold start).
 */
export const SCHEMA_VERSION = 2;

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
