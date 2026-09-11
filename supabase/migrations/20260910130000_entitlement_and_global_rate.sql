-- Security remediation, 10 September 2026 — S2.
-- See docs/security-remediation-2026-09.md.
--
-- THE FINDING. The anon key is public, `POST /auth/v1/signup` returns a valid
-- JWT immediately with `mailer_autoconfirm` on, all three AI functions check
-- only that the JWT is valid, and the rate limit is PER USER. More accounts,
-- more quota, and the bill is the project owner's. There was no global ceiling
-- and no entitlement check on either side of the wire.
--
-- This migration adds the two server-side pieces. The third and most important
-- piece — disabling the Email provider in Supabase → Authentication → Providers
-- — is a dashboard action and is not something a migration can do.

-- ---------------------------------------------------------------------------
-- 1. Entitlement, server-side.
--
-- The app already resolves entitlement on the CLIENT (src/lib/billing) from
-- RevenueCat. That is the right place for what the UI shows and the wrong place
-- for what the model costs: the client is the thing being metered.
--
-- Nullable, and null means "not entitled". It is written by the RevenueCat
-- webhook and by nothing else — no client policy grants update on this column,
-- because `profiles_update` is `id = auth.uid()` and would otherwise let a user
-- grant themselves a subscription with one PATCH. See the revoke below.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists entitled_until timestamptz;

comment on column public.profiles.entitled_until is
  'Server-side entitlement expiry, written by the RevenueCat webhook only. '
  'Null = not entitled. Never writable by a client (see the column grants).';

-- profiles_update lets a user update their own row, which without this would
-- include this column. Column-level privileges are checked in ADDITION to RLS,
-- so revoking here closes the hole RLS alone cannot.
revoke update (entitled_until) on public.profiles from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 2. A GLOBAL ceiling, beside the per-user one.
--
-- The per-user window (30 calls / 10 min) bounds one account. It does nothing
-- about N accounts, which is the whole of S2 — so this counter is keyed by a
-- bucket name rather than a user, and one attacker with a thousand JWTs meets
-- the same wall as one attacker with one.
--
-- Same shape and same posture as parse_rate_limits: RLS on, NO policies, and
-- execute revoked from every client role. Only the service role inside an edge
-- function can move it.
-- ---------------------------------------------------------------------------
create table if not exists public.global_rate_limits (
  bucket       text primary key,
  window_start timestamptz not null,
  count        int not null default 0
);

alter table public.global_rate_limits enable row level security;
-- No policies, on purpose. A client sees zero rows rather than an error.

create or replace function public.bump_global_rate(
  p_bucket text,
  p_max int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.global_rate_limits as g (bucket, window_start, count)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update set
    count = case
      when g.window_start < now() - make_interval(secs => p_window_seconds) then 1
      else g.count + 1
    end,
    window_start = case
      when g.window_start < now() - make_interval(secs => p_window_seconds) then now()
      else g.window_start
    end
  returning g.count into v_count;

  return v_count <= p_max;
end;
$$;

revoke execute on function public.bump_global_rate(text, int, int) from public, anon, authenticated;
grant execute on function public.bump_global_rate(text, int, int) to service_role;
