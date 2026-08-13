-- Per-entry notes (owner, 4 August 2026) — the athlete's own words about ONE
-- recorded exercise, the sibling of the session reflection added in
-- 20260729000000_reflections.sql.
--
-- A COLUMN ON `workouts` holding a small JSON map, for the same reason the
-- reflection is a column: the notes belong to a session, so riding the workout
-- row makes §12's promise — "the same account scoping, export, and deletion
-- guarantees as workout records" — true by construction rather than by a policy
-- someone has to remember to write:
--
--   · Account scoping   — the existing `workouts` RLS policies are row-level,
--                         so they already cover every column on the row.
--   · Deletion          — `user_id references auth.users on delete cascade` on
--                         the table takes the notes with the account.
--   · Export            — `buildExportJson` reads the workout row.
--
-- A table would have needed its own policy, its own push and pull, its own
-- delete path and its own foreign key to store what is at most a handful of
-- short strings per session, read and written whole.
--
-- SHAPE: {"<exercise name, trimmed and lower-cased>": "<the athlete's words>"}.
-- The client normalizes the keys (`entryNoteKey`) and re-validates the whole
-- map on every read (`parseEntryNotes`), so a hand-edited or foreign row can
-- never reach the ledger unchecked. `text`, not `jsonb`: the client stores and
-- ships the exact string it validated, and nothing server-side queries inside
-- it.
--
-- It sits beside `raw_text`, never inside it. `raw_text` is what the parser
-- reads; these are notes about an entry that no parser should ever see, and no
-- prescription, chart, PR or streak reads them. What changes a future load is
-- the RPE marker the athlete sets on the same entry, which lives in `raw_text`
-- as training notation.
--
-- Nullable with no default: no notes is a first-class state, and every row
-- written before today genuinely has none.

alter table public.workouts
  add column if not exists entry_notes text;

comment on column public.workouts.entry_notes is
  'JSON map of the athlete''s optional notes on individual exercises of this session (exercise key → their words). Never parsed, never an input to a prescription, and never a health assessment.';
