-- The session's own rating (owner, 10 September 2026) — one number for how
-- hard the WHOLE session was, the third sibling of the session reflection
-- (20260729000000_reflections.sql) and the per-entry notes
-- (20260804000000_entry_notes.sql).
--
-- A COLUMN ON `workouts`, for the third time and for the third time for the
-- same reason: one value per finished session, so riding the workout row makes
-- §12's promise — "the same account scoping, export, and deletion guarantees as
-- workout records" — true by construction rather than by a policy someone has
-- to remember to write:
--
--   · Account scoping   — the existing `workouts` RLS policies are row-level,
--                         so they already cover every column on the row.
--   · Deletion          — `user_id references auth.users on delete cascade` on
--                         the table takes the rating with the account.
--   · Export            — `buildExportJson` reads the workout row.
--
-- WHAT IT IS. The session-RPE method (Foster): one rating of the whole session
-- on the modified CR-10 scale, which multiplied by the session's duration gives
-- internal training load in arbitrary units. The client offers three points on
-- that scale (3 / 5 / 8 — `src/lib/session-effort.ts`) because a single-item
-- question is the one that actually gets answered at the end of a workout.
--
-- WHAT IT IS NOT. Not `sets.rir`, which is one set's distance from failure and
-- is the prescription engine's input; this is what the session cost and is the
-- input to no prescription at all. Not a health assessment, not a score, not a
-- grade — it is counted and quoted back, never judged (§8.1, §12).
--
-- `real`, not `integer`: Foster's scale has halves and a later build may offer
-- them, and a scale change should not be a migration.
--
-- Nullable with no default, and this one matters: not answering is a
-- first-class outcome. An unrated session has NO load — the client's
-- `sessionLoad` returns null rather than a zero, and a weekly total reports how
-- many sessions it had to leave out. A default of any kind would invent a
-- rating for every session ever logged.

alter table public.workouts
  add column if not exists session_effort real;

comment on column public.workouts.session_effort is
  'The athlete''s own rating of how hard this whole session was, on Foster''s modified CR-10 scale (session-RPE). Null when they did not answer. Never an input to a prescription, never a health assessment, never a score.';
