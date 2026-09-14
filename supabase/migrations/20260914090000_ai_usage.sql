-- The token ledger (14 September 2026, owner's ask for the TestFlight round).
--
-- WHAT THIS IS. One row per parse REQUEST, written by `parse-workout` with the
-- service-role key after the model has answered: how many model calls the
-- request fanned out into and what they cost, by the provider's own count.
-- The Anthropic Console already answers "what did the app spend today"; this
-- table answers the question the Console cannot — "which tester, and on what"
-- — without which a spike is just a number.
--
-- WHAT THIS IS NOT. Not a rate limiter (`parse_rate_limits` and
-- `global_rate_limits` already gate the spend, in calls) and not an AI-boundary
-- change: no prompt, schema or guard moves, so §9.4 is not owed. Recording is
-- best-effort in the function — a failed insert is logged and the parse
-- answers exactly as it would have (§1.1: nothing blocks on bookkeeping).
--
-- POSTURE: same as `parse_rate_limits`. RLS on, NO policies — no client role
-- reads anybody's spend, including its own; the service role writes and the
-- owner reads in the dashboard. Cache columns are separate because they bill
-- differently (writes at 1.25x the input rate, reads at 0.1x) and folding them
-- into `input_tokens` would make the ledger disagree with the invoice.
--
-- The owner's question, as SQL (dashboard → SQL editor):
--
--   select user_id, created_at::date as day,
--          sum(calls) as calls,
--          sum(input_tokens) as input, sum(output_tokens) as output,
--          sum(cache_write_tokens) as cache_write, sum(cache_read_tokens) as cache_read
--   from public.ai_usage
--   group by 1, 2
--   order by day desc, output desc;

create table if not exists public.ai_usage (
  id                 bigint generated always as identity primary key,
  user_id            uuid not null references auth.users on delete cascade,
  fn                 text not null,
  model              text not null,
  calls              int  not null,
  input_tokens       int  not null,
  output_tokens      int  not null,
  cache_write_tokens int  not null default 0,
  cache_read_tokens  int  not null default 0,
  created_at         timestamptz not null default now()
);

alter table public.ai_usage enable row level security;

-- The two reads this table exists for: one person's trail, and a day's total.
create index if not exists ai_usage_user_created on public.ai_usage (user_id, created_at);
create index if not exists ai_usage_created on public.ai_usage (created_at);
