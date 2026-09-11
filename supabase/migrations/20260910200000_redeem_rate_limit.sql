-- Security remediation, 10 September 2026 — S17.
-- See docs/security-remediation-2026-09.md.
--
-- THE FINDING. `redeem_coach_invite` could be called as often as anyone liked.
-- A code is six characters from a 31-glyph alphabet — 31^6 ≈ 887 million, which
-- sounds like plenty until you count the codes that are OPEN at one time rather
-- than the ones that exist. Every open code is a hit, so the expected number of
-- guesses is 31^6 divided by that population: with a thousand coaches holding
-- five live codes each, roughly 180 000 guesses. PostgREST will answer far more
-- than that in an afternoon.
--
-- WHAT A HIT ACTUALLY BUYS, because it is not what it first looks like. The
-- redeemer becomes the CLIENT and the code's issuer becomes the coach, so a
-- guesser does not read a stranger's training — they hand their own empty
-- account to a stranger. The damage is to the coach: the code is consumed,
-- `one_active_coach_per_client` is not involved, and the athlete it was meant
-- for is told "that code has already been used". With five open codes capped
-- per coach, a guesser can keep a coach permanently unable to onboard anybody.
-- Griefing rather than disclosure — and still the kind of thing that has to
-- cost something.
--
-- WHY THIS FUNCTION STOPPED RAISING, which is the whole reason the migration
-- looks like this. A limiter counts attempts, and PostgREST runs each request
-- in ONE transaction: `raise exception` aborts it and takes the counter's own
-- increment down with it. A limiter that forgets every attempt it rejected is
-- not a limiter. So the failure paths now RETURN a result instead of raising,
-- every write commits, and the counter remembers. The client reads the name out
-- of the payload rather than off an error (`lib/coaching/index.ts`).

-- ---------------------------------------------------------------------------
-- Per-user attempts. Same posture as `parse_rate_limits`: RLS on, NO policies,
-- so no client role can read or reset its own counter.
-- ---------------------------------------------------------------------------
create table if not exists public.redeem_attempts (
  user_id      uuid primary key references auth.users on delete cascade,
  window_start timestamptz not null,
  count        int not null default 0
);

alter table public.redeem_attempts enable row level security;
-- No policies, on purpose. A client sees zero rows rather than an error.

-- ---------------------------------------------------------------------------
-- The return type changes, so the old signature has to go first.
-- ---------------------------------------------------------------------------
drop function if exists public.redeem_coach_invite(text);

create or replace function public.redeem_coach_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- A person mistypes a code twice, maybe three times. Ten in a quarter of an
  -- hour is already not a person.
  c_max_attempts  constant int := 10;
  c_window_secs   constant int := 900;
  -- And a ceiling that does not care how many accounts one attacker holds —
  -- signup is open (S2), so a per-user limit alone is a suggestion. Real
  -- redemptions are rare events; 500 an hour across the entire project is
  -- generous by orders of magnitude.
  c_global_max    constant int := 500;
  c_global_window constant int := 3600;

  v_uid    uuid := auth.uid();
  v_count  int;
  v_ok     boolean;
  v_invite public.coach_invites%rowtype;
  v_link   uuid;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  insert into public.redeem_attempts as r (user_id, window_start, count)
  values (v_uid, now(), 1)
  on conflict (user_id) do update set
    count = case
      when r.window_start < now() - make_interval(secs => c_window_secs) then 1
      else r.count + 1
    end,
    window_start = case
      when r.window_start < now() - make_interval(secs => c_window_secs) then now()
      else r.window_start
    end
  returning r.count into v_count;

  if v_count > c_max_attempts then
    return jsonb_build_object('error', 'too_many_attempts');
  end if;

  -- The project-wide ceiling. `bump_global_rate` is granted to service_role
  -- only; the grant is checked against the OWNER inside a security-definer
  -- function, which is exactly why this may call it and a client may not.
  v_ok := public.bump_global_rate('coach_redeem', c_global_max, c_global_window);
  if not v_ok then
    return jsonb_build_object('error', 'too_many_attempts');
  end if;

  -- `for update` is what makes two simultaneous redemptions of one code end
  -- with exactly one link: the second transaction blocks here, then sees
  -- `redeemed_by` already set.
  select * into v_invite
  from public.coach_invites
  where code = upper(trim(p_code))
  for update;

  if not found or v_invite.expires_at <= now() or v_invite.redeemed_by is not null then
    return jsonb_build_object('error', 'invalid_or_expired');
  end if;

  if v_invite.coach_id = v_uid then
    return jsonb_build_object('error', 'self_invite');
  end if;

  if exists (
    select 1 from public.coach_clients
    where client_id = v_uid and status = 'active'
  ) then
    return jsonb_build_object('error', 'already_has_coach');
  end if;

  insert into public.coach_clients (coach_id, client_id)
  values (v_invite.coach_id, v_uid)
  returning id into v_link;

  update public.coach_invites
  set redeemed_by = v_uid, redeemed_at = now()
  where code = v_invite.code;

  -- A join that worked is not a guess. Clearing the window means somebody who
  -- fat-fingered a code four times and then got it right is not left one
  -- mistake away from a fifteen-minute lockout on a feature they have already
  -- finished using.
  delete from public.redeem_attempts where user_id = v_uid;

  return jsonb_build_object('link_id', v_link);
end;
$$;

revoke execute on function public.redeem_coach_invite(text) from public, anon;
grant  execute on function public.redeem_coach_invite(text) to authenticated;
