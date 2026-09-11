-- Security remediation, 10 September 2026 — S8 and S13.
-- See docs/security-remediation-2026-09.md for the findings behind both.
--
-- ADDITIVE ON PURPOSE. 20260716130000_correction_loop.sql is deployed, and a
-- deployed migration is never rewritten (CLAUDE.md §5) — a database that has
-- already run it would never see the edit.

-- ---------------------------------------------------------------------------
-- S8 · alias_overrides.exercise_id must point at a row the caller may see.
--
-- The original with-check constrained user_id and said NOTHING about
-- exercise_id, so user A could insert a shorthand pointing at user B's
-- exercise. parse-workout then joins exercises(canonical) with the
-- SERVICE-ROLE key — bypassing RLS — so B's exercise name would land in A's
-- prompt and in A's answer. Guessing a UUIDv4 makes that impractical to
-- exploit; the constraint was missing all the same, and the join that would
-- expose it runs with RLS off.
--
-- The permitted set mirrors exercises_select: your own rows, or a global
-- default (user_id is null), which is exactly what a shorthand legitimately
-- re-points at. Update carries the same clause — otherwise the check could be
-- satisfied on insert and then walked to another user's row afterwards.
-- ---------------------------------------------------------------------------
drop policy if exists alias_overrides_insert on public.alias_overrides;
create policy alias_overrides_insert on public.alias_overrides
  for insert with check (
    alias_overrides.user_id = auth.uid()
    and exists (
      select 1 from public.exercises e
      where e.id = alias_overrides.exercise_id
        and (e.user_id = auth.uid() or e.user_id is null)
    )
  );

drop policy if exists alias_overrides_update on public.alias_overrides;
create policy alias_overrides_update on public.alias_overrides
  for update
  using (alias_overrides.user_id = auth.uid())
  with check (
    alias_overrides.user_id = auth.uid()
    and exists (
      select 1 from public.exercises e
      where e.id = alias_overrides.exercise_id
        and (e.user_id = auth.uid() or e.user_id is null)
    )
  );

-- ---------------------------------------------------------------------------
-- S13 · corrections had select and insert and no delete.
--
-- Account deletion already takes these rows by cascade, so the erasure promise
-- in the privacy policy was kept. What was not true is the smaller promise the
-- product makes everywhere else: that a person owns what they wrote. Without
-- this policy the only way to remove one correction was to delete the whole
-- account, which describes the table as append-only training data rather than
-- as something its author owns.
-- ---------------------------------------------------------------------------
create policy corrections_delete on public.corrections
  for delete using (user_id = auth.uid());
