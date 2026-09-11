-- RLS verification: proves a second user CANNOT read the first user's rows.
-- Run in the Supabase SQL editor (or psql as a superuser) AFTER the initial
-- migration. It simulates two authenticated users by setting the JWT claims
-- PostgREST would set, inside one rolled-back transaction — no data is left
-- behind.

begin;

-- Two fake auth users (bypassing GoTrue just for this test).
insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'user-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'user-b@test.local')
on conflict (id) do nothing;

-- === Act as USER A: create a workout with an item and a set ================
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

insert into public.workouts (id, user_id, performed_at, raw_text)
values ('00000000-0000-0000-0000-0000000000c1'::uuid,
        '00000000-0000-0000-0000-00000000000a',
        now(), 'bench 3x8 80kg');

insert into public.items (id, workout_id, position)
values ('00000000-0000-0000-0000-0000000000d1'::uuid,
        '00000000-0000-0000-0000-0000000000c1'::uuid, 0);

insert into public.sets (item_id, position, kind, reps, weight_kg)
values ('00000000-0000-0000-0000-0000000000d1'::uuid, 0, 'working', 8, 80);

insert into public.predictions (user_id, for_date, ghost_text)
values ('00000000-0000-0000-0000-00000000000a', current_date, 'bench 4x6 82.5kg');

insert into public.exercises (id, user_id, canonical)
values ('00000000-0000-0000-0000-0000000000e1'::uuid,
        '00000000-0000-0000-0000-00000000000a', 'Test Press');

insert into public.corrections (user_id, workout_id, line_text, after_json)
values ('00000000-0000-0000-0000-00000000000a',
        '00000000-0000-0000-0000-0000000000c1'::uuid,
        'bench 3x8 80kg', '{"exercise":"Test Press"}'::jsonb);

insert into public.alias_overrides (user_id, alias, exercise_id)
values ('00000000-0000-0000-0000-00000000000a', 'tp',
        '00000000-0000-0000-0000-0000000000e1'::uuid);

-- Sanity: user A sees their own rows.
do $$
begin
  if (select count(*) from public.workouts) <> 1 then
    raise exception 'FAIL: user A should see exactly their own workout';
  end if;
end $$;

-- === Act as USER B: every table must come back EMPTY ========================
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

do $$
begin
  if (select count(*) from public.workouts) <> 0 then
    raise exception 'FAIL: user B can read user A''s workouts';
  end if;
  if (select count(*) from public.items) <> 0 then
    raise exception 'FAIL: user B can read user A''s items';
  end if;
  if (select count(*) from public.sets) <> 0 then
    raise exception 'FAIL: user B can read user A''s sets';
  end if;
  if (select count(*) from public.predictions) <> 0 then
    raise exception 'FAIL: user B can read user A''s predictions';
  end if;
  if (select count(*) from public.profiles where id <> '00000000-0000-0000-0000-00000000000b') <> 0 then
    raise exception 'FAIL: user B can read another user''s profile';
  end if;
  -- Global exercises (user_id null) SHOULD be visible; user-owned ones not.
  if (select count(*) from public.exercises where user_id is not null) <> 0 then
    raise exception 'FAIL: user B can read another user''s exercises';
  end if;
  if (select count(*) from public.corrections) <> 0 then
    raise exception 'FAIL: user B can read user A''s corrections';
  end if;
  if (select count(*) from public.alias_overrides) <> 0 then
    raise exception 'FAIL: user B can read user A''s alias overrides';
  end if;
  -- Rate-limit table must be completely invisible to clients (RLS, no
  -- policies → zero rows, not an error).
  if (select count(*) from public.parse_rate_limits) <> 0 then
    raise exception 'FAIL: parse_rate_limits readable by a client';
  end if;
  raise notice 'PASS: cross-user isolation verified on every table';
end $$;

-- User B must not be able to write into A's workout either. Only an RLS
-- rejection (42501 insufficient_privilege) counts as a pass; anything else
-- re-raises.
do $$
declare
  rejected boolean := false;
begin
  begin
    insert into public.items (workout_id, position)
    values ('00000000-0000-0000-0000-0000000000c1'::uuid, 99);
  exception
    when insufficient_privilege then
      rejected := true;
  end;

  if rejected then
    raise notice 'PASS: user B cannot write into user A''s workout';
  else
    raise exception 'FAIL: user B inserted an item into user A''s workout';
  end if;
end $$;

-- === S8: a cross-user exercise_id must be refused =========================
-- alias_overrides_cross_user
--
-- Still acting as USER B. B owns no exercise, so B points a shorthand at the
-- exercise A created above ('...e1'). Before the 20260910120000 migration the
-- with-check only constrained user_id and this insert SUCCEEDED — after which
-- parse-workout's service-role join would have carried A's exercise name into
-- B's prompt. Only an RLS rejection counts as a pass.
do $$
declare
  rejected boolean := false;
begin
  begin
    insert into public.alias_overrides (user_id, alias, exercise_id)
    values ('00000000-0000-0000-0000-00000000000b', 'stolen',
            '00000000-0000-0000-0000-0000000000e1'::uuid);
  exception
    when insufficient_privilege then
      rejected := true;
  end;

  if rejected then
    raise notice 'PASS: user B cannot point a shorthand at user A''s exercise';
  else
    raise exception 'FAIL: alias_overrides accepted another user''s exercise_id';
  end if;
end $$;

-- The same policy must still ALLOW the legitimate cases, or it has traded a
-- hole for a broken feature. B maps a shorthand onto a global exercise
-- (user_id is null, seeded by the init migration) and onto B's own row.
do $$
declare
  global_id uuid;
begin
  insert into public.exercises (id, user_id, canonical)
  values ('00000000-0000-0000-0000-0000000000e2'::uuid,
          '00000000-0000-0000-0000-00000000000b', 'B Own Press');

  insert into public.alias_overrides (user_id, alias, exercise_id)
  values ('00000000-0000-0000-0000-00000000000b', 'bop',
          '00000000-0000-0000-0000-0000000000e2'::uuid);

  select id into global_id from public.exercises where user_id is null limit 1;
  if global_id is null then
    raise exception 'FAIL: no global exercise seeded — cannot test the global case';
  end if;

  insert into public.alias_overrides (user_id, alias, exercise_id)
  values ('00000000-0000-0000-0000-00000000000b', 'glob', global_id);

  raise notice 'PASS: own and global exercise_ids are still accepted';
end $$;

-- === S13: a user can delete their own corrections ==========================
-- Act as A again: the row A inserted at the top must be removable by its
-- author, which it was not before the corrections_delete policy existed.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

do $$
begin
  delete from public.corrections
  where user_id = '00000000-0000-0000-0000-00000000000a';

  if (select count(*) from public.corrections) <> 0 then
    raise exception 'FAIL: user A cannot delete their own corrections';
  end if;
  raise notice 'PASS: a user can delete their own corrections';
end $$;

-- === S18 / S19: what a COACHING LINK does and does not widen ===============
--
-- Both halves of the same mistake, and the test has to prove BOTH directions:
-- the link must reach the client's exercise catalogue (S19) and must NOT reach
-- their profile row (S18). A test that only checked one would have passed
-- against the broken policy set on 10 September, because the policies were
-- wrong in opposite directions.
--
-- B becomes A's coach through the real path — the RPC, not an inserted row,
-- because `coach_clients` has no insert policy on purpose.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

do $$
declare
  v_code   text;
  v_email  text;
  v_names  int;
  v_visible int;
begin
  -- Skip cleanly if the coaching migrations are not applied to this database,
  -- rather than failing for the wrong reason.
  if to_regclass('public.coach_invites') is null then
    raise notice 'SKIP: coaching migrations not applied — S18/S19 not tested';
    return;
  end if;

  -- Profiles must exist for both, or `profiles_select` has nothing to test.
  insert into public.profiles (id, display_name, email)
  values ('00000000-0000-0000-0000-00000000000a', 'Athlete A', 'user-a@test.local')
  on conflict (id) do nothing;

  -- A is the coach here: A issues, B redeems, so B is A's client. Then the
  -- direction under test is A reading B — which is the direction the feature
  -- actually uses.
  if to_regclass('public.coach_profiles') is not null then
    perform public.set_coach_role(true);
  end if;
  v_code := public.create_coach_invite();

  set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
  insert into public.profiles (id, display_name, email)
  values ('00000000-0000-0000-0000-00000000000b', 'Athlete B', 'user-b@test.local')
  on conflict (id) do nothing;
  perform public.redeem_coach_invite(v_code);

  -- Back to A, who is now B's active coach.
  set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

  -- S18: the link must NOT hand over the profile row.
  select email into v_email from public.profiles
  where id = '00000000-0000-0000-0000-00000000000b';
  if v_email is not null then
    raise exception 'FAIL: a coach can read the client''s email address (S18)';
  end if;
  raise notice 'PASS: a coaching link does not expose the client profile row';

  -- S19: the link MUST reach the client's own catalogue, or every movement
  -- renders as "Unread line" on the coach's screen.
  select count(*) into v_names from public.exercises
  where id = '00000000-0000-0000-0000-0000000000e2'::uuid;
  if v_names <> 1 then
    raise exception 'FAIL: a coach cannot read the client''s exercise names (S19)';
  end if;
  raise notice 'PASS: a coach can read the client''s exercise names';

  -- And the widening stops at SELECT: the record itself stays the client's.
  begin
    update public.exercises set canonical = 'Renamed By Coach'
    where id = '00000000-0000-0000-0000-0000000000e2'::uuid;
    get diagnostics v_visible = row_count;
    if v_visible <> 0 then
      raise exception 'FAIL: a coach can WRITE to a client''s catalogue';
    end if;
  exception when insufficient_privilege then
    null; -- refused outright is also correct
  end;
  raise notice 'PASS: a coach cannot write to a client''s catalogue';
end $$;

-- === S17: guessing an invite code is bounded ===============================
do $$
declare
  v_answer jsonb;
  v_last   text;
  i        int;
begin
  if to_regclass('public.redeem_attempts') is null then
    raise notice 'SKIP: redeem rate-limit migration not applied — S17 not tested';
    return;
  end if;

  -- A fresh account, so the window starts empty. Guess wrong repeatedly: the
  -- first ten are refused as bad codes, the eleventh as too many attempts.
  insert into auth.users (id, email)
  values ('00000000-0000-0000-0000-00000000000c', 'user-c@test.local')
  on conflict (id) do nothing;
  set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';

  for i in 1..11 loop
    v_answer := public.redeem_coach_invite('ZZZZZ' || i::text);
    v_last := v_answer->>'error';
  end loop;

  if v_last <> 'too_many_attempts' then
    raise exception 'FAIL: an eleventh guess was still answered % (S17)', v_last;
  end if;
  raise notice 'PASS: invite guessing is rate limited';
end $$;

rollback;
