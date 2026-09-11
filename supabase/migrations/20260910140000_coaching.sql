-- Coach ↔ client layer (docs/spec/recore-coach-feature-prompt.md, Phase 1).
--
-- A coach links to a client, reads that client's logged sessions, and comments
-- on a whole workout or on one exercise inside it. The client owns the data and
-- can cut the link at any moment, from either side.
--
-- ---------------------------------------------------------------------------
-- FOUR DECISIONS THAT DEPART FROM THE SPEC, AND WHY
-- ---------------------------------------------------------------------------
--
-- 1. `profiles` IS NOT CREATED HERE. It has existed since the initial
--    migration with `display_name`, `email` and `units`, and `handle_new_user`
--    already fills it on sign-up. Creating it again would fail; what this file
--    does instead is widen its SELECT policy so a linked pair can read each
--    other's display name and nothing else.
--
-- 2. `workout_comments.exercise_ref` IS A NORMALISED EXERCISE NAME, NOT A UUID.
--    The spec suggests a stable per-exercise id. This schema does not have one:
--    `applyParseResult` (src/lib/parse/apply.ts) DELETES every `items` row of a
--    workout and re-inserts it with fresh UUIDs on every re-parse, and
--    `pushStructure` repeats that remotely. A comment anchored to `items.id`
--    would be orphaned by the first correction the client makes to that line.
--
--    The repository already solved this exact problem for the athlete's own
--    per-entry notes: `entryNoteKey()` (src/lib/entry-note.ts) keys them by the
--    canonical exercise name, trimmed, lower-cased, inner whitespace collapsed,
--    and states the reasoning — line indexes shift when a line is deleted and
--    set text changes the moment a number is corrected, so neither can carry
--    identity. A comment is prose about one lift in one session, exactly like a
--    note, so it gets the same key and inherits the same honest limitation:
--    two entries of one movement on one day share the thread.
--
--    `null` still means "the whole workout", as the spec asks.
--
-- 3. `items` AND `sets` GET THE WIDENED SELECT TOO. The spec widens `workouts`
--    alone, which would let a coach read `raw_text` and nothing else — their
--    policies test `w.user_id = auth.uid()` directly rather than delegating.
--    The read-only workout view needs the structure, so all three move together
--    or the feature cannot render.
--
-- 4. NO `deleted_at`. The spec's Phase 0.5 asks for soft delete; this schema has
--    no per-workout delete path at all (the only `DELETE FROM workouts` in the
--    client is the full account wipe), so there is nothing yet for a tombstone
--    to describe. `on delete cascade` on `workout_comments.workout_id` keeps the
--    spec's edge case correct if and when one arrives.
--
-- ---------------------------------------------------------------------------
-- THE SECOND LOCK. Widening `workouts_select` is the first time in this schema
-- that one account may read another's rows, and the sync engine used to pull
-- `workouts` with NO user filter — it trusted RLS to do the scoping. That would
-- have written every client's private text into the coach's local SQLite on
-- every pass. `src/lib/sync/index.ts` now names `user_id` in every pull, so the
-- policy and the client constrain the same thing independently. Do not narrow
-- that back on the grounds that the policy covers it.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- Tables
-- ===========================================================================

-- Invites: the coach generates a short code, the client redeems it. Redeeming
-- IS the client's consent — there is no separate approval step, and no way for
-- a coach to attach themselves to someone who did not type their code.
create table public.coach_invites (
  code        text primary key,
  coach_id    uuid not null references auth.users on delete cascade,
  expires_at  timestamptz not null default now() + interval '7 days',
  redeemed_by uuid references auth.users,
  redeemed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index coach_invites_coach_idx on public.coach_invites (coach_id);

-- The link itself. There is deliberately NO global "coach" role: being a coach
-- is not an attribute of an account, it is the existence of this row. Anyone
-- can invite, anyone can be invited, and the same person can hold both ends of
-- two different links at once.
create type public.coach_link_status as enum ('active', 'revoked');

create table public.coach_clients (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references auth.users on delete cascade,
  client_id  uuid not null references auth.users on delete cascade,
  status     public.coach_link_status not null default 'active',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (coach_id <> client_id)
);

-- MVP: one active coach per client. Revoked rows stay as history, so the
-- partial index is the only thing that can enforce it.
create unique index one_active_coach_per_client
  on public.coach_clients (client_id) where status = 'active';
create index coach_clients_coach_active_idx
  on public.coach_clients (coach_id) where status = 'active';

-- Comments on a whole workout (exercise_ref is null) or on one exercise in it.
create table public.workout_comments (
  id           uuid primary key default gen_random_uuid(),
  workout_id   uuid not null references public.workouts (id) on delete cascade,
  exercise_ref text,
  author_id    uuid not null references auth.users on delete cascade,
  body         text not null check (char_length(body) between 1 and 2000),
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);
create index workout_comments_workout_idx on public.workout_comments (workout_id, created_at);
create index workout_comments_author_idx  on public.workout_comments (author_id);

-- Expo push tokens. One person, many devices.
create table public.push_tokens (
  user_id    uuid not null references auth.users on delete cascade,
  token      text not null,
  platform   text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

-- ===========================================================================
-- Helpers
-- ===========================================================================

-- `security definer` because it is called FROM inside RLS policies on tables
-- the caller cannot otherwise see. It reads only `coach_clients`, which the
-- caller may read anyway for rows they participate in — this just answers the
-- one boolean without requiring a policy round-trip inside another policy.
create or replace function public.is_active_coach_of(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.coach_clients
    where coach_id = auth.uid()
      and client_id = p_client
      and status = 'active'
  );
$$;

-- Is the caller either end of an active link with this person? Used by the
-- profiles policy so a coach and a client can see each other's display name.
create or replace function public.is_linked_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.coach_clients
    where status = 'active'
      and ((coach_id = auth.uid() and client_id = p_other)
        or (client_id = auth.uid() and coach_id = p_other))
  );
$$;

-- May the caller see this workout at all — owner or active coach of its owner?
-- One place, so the comment policies and the workout policy cannot drift.
create or replace function public.can_read_workout(p_workout uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workouts w
    where w.id = p_workout
      and (w.user_id = auth.uid() or public.is_active_coach_of(w.user_id))
  );
$$;

-- ===========================================================================
-- RPCs. Every one is `security definer` + `set search_path = public`, and every
-- one derives the acting user from `auth.uid()` rather than from an argument —
-- the same rule `delete-account` follows: an id in the payload is never read.
-- ===========================================================================

-- The invite alphabet: uppercase, no 0/O/1/I/L. A code gets read aloud, typed
-- from a photo, and re-typed wrong; the ambiguous glyphs are what makes that
-- happen, so they are simply not in the set.
create or replace function public.coach_invite_alphabet()
returns text language sql immutable as $$ select 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' $$;

create or replace function public.create_coach_invite()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet text := public.coach_invite_alphabet();
  v_code     text;
  v_open     int;
  i          int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  -- A cap on OPEN invites, not on invites ever made: a coach who onboards
  -- twenty athletes over a year is normal, twenty live codes at once is not.
  select count(*) into v_open
  from public.coach_invites
  where coach_id = auth.uid()
    and redeemed_by is null
    and expires_at > now();

  if v_open >= 5 then
    raise exception 'too_many_invites' using errcode = 'P0001';
  end if;

  -- Retry on collision. 31^6 ≈ 887 million, so this loop effectively never
  -- runs twice; it exists because "effectively never" is not "never".
  for attempt in 1..10 loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;

    begin
      insert into public.coach_invites (code, coach_id) values (v_code, auth.uid());
      return v_code;
    exception when unique_violation then
      -- try again
    end;
  end loop;

  raise exception 'code_generation_failed' using errcode = 'P0001';
end;
$$;

-- Redeeming is the client's consent. Every rejection has its own name so the
-- UI can say the true sentence instead of a generic failure.
create or replace function public.redeem_coach_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.coach_invites%rowtype;
  v_link   uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  -- `for update` is what makes two simultaneous redemptions of one code end
  -- with exactly one link: the second transaction blocks here, then sees
  -- `redeemed_by` already set.
  select * into v_invite
  from public.coach_invites
  where code = upper(trim(p_code))
  for update;

  if not found or v_invite.expires_at <= now() or v_invite.redeemed_by is not null then
    raise exception 'invalid_or_expired' using errcode = 'P0001';
  end if;

  if v_invite.coach_id = auth.uid() then
    raise exception 'self_invite' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.coach_clients
    where client_id = auth.uid() and status = 'active'
  ) then
    raise exception 'already_has_coach' using errcode = 'P0001';
  end if;

  insert into public.coach_clients (coach_id, client_id)
  values (v_invite.coach_id, auth.uid())
  returning id into v_link;

  update public.coach_invites
  set redeemed_by = auth.uid(), redeemed_at = now()
  where code = v_invite.code;

  return v_link;
end;
$$;

-- Either party can cut the link, and neither needs the other's agreement. The
-- comments already written stay readable to the client — revoking ends access,
-- it does not erase what was said.
create or replace function public.revoke_coach_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  update public.coach_clients
  set status = 'revoked', revoked_at = now()
  where id = p_link_id
    and status = 'active'
    and (coach_id = auth.uid() or client_id = auth.uid());

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'link_not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- Opening a thread marks the OTHER party's comments read. Never your own: an
-- unread count you can clear by re-reading your own message is noise.
create or replace function public.mark_comments_read(p_workout_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  if not public.can_read_workout(p_workout_id) then
    raise exception 'not_a_participant' using errcode = 'P0001';
  end if;

  update public.workout_comments
  set read_at = now()
  where workout_id = p_workout_id
    and author_id <> auth.uid()
    and read_at is null;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

-- The coach's client list, in one round trip: who, when they last trained, and
-- how many of their comments the coach has not opened.
create or replace function public.coach_client_overview()
returns table (
  link_id        uuid,
  client_id      uuid,
  display_name   text,
  last_workout_at timestamptz,
  unread_count   bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cc.id,
    cc.client_id,
    p.display_name,
    (select max(w.performed_at) from public.workouts w where w.user_id = cc.client_id),
    (select count(*)
       from public.workout_comments c
       join public.workouts w on w.id = c.workout_id
      where w.user_id = cc.client_id
        and c.author_id = cc.client_id
        and c.read_at is null)
  from public.coach_clients cc
  left join public.profiles p on p.id = cc.client_id
  where cc.coach_id = auth.uid()
    and cc.status = 'active'
  order by (select max(w.performed_at) from public.workouts w where w.user_id = cc.client_id)
    desc nulls last;
$$;

-- The client's side of the same question: who coaches me, and how many of their
-- comments have I not read?
create or replace function public.my_coach()
returns table (
  link_id      uuid,
  coach_id     uuid,
  display_name text,
  unread_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cc.id,
    cc.coach_id,
    p.display_name,
    (select count(*)
       from public.workout_comments c
       join public.workouts w on w.id = c.workout_id
      where w.user_id = auth.uid()
        and c.author_id = cc.coach_id
        and c.read_at is null)
  from public.coach_clients cc
  left join public.profiles p on p.id = cc.coach_id
  where cc.client_id = auth.uid()
    and cc.status = 'active';
$$;

-- ===========================================================================
-- Row Level Security
-- ===========================================================================

alter table public.coach_invites    enable row level security;
alter table public.coach_clients    enable row level security;
alter table public.workout_comments enable row level security;
alter table public.push_tokens      enable row level security;

-- Invites: a coach sees their own. NO insert policy — `create_coach_invite` is
-- the only way in, which is what caps them at five and keeps the alphabet
-- honest. A client never reads the table; they redeem by code through the RPC.
create policy coach_invites_select on public.coach_invites
  for select using (coach_id = auth.uid());

-- Links: both ends can see the row. NO insert and NO update — redeeming and
-- revoking are RPCs, so nobody can attach themselves to another account by
-- writing a row directly.
create policy coach_clients_select on public.coach_clients
  for select using (coach_id = auth.uid() or client_id = auth.uid());

-- Comments: readable by the workout's owner and by an active coach of that
-- owner. Insert carries the SAME check plus `author_id = auth.uid()`, which is
-- what stops a participant from writing a comment signed by the other party.
-- No UPDATE policy at all: `read_at` moves only through `mark_comments_read`,
-- so nobody can edit words after they were read.
create policy workout_comments_select on public.workout_comments
  for select using (public.can_read_workout(workout_id));

create policy workout_comments_insert on public.workout_comments
  for insert with check (
    author_id = auth.uid() and public.can_read_workout(workout_id)
  );

create policy workout_comments_delete on public.workout_comments
  for delete using (author_id = auth.uid());

-- Push tokens: strictly the owner's, all four verbs.
create policy push_tokens_select on public.push_tokens
  for select using (user_id = auth.uid());
create policy push_tokens_insert on public.push_tokens
  for insert with check (user_id = auth.uid());
create policy push_tokens_update on public.push_tokens
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_tokens_delete on public.push_tokens
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Widened reads on the record itself. SELECT ONLY — insert, update and delete
-- keep the owner-only policies from the initial migration untouched, which is
-- the whole of "a coach never edits a client's workout".
-- ---------------------------------------------------------------------------
drop policy if exists workouts_select on public.workouts;
create policy workouts_select on public.workouts
  for select using (
    user_id = auth.uid() or public.is_active_coach_of(user_id)
  );

drop policy if exists items_select on public.items;
create policy items_select on public.items
  for select using (exists (
    select 1 from public.workouts w
    where w.id = items.workout_id
      and (w.user_id = auth.uid() or public.is_active_coach_of(w.user_id))
  ));

drop policy if exists sets_select on public.sets;
create policy sets_select on public.sets
  for select using (exists (
    select 1 from public.items i
    join public.workouts w on w.id = i.workout_id
    where i.id = sets.item_id
      and (w.user_id = auth.uid() or public.is_active_coach_of(w.user_id))
  ));

-- Profiles: own row, or the display name of someone the caller is linked with.
-- This is the ONLY thing the link exposes about a person besides their training.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid() or public.is_linked_with(id)
  );

-- ---------------------------------------------------------------------------
-- Grants. `authenticated` may call the RPCs; `anon` may not call any of them.
-- ---------------------------------------------------------------------------
revoke execute on function public.create_coach_invite()          from public, anon;
revoke execute on function public.redeem_coach_invite(text)      from public, anon;
revoke execute on function public.revoke_coach_link(uuid)        from public, anon;
revoke execute on function public.mark_comments_read(uuid)       from public, anon;
revoke execute on function public.coach_client_overview()        from public, anon;
revoke execute on function public.my_coach()                     from public, anon;

grant execute on function public.create_coach_invite()      to authenticated;
grant execute on function public.redeem_coach_invite(text)  to authenticated;
grant execute on function public.revoke_coach_link(uuid)    to authenticated;
grant execute on function public.mark_comments_read(uuid)   to authenticated;
grant execute on function public.coach_client_overview()    to authenticated;
grant execute on function public.my_coach()                 to authenticated;
