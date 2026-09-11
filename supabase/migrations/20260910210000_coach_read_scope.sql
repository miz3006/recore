-- Security remediation, 10 September 2026 — S18 and S19.
-- See docs/security-remediation-2026-09.md.
--
-- Two halves of the same mistake, found by reading `20260910140000_coaching.sql`
-- against what RLS actually does. That migration widened SELECT on four tables
-- so a coach could read a client's sessions. RLS is ROW-level: widening a
-- select hands over the WHOLE ROW, and it hands over nothing that lives on a
-- row nobody widened. One of those cut too deep and the other did not cut at
-- all.

-- ---------------------------------------------------------------------------
-- S18 · `profiles_select` gave a linked account the client's EMAIL ADDRESS.
--
-- The policy it replaced reads:
--
--   create policy profiles_select on public.profiles
--     for select using (id = auth.uid() or public.is_linked_with(id));
--
-- and the comment above it says the display name is "the ONLY thing the link
-- exposes about a person besides their training". That is not what the policy
-- does. `public.profiles` also holds `email` — and, once
-- 20260910130000 is applied, `entitled_until` — so either end of a coaching
-- link could run
--
--   select email from profiles where id = '<the other person>'
--
-- and read it. Someone who signed in with Apple and chose Hide My Email had
-- picked, deliberately, not to hand their address to anybody; the relay address
-- leaks all the same, and it is a working inbox.
--
-- THE FIX IS TO PUT THE POLICY BACK AND LET THE RPCs DO THEIR JOB. Nothing in
-- the app ever read another person's profile row directly — `grep "from('profiles')"`
-- over `src/` finds an upsert of your own row, an update of your own display
-- name, and nothing else. The linked display name already arrives through
-- `coach_client_overview()` and `my_coach()`, both `security definer`, both
-- returning `display_name` and no other column. That is a column-level answer
-- to a column-level question, which is what this needed all along.
--
-- `is_linked_with` is kept: it is correct, it is cheap, and the next policy
-- that needs "are these two people linked" should not write it again.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid());

-- ---------------------------------------------------------------------------
-- S19 · the coach could read every set of a session and not one exercise NAME.
--
-- `exercises` was the table the coaching migration did not widen, and its
-- policy is unchanged from the initial migration: your own rows, or a global
-- default. A movement the client's own catalogue owns — which is every movement
-- the built-in list did not already have, so most of a real athlete's — is a
-- row with `user_id = <the client>`, and the coach may not select it.
--
-- The failure is silent and it looks like a parser bug rather than a policy
-- one: `lib/coaching/read-workout.ts` resolves a name through that table and
-- falls back to the string "Unread line". So the coach's screen prints the
-- sets, the reps and the kilograms correctly, under a column of rows that all
-- say Unread line. The feature reads as broken by anyone who tries it.
--
-- WHY WIDENING THIS IS NOT A NEW DISCLOSURE. The coach can already read
-- `raw_text` — the words the athlete typed, which name the movement outright —
-- plus every item and set of the session. The exercise's canonical name and
-- the shorthands learned for it are the same fact in tidier form. This adds no
-- category of information to what the link already granted; it lets the screen
-- say "Bench Press" instead of "Unread line".
--
-- Still SELECT only, and still an ACTIVE link only. Insert, update and delete
-- keep the owner-only policies from the initial migration, so a coach cannot
-- rename, merge or delete anything in a client's catalogue.
-- ---------------------------------------------------------------------------
drop policy if exists exercises_select on public.exercises;
create policy exercises_select on public.exercises
  for select using (
    user_id = auth.uid()
    or user_id is null
    or public.is_active_coach_of(user_id)
  );
