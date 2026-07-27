-- Recore — 12 weeks of demo training data.
--
-- Paste into the Supabase SQL editor and run. It seeds the account named in
-- SEED_EMAIL below with a push/pull/legs block so Progress, Lifts and the Coach
-- have something real to project from.
--
-- WHY THE DATA LOOKS LIKE THIS
--   · Loads climb, DELOAD in week 8, then climb again. A monotonic ramp makes
--     every chart look correct even when it is not — the bugs live in the
--     direction changes.
--   · One week is deliberately mostly missed, so §11.1's deterministic insight
--     rules have something to fire on, including the unwelcome one. Seed data
--     that never triggers a rule cannot tell you the rule works.
--   · `raw_text` is written, not just structure. §18.1: raw_text is the source
--     of truth and structure is a projection — seed rows without it are a shape
--     the real app can never produce.
--
-- SAFE TO RE-RUN. It deletes only what it wrote (raw_text tagged with the
-- marker below) and never touches sessions you logged yourself.
--
-- RLS: this runs as the service role in the SQL editor, so it bypasses RLS by
-- design. It never grants the app any access it did not already have.

do $$
declare
  -- ── set this to the account you sign in with ────────────────────────────
  seed_email  text := 'dev@recore.local';
  -- ───────────────────────────────────────────────────────────────────────
  marker      text := E'\n-- recore:demo';
  uid         uuid;
  wk          int;
  d           int;
  day_index   int;
  performed   timestamptz;
  workout     uuid;
  item        uuid;
  ex_id       uuid;
  lift        record;
  set_pos     int;
  load        numeric(6,2);
  progressed  int;
  raw         text;
  n_sessions  int := 0;
  n_sets      int := 0;
begin
  select id into uid from auth.users where email = seed_email;
  if uid is null then
    raise exception 'No auth user with email %. Sign in once in the app first, or change seed_email.', seed_email;
  end if;

  -- Remove a previous run of THIS seed only.
  delete from public.workouts where user_id = uid and raw_text like '%' || marker;
  delete from public.exercises where user_id = uid and canonical in
    ('Bench Press','Overhead Press','Barbell Row','Pull Up','Squat','Romanian Deadlift');

  -- Exercises. increment_kg follows §10.2: 2.5 upper, 5 lower.
  insert into public.exercises (user_id, canonical, aliases, modality, increment_kg) values
    (uid, 'Bench Press',       '{bench,bp}',        'strength', 2.5),
    (uid, 'Overhead Press',    '{ohp,press}',       'strength', 2.5),
    (uid, 'Barbell Row',       '{row,bb row}',      'strength', 2.5),
    (uid, 'Pull Up',           '{pullup,pull ups}', 'strength', 2.5),
    (uid, 'Squat',             '{squat,squats}',    'strength', 5.0),
    (uid, 'Romanian Deadlift', '{rdl}',             'strength', 5.0);

  -- 12 weeks, oldest first. Mon / Wed / Fri.
  for wk in reverse 11..0 loop
    for d in 0..2 loop
      -- Week 4 counted back: only one session. Gives the "sessions flat" and
      -- "no sessions" rules a real event rather than a synthetic flat line.
      continue when wk = 4 and d > 0;

      day_index := n_sessions % 3;
      -- date + time -> timestamp, then cast. `timestamptz + time` is not valid.
      performed := ((current_date - ((wk * 7) + (4 - d * 2))) + time '18:00')::timestamptz;
      progressed := greatest(0, case when (11 - wk) >= 8 then (11 - wk) - 3 else (11 - wk) end);

      -- Build raw_text from the same lifts the structure will carry.
      raw := '';
      for lift in
        select * from (values
          (0, 'Bench Press',       70.0, 2.5, 3, 8),
          (0, 'Overhead Press',    40.0, 2.5, 3, 8),
          (1, 'Barbell Row',       60.0, 2.5, 3, 8),
          (1, 'Pull Up',            0.0, 2.5, 3, 7),
          (2, 'Squat',             90.0, 5.0, 3, 5),
          (2, 'Romanian Deadlift', 80.0, 5.0, 3, 8)
        ) as t(slot, name, start_kg, step_kg, n_sets, reps)
        where t.slot = day_index
      loop
        load := lift.start_kg + lift.step_kg * progressed;
        raw := raw || lower(lift.name) || ' ' || lift.n_sets || 'x' || lift.reps || ' ' || load || E'\n';
      end loop;

      insert into public.workouts (user_id, performed_at, raw_text, parse_version)
      values (uid, performed, rtrim(raw, E'\n') || marker, 1)
      returning id into workout;

      set_pos := 0;
      for lift in
        select * from (values
          (0, 'Bench Press',       70.0, 2.5, 3, 8),
          (0, 'Overhead Press',    40.0, 2.5, 3, 8),
          (1, 'Barbell Row',       60.0, 2.5, 3, 8),
          (1, 'Pull Up',            0.0, 2.5, 3, 7),
          (2, 'Squat',             90.0, 5.0, 3, 5),
          (2, 'Romanian Deadlift', 80.0, 5.0, 3, 8)
        ) as t(slot, name, start_kg, step_kg, n_sets, reps)
        where t.slot = day_index
      loop
        select id into ex_id from public.exercises
          where user_id = uid and canonical = lift.name limit 1;

        insert into public.items (workout_id, position, exercise_id)
        values (workout, set_pos, ex_id)
        returning id into item;

        load := lift.start_kg + lift.step_kg * progressed;

        -- The last set drops a rep on the pressing lifts — real sets are uneven,
        -- and §8.3's "8 · 8 · 7" collapse only gets exercised if they are.
        insert into public.sets (item_id, position, kind, reps, weight_kg)
        select item, s,
               'working',
               case when s = lift.n_sets - 1 and lift.name in ('Bench Press','Pull Up')
                    then lift.reps - 1 else lift.reps end,
               load
        from generate_series(0, lift.n_sets - 1) as s;

        n_sets := n_sets + lift.n_sets;
        set_pos := set_pos + 1;
      end loop;

      n_sessions := n_sessions + 1;
    end loop;
  end loop;

  raise notice 'Seeded % sessions and % sets for % over 12 weeks.', n_sessions, n_sets, seed_email;
end $$;
