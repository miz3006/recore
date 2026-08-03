-- The end-of-session reflection (product-direction §8.1).
--
-- A COLUMN ON `workouts`, not a table of its own: a reflection is one per
-- finished session, so it is the workout's own field. That shape is what makes
-- §12's promise — "store them with the same account scoping, export, and
-- deletion guarantees as workout records" — true by construction rather than by
-- a policy someone has to remember to write:
--
--   · Account scoping   — the existing `workouts` RLS policies are row-level,
--                         so they already cover every column on the row.
--   · Deletion          — `user_id references auth.users on delete cascade` on
--                         the table takes the reflection with the account.
--   · Export            — `buildExportJson` reads the workout row.
--
-- It sits beside `raw_text`, never inside it. `raw_text` is what the parser
-- reads; a reflection is prose about the session that no parser should see.
--
-- Nullable with no default: no reflection is a first-class state, and every row
-- written before today genuinely has none.

alter table public.workouts
  add column if not exists reflection text;

comment on column public.workouts.reflection is
  'The athlete''s own optional note about how the session went (§8.1). Never parsed, never an input to a prescription, and never a health assessment.';
