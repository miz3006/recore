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

rollback;
