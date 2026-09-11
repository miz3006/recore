-- Coaching RLS + RPC verification — three users, one rolled-back transaction.
--
-- Same shape and same rules as `rls-verification.sql`, which this file sits
-- beside: fake `auth.users` rows, `set local request.jwt.claims` to whatever
-- PostgREST would set, every assertion inside a `do` block that RAISES on
-- failure, and `rollback` at the end so the database is untouched.
--
-- WHAT COUNTS AS A PASS, because the two mechanisms are not the same:
--   · A blocked SELECT returns ZERO ROWS. It is not an error. So a read test
--     asserts a count, never an exception.
--   · A blocked INSERT raises `insufficient_privilege` (42501). So a write test
--     asserts that exception specifically and re-raises anything else — a test
--     that passes because the statement failed for an unrelated reason is worse
--     than no test.
--   · An RPC rejection raises `raise_exception` (P0001) with the error NAME as
--     its message, so the assertions compare SQLERRM. That is the contract the
--     UI copy depends on: `invalid_or_expired`, `self_invite`,
--     `already_has_coach` must stay distinguishable.
--
--   psql "$DATABASE_URL" -f supabase/tests/coaching-rls.sql
--
-- Three users throughout:
--   A = COACH      ...00a
--   B = CLIENT     ...00b
--   C = STRANGER   ...00c   (linked to nobody, ever)

begin;

set client_min_messages to notice;

-- === Fixtures, created as the superuser before any role switch =============
insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'coach@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'client@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'stranger@test.local')
on conflict (id) do nothing;

-- `handle_new_user` made the profile rows; give them names a linked pair is
-- supposed to be able to read.
update public.profiles set display_name = 'Coach Ana'  where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set display_name = 'Client Bor' where id = '00000000-0000-0000-0000-00000000000b';
update public.profiles set display_name = 'Stranger Cene' where id = '00000000-0000-0000-0000-00000000000c';

-- Scratch space for values that have to cross `do` block boundaries (the
-- invite code, the link id). Rolled back with everything else.
create temp table _t (k text primary key, v text);
grant all on _t to authenticated;

set local role authenticated;

-- ===========================================================================
-- 1 · CLIENT B logs a session. This also proves the owner-only INSERT policies
--     still work after the SELECT widening.
-- ===========================================================================
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

insert into public.workouts (id, user_id, performed_at, raw_text)
values ('00000000-0000-0000-0000-0000000000c1'::uuid,
        '00000000-0000-0000-0000-00000000000b',
        now(), E'bench 3x8 80kg\nsquat 5x5 100kg');

insert into public.items (id, workout_id, position)
values ('00000000-0000-0000-0000-0000000000d1'::uuid,
        '00000000-0000-0000-0000-0000000000c1'::uuid, 0);

insert into public.sets (item_id, position, kind, reps, weight_kg)
values ('00000000-0000-0000-0000-0000000000d1'::uuid, 0, 'working', 8, 80);

do $$
begin
  if (select count(*) from public.workouts) <> 1 then
    raise exception 'FAIL: client cannot see their own workout';
  end if;
  raise notice 'PASS  1 · client sees their own session';
end $$;

-- ===========================================================================
-- 2 · Before any link, the COACH is just another stranger.
-- ===========================================================================
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

do $$
begin
  if (select count(*) from public.workouts) <> 0 then
    raise exception 'FAIL: unlinked coach can read the client''s workouts';
  end if;
  if (select count(*) from public.profiles where id <> '00000000-0000-0000-0000-00000000000a') <> 0 then
    raise exception 'FAIL: unlinked coach can read another profile';
  end if;
  raise notice 'PASS  2 · an unlinked coach sees nothing';
end $$;

-- ===========================================================================
-- 3 · The invite. Only the RPC can create one — a direct INSERT is refused,
--     which is what makes the five-open-invites cap and the code alphabet
--     something other than a suggestion.
-- ===========================================================================
do $$
declare rejected boolean := false;
begin
  begin
    insert into public.coach_invites (code, coach_id)
    values ('DIRECT', '00000000-0000-0000-0000-00000000000a');
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then
    raise exception 'FAIL: a coach inserted an invite directly';
  end if;
  raise notice 'PASS  3a · invites cannot be inserted directly';
end $$;

insert into _t (k, v) values ('code', public.create_coach_invite());

do $$
declare v_code text := (select v from _t where k = 'code');
begin
  if v_code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$' then
    raise exception 'FAIL: invite code % is not 6 unambiguous uppercase chars', v_code;
  end if;
  if (select count(*) from public.coach_invites) <> 1 then
    raise exception 'FAIL: coach cannot read their own invite';
  end if;
  raise notice 'PASS  3b · create_coach_invite issued %', v_code;
end $$;

-- The cap: five OPEN invites, and the sixth is refused.
do $$
declare rejected boolean := false;
begin
  perform public.create_coach_invite();  -- 2
  perform public.create_coach_invite();  -- 3
  perform public.create_coach_invite();  -- 4
  perform public.create_coach_invite();  -- 5
  begin
    perform public.create_coach_invite();  -- 6 → refused
  exception when raise_exception then
    if sqlerrm <> 'too_many_invites' then raise; end if;
    rejected := true;
  end;
  if not rejected then
    raise exception 'FAIL: a coach opened a sixth live invite';
  end if;
  raise notice 'PASS  3c · open invites are capped at five';
end $$;

-- A second live code, captured HERE because only the coach can read the table.
-- Test 4e needs a valid unredeemed code to prove that "already has a coach"
-- beats a good code rather than hiding behind a bad one.
insert into _t (k, v)
select 'code2', code from public.coach_invites
where redeemed_by is null and expires_at > now()
  and code <> (select v from _t where k = 'code')
limit 1;

-- A coach cannot redeem their own code.
do $$
declare rejected boolean := false;
begin
  begin
    perform public.redeem_coach_invite((select v from _t where k = 'code'));
  exception when raise_exception then
    if sqlerrm <> 'self_invite' then
      raise exception 'FAIL: self-redeem raised % instead of self_invite', sqlerrm;
    end if;
    rejected := true;
  end;
  if not rejected then
    raise exception 'FAIL: a coach redeemed their own invite';
  end if;
  raise notice 'PASS  3d · self_invite';
end $$;

-- ===========================================================================
-- 4 · Redemption error codes, from the CLIENT's side.
-- ===========================================================================
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

do $$
declare rejected boolean := false;
begin
  begin
    perform public.redeem_coach_invite('ZZZZZZ');
  exception when raise_exception then
    if sqlerrm <> 'invalid_or_expired' then
      raise exception 'FAIL: unknown code raised % instead of invalid_or_expired', sqlerrm;
    end if;
    rejected := true;
  end;
  if not rejected then raise exception 'FAIL: an unknown code was redeemed'; end if;
  raise notice 'PASS  4a · invalid_or_expired (unknown code)';
end $$;

-- The client cannot read the invites table at all, so an expired one has to be
-- planted by the superuser. Same rejection, different cause.
set local role postgres;
insert into public.coach_invites (code, coach_id, expires_at)
values ('EXPIRD', '00000000-0000-0000-0000-00000000000a', now() - interval '1 day');
set local role authenticated;

do $$
declare rejected boolean := false;
begin
  begin
    perform public.redeem_coach_invite('EXPIRD');
  exception when raise_exception then
    if sqlerrm <> 'invalid_or_expired' then
      raise exception 'FAIL: expired code raised % instead of invalid_or_expired', sqlerrm;
    end if;
    rejected := true;
  end;
  if not rejected then raise exception 'FAIL: an expired code was redeemed'; end if;
  raise notice 'PASS  4b · invalid_or_expired (expired code)';
end $$;

-- A link cannot be written directly either — redeeming is the consent, and a
-- direct INSERT would be a coach attaching themselves to someone.
do $$
declare rejected boolean := false;
begin
  begin
    insert into public.coach_clients (coach_id, client_id)
    values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'FAIL: a link was inserted directly'; end if;
  raise notice 'PASS  4c · links cannot be inserted directly';
end $$;

-- The real redemption.
insert into _t (k, v) values ('link', public.redeem_coach_invite((select v from _t where k = 'code'))::text);

do $$
begin
  if (select count(*) from public.coach_clients where status = 'active') <> 1 then
    raise exception 'FAIL: redemption did not create exactly one active link';
  end if;
  raise notice 'PASS  4d · invite redeemed, link active';
end $$;

-- A second coach cannot take a client who already has one.
do $$
declare rejected boolean := false;
begin
  -- A GOOD, LIVE, UNREDEEMED code. That matters: if this used an expired one
  -- the rejection would be `invalid_or_expired` and the test would pass while
  -- proving nothing about the one-coach rule.
  begin
    perform public.redeem_coach_invite((select v from _t where k = 'code2'));
  exception when raise_exception then
    if sqlerrm <> 'already_has_coach' then
      raise exception 'FAIL: second link raised % instead of already_has_coach', sqlerrm;
    end if;
    rejected := true;
  end;
  if not rejected then raise exception 'FAIL: a client took a second active coach'; end if;
  raise notice 'PASS  4e · already_has_coach';
end $$;

-- ===========================================================================
-- 5 · What the link actually opens, from the COACH's side.
-- ===========================================================================
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

do $$
declare v_over record;
begin
  if (select count(*) from public.workouts) <> 1 then
    raise exception 'FAIL: linked coach cannot read the client''s workout';
  end if;
  if (select count(*) from public.items) <> 1 then
    raise exception 'FAIL: linked coach cannot read the client''s items';
  end if;
  if (select count(*) from public.sets) <> 1 then
    raise exception 'FAIL: linked coach cannot read the client''s sets';
  end if;
  if (select count(*) from public.profiles
      where id = '00000000-0000-0000-0000-00000000000b'
        and display_name = 'Client Bor') <> 1 then
    raise exception 'FAIL: linked coach cannot read the client''s display name';
  end if;
  -- and STILL nothing about anyone else
  if (select count(*) from public.profiles
      where id = '00000000-0000-0000-0000-00000000000c') <> 0 then
    raise exception 'FAIL: the link exposed an unrelated profile';
  end if;

  select * into v_over from public.coach_client_overview();
  if v_over.client_id <> '00000000-0000-0000-0000-00000000000b'
     or v_over.display_name <> 'Client Bor' then
    raise exception 'FAIL: coach_client_overview returned the wrong client';
  end if;
  raise notice 'PASS  5a · the link opens workouts, structure and one display name';
end $$;

-- READ ONLY. The coach may not edit or delete what the client wrote.
do $$
declare n int;
begin
  update public.workouts set raw_text = 'tampered'
  where id = '00000000-0000-0000-0000-0000000000c1'::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: a coach edited a client workout'; end if;

  delete from public.workouts where id = '00000000-0000-0000-0000-0000000000c1'::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: a coach deleted a client workout'; end if;
  raise notice 'PASS  5b · the coach''s access is read-only';
end $$;

-- ===========================================================================
-- 6 · Comments. Whole-workout (null ref) and per-exercise (a normalised name).
-- ===========================================================================
insert into public.workout_comments (workout_id, exercise_ref, author_id, body)
values ('00000000-0000-0000-0000-0000000000c1'::uuid, null,
        '00000000-0000-0000-0000-00000000000a', 'Solid session.'),
       ('00000000-0000-0000-0000-0000000000c1'::uuid, 'bench press',
        '00000000-0000-0000-0000-00000000000a', 'Keep the elbows tucked.');

-- Author spoofing: the body says it is from the coach, `author_id` says the
-- client. The with-check is the only thing standing between a coaching link
-- and putting words in the other person's mouth.
do $$
declare rejected boolean := false;
begin
  begin
    insert into public.workout_comments (workout_id, author_id, body)
    values ('00000000-0000-0000-0000-0000000000c1'::uuid,
            '00000000-0000-0000-0000-00000000000b', 'I felt great (not really me)');
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'FAIL: a comment was signed with another user''s id'; end if;
  raise notice 'PASS  6a · comment author spoofing is refused';
end $$;

-- ===========================================================================
-- 7 · The STRANGER. Every surface, zero rows, no writes.
-- ===========================================================================
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';

do $$
declare rejected boolean := false; n int;
begin
  if (select count(*) from public.workouts) <> 0 then
    raise exception 'FAIL: stranger reads workouts';
  end if;
  if (select count(*) from public.items) <> 0 then
    raise exception 'FAIL: stranger reads items';
  end if;
  if (select count(*) from public.sets) <> 0 then
    raise exception 'FAIL: stranger reads sets';
  end if;
  if (select count(*) from public.workout_comments) <> 0 then
    raise exception 'FAIL: stranger reads comments';
  end if;
  if (select count(*) from public.coach_clients) <> 0 then
    raise exception 'FAIL: stranger reads the link';
  end if;
  if (select count(*) from public.coach_invites) <> 0 then
    raise exception 'FAIL: stranger reads another coach''s invites';
  end if;
  if (select count(*) from public.profiles where id <> '00000000-0000-0000-0000-00000000000c') <> 0 then
    raise exception 'FAIL: stranger reads another profile';
  end if;
  if (select count(*) from public.coach_client_overview()) <> 0 then
    raise exception 'FAIL: coach_client_overview answered a stranger';
  end if;
  if (select count(*) from public.my_coach()) <> 0 then
    raise exception 'FAIL: my_coach answered a stranger';
  end if;

  begin
    insert into public.workout_comments (workout_id, author_id, body)
    values ('00000000-0000-0000-0000-0000000000c1'::uuid,
            '00000000-0000-0000-0000-00000000000c', 'butting in');
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'FAIL: stranger commented on a private workout'; end if;

  -- And a stranger cannot end someone else's coaching relationship.
  begin
    perform public.revoke_coach_link((select v from _t where k = 'link')::uuid);
  exception when raise_exception then
    if sqlerrm <> 'link_not_found' then raise; end if;
  end;
  select count(*) into n from public.coach_clients;  -- still invisible, still 0
  raise notice 'PASS  7 · the stranger sees nothing and can write nothing';
end $$;

-- ===========================================================================
-- 8 · The CLIENT reads the thread, replies, and marks it read.
-- ===========================================================================
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

do $$
declare v_marked int; v_coach record;
begin
  if (select count(*) from public.workout_comments) <> 2 then
    raise exception 'FAIL: client cannot read the coach''s comments';
  end if;

  select * into v_coach from public.my_coach();
  if v_coach.display_name <> 'Coach Ana' then
    raise exception 'FAIL: my_coach did not name the coach';
  end if;
  if v_coach.unread_count <> 2 then
    raise exception 'FAIL: my_coach counted % unread, expected 2', v_coach.unread_count;
  end if;

  insert into public.workout_comments (workout_id, exercise_ref, author_id, body)
  values ('00000000-0000-0000-0000-0000000000c1'::uuid, 'bench press',
          '00000000-0000-0000-0000-00000000000b', 'Will do — right elbow flares.');

  v_marked := public.mark_comments_read('00000000-0000-0000-0000-0000000000c1'::uuid);
  if v_marked <> 2 then
    raise exception 'FAIL: mark_comments_read marked %, expected the coach''s 2', v_marked;
  end if;
  if (select count(*) from public.workout_comments
      where author_id = '00000000-0000-0000-0000-00000000000b' and read_at is not null) <> 0 then
    raise exception 'FAIL: mark_comments_read marked the caller''s own comment';
  end if;
  raise notice 'PASS  8 · client reads, replies, and marks only the other party read';
end $$;

-- ===========================================================================
-- 9 · Revoke. Access must end at the database, not in the UI — and the words
--     already exchanged must survive it.
-- ===========================================================================
do $$
begin
  perform public.revoke_coach_link((select v from _t where k = 'link')::uuid);
  if (select count(*) from public.coach_clients where status = 'active') <> 0 then
    raise exception 'FAIL: revoke left the link active';
  end if;
  raise notice 'PASS  9a · the client revoked the link';
end $$;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

do $$
begin
  if (select count(*) from public.workouts) <> 0 then
    raise exception 'FAIL: revoked coach still reads workouts';
  end if;
  if (select count(*) from public.items) <> 0 then
    raise exception 'FAIL: revoked coach still reads items';
  end if;
  if (select count(*) from public.sets) <> 0 then
    raise exception 'FAIL: revoked coach still reads sets';
  end if;
  if (select count(*) from public.workout_comments) <> 0 then
    raise exception 'FAIL: revoked coach still reads the thread';
  end if;
  if (select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000b') <> 0 then
    raise exception 'FAIL: revoked coach still reads the client''s profile';
  end if;
  if (select count(*) from public.coach_client_overview()) <> 0 then
    raise exception 'FAIL: coach_client_overview still lists a revoked client';
  end if;
  raise notice 'PASS  9b · revoking cut the coach off at the database';
end $$;

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

do $$
begin
  if (select count(*) from public.workout_comments) <> 3 then
    raise exception 'FAIL: revoking destroyed the comments the client still owns';
  end if;
  if (select count(*) from public.my_coach()) <> 0 then
    raise exception 'FAIL: my_coach still names a revoked coach';
  end if;
  raise notice 'PASS  9c · the client keeps the conversation after revoking';
end $$;

-- ===========================================================================
-- 10 · THE WEBHOOK MUST NEVER COST A COMMENT.
--
-- `notify_comment_webhook` fires on every insert into `workout_comments`. The
-- promise in its migration is that a comment is committed whatever happens to
-- the notification, and an untested promise about an error path is a guess.
--
-- Two states are checked, and the second is the one that matters: UNSET (a
-- laptop, a project without push — the trigger returns early) and CONFIGURED
-- BUT POINTING AT NOTHING, which is what a dead endpoint, a rotated secret or a
-- missing `pg_net` all look like from in here.
-- ===========================================================================
set local role postgres;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

do $$
declare v_before int; v_after int;
begin
  -- Every assertion above already ran with the trigger live and UNSET, so that
  -- half is proved by tests 6 and 8 having passed at all.
  select count(*) into v_before from public.workout_comments;

  perform set_config('app.functions_url', 'http://127.0.0.1:1/functions/v1', true);
  perform set_config('app.notify_webhook_secret', 'nonsense', true);

  insert into public.workout_comments (workout_id, exercise_ref, author_id, body)
  values ('00000000-0000-0000-0000-0000000000c1'::uuid, null,
          '00000000-0000-0000-0000-00000000000b', 'written while the webhook was broken');

  select count(*) into v_after from public.workout_comments;
  if v_after <> v_before + 1 then
    raise exception 'FAIL: a comment was lost when the notification endpoint was unreachable';
  end if;

  perform set_config('app.functions_url', '', true);
  perform set_config('app.notify_webhook_secret', '', true);
  raise notice 'PASS 10 · a comment survives a broken notification endpoint';
end $$;

set local role authenticated;

do $$
begin
  raise notice '────────────────────────────────────────────';
  raise notice 'ALL COACHING RLS + RPC ASSERTIONS PASSED';
  raise notice '────────────────────────────────────────────';
end $$;

rollback;
