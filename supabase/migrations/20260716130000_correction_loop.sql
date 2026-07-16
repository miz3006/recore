-- Correction loop + alias overrides + prediction adherence (CLAUDE.md §6.2, §7.2).
-- Additive only — never rewrites deployed tables.

-- ---------------------------------------------------------------------------
-- corrections: every user fix of a parse is training data — the raw line,
-- what the parser said, what the user said it should be. Client pushes these;
-- nothing ever pulls them back into the app (append-only eval fodder).
-- ---------------------------------------------------------------------------
create table public.corrections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  workout_id  uuid references public.workouts on delete cascade,
  line_text   text not null,
  before_json jsonb,
  after_json  jsonb not null,
  created_at  timestamptz default now()
);
create index corrections_user_idx on public.corrections (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- alias_overrides: "this user's shorthand → that exercise", consulted before
-- any other resolution. Allows re-pointing shorthand at GLOBAL exercises
-- (whose alias arrays are read-only) without duplicate user rows.
-- ---------------------------------------------------------------------------
create table public.alias_overrides (
  user_id     uuid not null references auth.users on delete cascade,
  alias       text not null,
  exercise_id uuid not null references public.exercises on delete cascade,
  created_at  timestamptz default now(),
  primary key (user_id, alias)
);

-- ---------------------------------------------------------------------------
-- predictions: adherence instrumentation — when was the ghost accepted, and
-- was the prescription followed?
-- ---------------------------------------------------------------------------
alter table public.predictions add column accepted_at timestamptz;
alter table public.predictions add column outcome text
  check (outcome in ('followed', 'edited', 'ignored'));

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY — a user reads/writes ONLY their own rows.
-- ---------------------------------------------------------------------------
alter table public.corrections     enable row level security;
alter table public.alias_overrides enable row level security;

-- corrections: append-only from the client's perspective.
create policy corrections_select on public.corrections
  for select using (user_id = auth.uid());
create policy corrections_insert on public.corrections
  for insert with check (user_id = auth.uid());

-- alias_overrides: full ownership of one's own shorthand map.
create policy alias_overrides_select on public.alias_overrides
  for select using (user_id = auth.uid());
create policy alias_overrides_insert on public.alias_overrides
  for insert with check (user_id = auth.uid());
create policy alias_overrides_update on public.alias_overrides
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy alias_overrides_delete on public.alias_overrides
  for delete using (user_id = auth.uid());
