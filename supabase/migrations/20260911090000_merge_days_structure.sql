-- A folded duplicate's READING goes with its words.
--
-- ---------------------------------------------------------------------------
-- WHAT THE FIRST VERSION GOT WRONG
-- ---------------------------------------------------------------------------
--
-- `merge_duplicate_workout_days()` (migration 20260910191000) folds the rows a
-- day split into. It applies two rules that contradict each other:
--
--   · a duplicate's `raw_text` is SKIPPED when the survivor already contains
--     it — "three rows reading benchpress 120kgx12x3 are one session the sync
--     split, not three the person did";
--   · a duplicate's `items`/`sets` are REPOINTED onto the survivor, always.
--
-- So the words of the split were dropped and its reading was kept. Found in
-- the owner's screenshot, 11 September 2026: a day whose text reads
-- "benchpress 120kgx12x3" twice was drawn as THREE bench-press entries under
-- the header "1 lift · 9 sets · 12,960 kg" — a third of that session is in the
-- reading and in every total behind it, and nothing in the record says it
-- happened. CLAUDE.md §3: raw text is the source of truth and `items`/`sets`
-- are a projection of it, so a projection nothing wrote must not survive.
--
-- ---------------------------------------------------------------------------
-- THE RULE THIS SETS
-- ---------------------------------------------------------------------------
--
-- Text and structure travel together. When a duplicate's words are appended,
-- its items are repointed exactly as before. When its words are skipped as
-- already-present, its items are left on the row and go with it when the row
-- is deleted (`items.workout_id` cascades, and `sets.item_id` behind it).
--
-- ONE EXCEPTION, and it is the reason this is not a two-line change: if the
-- survivor has no structure at all, the duplicate's reading is the only
-- reading those words have ever had. Repoint it. Dropping it would blank a
-- parsed day and leave the person waiting on a re-parse they may be offline
-- for.
--
-- Comments are repointed in every case, as before. Nothing a coach wrote may
-- be orphaned by this, whatever happens to the sets it hangs beside.
--
-- ---------------------------------------------------------------------------
-- WHAT IT CANNOT REPAIR
-- ---------------------------------------------------------------------------
--
-- Days the FIRST version already merged. Their duplicate rows are gone and the
-- extra items now belong to the survivor, indistinguishable from a reading it
-- was always entitled to. Rebuilding those is a re-parse of the survivor's
-- text, which is what You → "Clear local cache" does on the owner's own
-- device: the cache no longer matches the merged text, the parser reads it
-- again, `applyParseResult` replaces `items`/`sets` wholesale and the next
-- push replaces the remote copy. That is a person's own repair on a person's
-- own record, which is where CLAUDE.md §3 says it belongs — not a bulk
-- rewrite of everybody's training in a migration they never asked for.

create or replace function public.merge_duplicate_workout_days()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group     record;
  v_dupe      record;
  v_survivor  uuid;
  v_text      text;
  v_offset    int;
  v_has_items boolean;
  v_kept      boolean;
  v_merged    int := 0;
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
      select raw_text into v_text from public.workouts where id = v_survivor;
      select exists (select 1 from public.items where workout_id = v_survivor)
        into v_has_items;

      -- Judged BEFORE the text is joined: afterwards every duplicate's words
      -- are "already there" by construction.
      v_kept := not (
        coalesce(btrim(v_dupe.raw_text), '') <> ''
        and position(btrim(v_dupe.raw_text) in coalesce(v_text, '')) > 0
        and v_has_items
      );

      if v_kept then
        select coalesce(max(position), -1) + 1 into v_offset
        from public.items where workout_id = v_survivor;

        update public.items
        set workout_id = v_survivor, position = position + v_offset
        where workout_id = v_dupe.id;
      end if;

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

      -- Anything still on the duplicate goes with it: `items.workout_id`
      -- cascades, and `sets.item_id` cascades behind that.
      delete from public.workouts where id = v_dupe.id;
      v_merged := v_merged + 1;
    end loop;
  end loop;

  return v_merged;
end;
$$;

revoke execute on function public.merge_duplicate_workout_days() from public, anon;
grant  execute on function public.merge_duplicate_workout_days() to authenticated;
