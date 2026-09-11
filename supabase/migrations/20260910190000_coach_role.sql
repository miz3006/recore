-- Being a coach becomes a CHOICE, not a side effect of somebody typing a code.
--
-- ---------------------------------------------------------------------------
-- WHY THIS REVERSES A RULING IN THE COACHING MIGRATION
-- ---------------------------------------------------------------------------
--
-- `20260910140000_coaching.sql` says, in as many words: "There is deliberately
-- NO global 'coach' role: being a coach is not an attribute of an account, it
-- is the existence of this row." That was a clean model and it produced a
-- screen nobody could defend — the owner found it on 10 September 2026 and put
-- it plainly: *as a client you have no business being offered "Invite a
-- client", because you are a client and not a coach.* With no role there was
-- nothing to hide the coach's half behind, so every account was shown both
-- ends of a relationship it had only one end of.
--
-- So the role exists now. What does NOT change is the consent model: this row
-- lets a person ISSUE codes, and nothing else. It grants no read of anybody's
-- training. Only redeeming a code still does that, and only the client can
-- redeem. A person can flip this on for themselves in seconds — it is a
-- statement of what they are here to do, not a permission anyone granted them.
--
-- ---------------------------------------------------------------------------
-- `verified_at` IS RESERVED AND NOTHING READS IT
-- ---------------------------------------------------------------------------
--
-- The owner asked how trainers would be verified. This column is where that
-- answer will live, and it is deliberately inert: no RPC returns it, no screen
-- draws it, and no client can write it (there is no UPDATE policy — see below).
-- CLAUDE.md §3 forbids fabricated credentials anywhere including placeholders,
-- and a "verified coach" mark that means "typed their own name" would be
-- exactly that. When verification is real — an approval the owner performs, or
-- a credential actually checked — it sets this column and a badge can then be
-- earned rather than asserted.

create table public.coach_profiles (
  user_id     uuid primary key references auth.users on delete cascade,
  enabled_at  timestamptz not null default now(),
  -- Reserved. Always null today; see the note above before surfacing it.
  verified_at timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.coach_profiles enable row level security;

-- Own row, or the row of somebody you are linked with. The second half is what
-- lets a client's app one day say something true about who coaches them; it
-- exposes strictly less than `profiles` already does.
create policy coach_profiles_select on public.coach_profiles
  for select using (user_id = auth.uid() or public.is_linked_with(user_id));

-- Insert and delete are the person's own switch. There is NO UPDATE POLICY at
-- all, which is what makes `verified_at` unwritable from a client: the only way
-- a row changes is being deleted and re-made, and both of those reset it to
-- null rather than letting anyone set it.
create policy coach_profiles_insert on public.coach_profiles
  for insert with check (user_id = auth.uid());
create policy coach_profiles_delete on public.coach_profiles
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Anyone already coaching keeps their roster.
--
-- Without this, the first build with the switch would hide the Clients row from
-- every coach who already had clients, and their athletes' sessions would look
-- gone. The backfill reads ACTIVE LINKS only: an open invite is an intention,
-- a live link is a relationship.
-- ---------------------------------------------------------------------------
insert into public.coach_profiles (user_id)
select distinct coach_id from public.coach_clients where status = 'active'
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- The switch itself. An RPC rather than a bare insert/delete for one reason:
-- turning the role OFF while people are still linked to you has to be refused,
-- and a refusal a client can skip is not a rule.
-- ---------------------------------------------------------------------------
create or replace function public.set_coach_role(p_on boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if p_on then
    insert into public.coach_profiles (user_id) values (auth.uid())
    on conflict (user_id) do nothing;
    return true;
  end if;

  -- Turning it off is not a way to drop people quietly. The links stay live
  -- either way; what would change is that the coach could no longer SEE them,
  -- while still being able to read their training. Ending a relationship is
  -- `revoke_coach_link`, and it says so on the screen it is refused from.
  if exists (
    select 1 from public.coach_clients
    where coach_id = auth.uid() and status = 'active'
  ) then
    raise exception 'still_coaching' using errcode = 'P0001';
  end if;

  delete from public.coach_profiles where user_id = auth.uid();
  -- Open codes are an invitation to be read by someone. Somebody who has just
  -- said they do not coach should not have five of them outstanding.
  delete from public.coach_invites
  where coach_id = auth.uid() and redeemed_by is null;
  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- And the gate. This is the half that makes the switch mean something: hiding
-- a row is a UI decision, refusing the RPC is the rule.
-- ---------------------------------------------------------------------------
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

  if not exists (select 1 from public.coach_profiles where user_id = auth.uid()) then
    raise exception 'not_a_coach' using errcode = 'P0001';
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

revoke execute on function public.set_coach_role(boolean) from public, anon;
grant  execute on function public.set_coach_role(boolean) to authenticated;
