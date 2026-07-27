-- Weekly split (pre-plan) — user-declared day-templates. Mirrors the local
-- SQLite table in src/lib/db/schema.ts. Additive; never rewrites deployed
-- tables (CLAUDE.md §5). raw_text is the source of truth, parsed by the same
-- edge function as a workout note. RLS: a user touches only their own rows.

create table if not exists public.plan_days (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  position      int not null,                 -- rotation order within the cycle
  label         text not null,                -- "Upper" · "Push" · "Legs" · "A"
  weekday_mask  int,                          -- null = rotation-only; bit i = weekday i (0=Mon)
  raw_text      text not null default '',     -- the movements, authored as free text
  parse_version int,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists plan_days_user_position_idx
  on public.plan_days (user_id, position);

alter table public.plan_days enable row level security;

create policy "plan_days are private to the owner"
  on public.plan_days
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
