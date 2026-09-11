-- Fold the duplicate rows one training day already collected.
--
-- ---------------------------------------------------------------------------
-- WHAT WENT WRONG, MEASURED
-- ---------------------------------------------------------------------------
--
-- `workouts` is one row per person per local day — enforced in the client by
-- `saveRawText`, which looks the day up in SQLITE and updates what it finds.
-- A device that had not pulled yet found nothing, minted a random uuid, and
-- pushed a SECOND row for a day that already had one. Nothing rejected it.
--
-- On 10 September 2026 the development account carried six rows for 9
-- September and two each for five other days. The person's own app showed one
-- of them (`getWorkoutForDay` takes the first row it finds) and their coach's
-- feed listed every one — the same bench-press session, three times, which is
-- how the owner found this.
--
-- `src/lib/db/day-id.ts` stops new ones: a day's id is now derived from the
-- person and the date, so two devices write the same row. This file is the
-- other half — the days that already split.
--
-- ---------------------------------------------------------------------------
-- IT IS A FUNCTION AND IT IS NOT CALLED HERE
-- ---------------------------------------------------------------------------
--
-- No bulk `update` over everyone's training runs in this migration. The
-- function below repairs the CALLER'S OWN rows and nobody else's, and the app
-- calls it once per account after a sync. Two reasons, and the second is the
-- real one:
--
--  1. It can be tested against a throwaway account on the same database before
--     any real record is touched, which a bulk statement cannot.
--  2. Rewriting somebody's training in a migration they never asked for is
--     precisely the thing CLAUDE.md §3 is about. Raw text is the source of
--     truth; a repair to it happens in the person's own session, on their own
--     rows, and is `security definer` only because repointing comments needs
--     rights the client does not have.
--
-- ---------------------------------------------------------------------------
-- WHAT IT PRESERVES, AND WHAT IT CANNOT
-- ---------------------------------------------------------------------------
--
-- Nothing is paraphrased and nothing is dropped:
--
--  · raw_text — the oldest row's text stays exactly as written, at the top.
--    Each duplicate's text is APPENDED verbatim, in the order it was created,
--    and is skipped when the survivor already contains it. That last rule is
--    what keeps the reported case honest: three rows reading "benchpress
--    120kgx12x3" are one session the sync split, not three the person did, and
--    printing it back three times would be the repair inventing training.
--  · items and sets — REPOINTED onto the survivor rather than deleted with
--    their row, positions shifted to sit after the ones already there. So the
--    merged day keeps its whole parsed structure and needs no re-parse; a
--    coach's set table is complete the moment this runs.
--  · comments — repointed too, so nothing a coach wrote is orphaned by the
--    cascade. This is the one step a client could never do for itself: there is
--    no UPDATE policy on `workout_comments` and there must not be.
--  · reflection, entry_notes, session_effort — the survivor's win; a
--    duplicate's are taken only where the survivor has none.
--
-- What it deliberately does NOT do is merge across different `performed_at`
-- values. Every duplicate seen in the wild shares one to the second, because
-- they come from one device's idea of local noon. Two rows a timezone apart are
-- left alone: under-merging leaves a duplicate the coach's day grouping already
-- handles, over-merging would fuse two days that might really be two.

create or replace function public.merge_duplicate_workout_days()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group    record;
  v_dupe     record;
  v_survivor uuid;
  v_offset   int;
  v_merged   int := 0;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  for v_group in
    select performed_at
    from public.workouts
    where user_id = auth.uid()
    group by performed_at
    having count(*) > 1
  loop
    -- The oldest row is the one the day started as, and the one the person's
    -- own app has been showing them. It survives.
    select id into v_survivor
    from public.workouts
    where user_id = auth.uid() and performed_at = v_group.performed_at
    order by created_at asc, id asc
    limit 1;

    for v_dupe in
      select id, raw_text, reflection, entry_notes, session_effort
      from public.workouts
      where user_id = auth.uid()
        and performed_at = v_group.performed_at
        and id <> v_survivor
      order by created_at asc, id asc
    loop
      select coalesce(max(position), -1) + 1 into v_offset
      from public.items where workout_id = v_survivor;

      update public.items
      set workout_id = v_survivor, position = position + v_offset
      where workout_id = v_dupe.id;

      update public.workout_comments
      set workout_id = v_survivor
      where workout_id = v_dupe.id;

      update public.workouts s
      set
        raw_text = case
          when coalesce(btrim(v_dupe.raw_text), '') = '' then s.raw_text
          -- Already in there: the duplicate is the split, not a second effort.
          when position(btrim(v_dupe.raw_text) in s.raw_text) > 0 then s.raw_text
          when coalesce(btrim(s.raw_text), '') = '' then v_dupe.raw_text
          else rtrim(s.raw_text, E' \n') || E'\n' || btrim(v_dupe.raw_text)
        end,
        reflection = case
          when coalesce(btrim(s.reflection), '') <> '' then s.reflection
          else v_dupe.reflection
        end,
        entry_notes = case
          when coalesce(btrim(s.entry_notes), '') not in ('', '{}') then s.entry_notes
          else v_dupe.entry_notes
        end,
        session_effort = coalesce(s.session_effort, v_dupe.session_effort),
        updated_at = now()
      where s.id = v_survivor;

      delete from public.workouts where id = v_dupe.id;
      v_merged := v_merged + 1;
    end loop;
  end loop;

  return v_merged;
end;
$$;

revoke execute on function public.merge_duplicate_workout_days() from public, anon;
grant  execute on function public.merge_duplicate_workout_days() to authenticated;
