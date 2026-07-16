-- Recore initial schema (CLAUDE.md §3) + profiles + rate limiting.
--
-- Design principle: raw_text is the source of truth, structure is a derivable
-- projection. raw_text is NEVER rewritten; when the parser improves, re-parse
-- from raw_text and every user's data improves overnight.
--
-- SECURITY: every table has Row Level Security enabled. A user can only touch
-- rows where user_id = auth.uid() (items/sets inherit ownership through their
-- parent workout). parse_rate_limits has RLS enabled with NO policies, so it is
-- only reachable with the service-role key inside the edge function.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user. PII minimization: only what the account
-- needs (display name, email, units preference).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  email        text,
  units        text not null default 'kg' check (units in ('kg', 'lb')),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 1. One row = one workout note. raw_text is NEVER rewritten.
-- ---------------------------------------------------------------------------
create table public.workouts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  performed_at  timestamptz not null,      -- the DAY this workout belongs to
  raw_text      text not null,             -- exactly what the user typed
  parse_version int,                        -- which parser/prompt version produced the structure
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- 2. One row = one exercise occurrence within a workout.
create table public.items (
  id          uuid primary key default gen_random_uuid(),
  workout_id  uuid not null references public.workouts on delete cascade,
  position    int not null,                -- order within the workout
  exercise_id uuid,                         -- fk added below (exercises created after)
  group_key   text,                         -- same value across items = SUPERSET. null = standalone.
  group_pos   int                           -- A/B/C order within the superset
);

-- 3. Sets. ONE table for lifting AND cardio AND holds.
create table public.sets (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references public.items on delete cascade,
  position      int not null,
  kind          text not null default 'working',  -- warmup | working | drop | myo | amrap | failure
  parent_set_id uuid references public.sets,       -- DROPSET/MYO chain onto the parent working set
  reps          int,
  weight_kg     numeric(6,2),
  distance_m    numeric(8,1),               -- run, row, sled
  duration_s    int,                         -- plank, carry, rest
  rir           numeric(3,1),               -- reps-in-reserve, EXTRACTED FROM THE TEXT
  note          text
);

-- 4. Exercises + the user's shorthand (aliasing).
create table public.exercises (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users on delete cascade, -- null = global/default exercise
  canonical     text not null,              -- "Bench Press"
  aliases       text[] default '{}',         -- {bench, bp, potisk s prsi}
  modality      text default 'strength',    -- strength | cardio | carry | hold
  increment_kg  numeric(4,2)                -- 2.5 upper, 5 lower, 1.25 isolation
);

alter table public.items
  add constraint items_exercise_id_fkey
  foreign key (exercise_id) references public.exercises;

-- Prediction cache: computed AFTER a workout, read on open. Never compute on open.
create table public.predictions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  for_date      date not null,
  ghost_text    text not null,              -- the pre-filled note shown as placeholder
  reason        text,                        -- the one human line: "Last time you wrote..."
  created_at    timestamptz default now(),
  unique (user_id, for_date)                -- one cached prediction per day; enables upsert
);

-- Rate limiting for the parse edge function. Service-role only (RLS, no policies).
create table public.parse_rate_limits (
  user_id      uuid primary key references auth.users on delete cascade,
  window_start timestamptz not null,
  count        int not null default 0
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index workouts_user_performed_idx on public.workouts (user_id, performed_at desc);
create index workouts_user_updated_idx   on public.workouts (user_id, updated_at);
create index items_workout_idx           on public.items (workout_id);
create index items_exercise_idx          on public.items (exercise_id);
create index sets_item_idx               on public.sets (item_id);
create index exercises_user_idx          on public.exercises (user_id);
create index predictions_user_date_idx   on public.predictions (user_id, for_date desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workouts_set_updated_at
  before update on public.workouts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create a profile row on sign-up. The client upserts display_name/email
-- immediately after the first Apple sign-in (Apple only returns them once).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Rate limiting RPC, called by the parse-workout edge function with the
-- service-role key. Atomic sliding window: resets when the window expires,
-- increments otherwise. Returns true while the caller is under the cap.
-- Not executable by anon/authenticated (revoked below) — clients cannot
-- reset or probe each other's counters.
-- ---------------------------------------------------------------------------
create or replace function public.bump_parse_rate(
  p_user uuid,
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
  insert into public.parse_rate_limits as r (user_id, window_start, count)
  values (p_user, now(), 1)
  on conflict (user_id) do update set
    count = case
      when r.window_start < now() - make_interval(secs => p_window_seconds) then 1
      else r.count + 1
    end,
    window_start = case
      when r.window_start < now() - make_interval(secs => p_window_seconds) then now()
      else r.window_start
    end
  returning r.count into v_count;

  return v_count <= p_max;
end;
$$;

revoke execute on function public.bump_parse_rate(uuid, int, int) from public, anon, authenticated;
grant execute on function public.bump_parse_rate(uuid, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY. Enabled on EVERY table; no table is readable without a
-- matching policy. A user reads/writes ONLY their own rows.
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.workouts          enable row level security;
alter table public.items             enable row level security;
alter table public.sets              enable row level security;
alter table public.exercises        enable row level security;
alter table public.predictions       enable row level security;
alter table public.parse_rate_limits enable row level security;
-- parse_rate_limits: NO policies on purpose — service role only.

-- profiles: a user manages only their own profile.
create policy profiles_select on public.profiles
  for select using (id = auth.uid());
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- workouts: user_id = auth.uid() for every verb.
create policy workouts_select on public.workouts
  for select using (user_id = auth.uid());
create policy workouts_insert on public.workouts
  for insert with check (user_id = auth.uid());
create policy workouts_update on public.workouts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy workouts_delete on public.workouts
  for delete using (user_id = auth.uid());

-- items: ownership inherited through the parent workout.
create policy items_select on public.items
  for select using (exists (
    select 1 from public.workouts w
    where w.id = items.workout_id and w.user_id = auth.uid()
  ));
create policy items_insert on public.items
  for insert with check (exists (
    select 1 from public.workouts w
    where w.id = items.workout_id and w.user_id = auth.uid()
  ));
create policy items_update on public.items
  for update using (exists (
    select 1 from public.workouts w
    where w.id = items.workout_id and w.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.workouts w
    where w.id = items.workout_id and w.user_id = auth.uid()
  ));
create policy items_delete on public.items
  for delete using (exists (
    select 1 from public.workouts w
    where w.id = items.workout_id and w.user_id = auth.uid()
  ));

-- sets: ownership inherited through item → workout.
create policy sets_select on public.sets
  for select using (exists (
    select 1 from public.items i
    join public.workouts w on w.id = i.workout_id
    where i.id = sets.item_id and w.user_id = auth.uid()
  ));
create policy sets_insert on public.sets
  for insert with check (exists (
    select 1 from public.items i
    join public.workouts w on w.id = i.workout_id
    where i.id = sets.item_id and w.user_id = auth.uid()
  ));
create policy sets_update on public.sets
  for update using (exists (
    select 1 from public.items i
    join public.workouts w on w.id = i.workout_id
    where i.id = sets.item_id and w.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.items i
    join public.workouts w on w.id = i.workout_id
    where i.id = sets.item_id and w.user_id = auth.uid()
  ));
create policy sets_delete on public.sets
  for delete using (exists (
    select 1 from public.items i
    join public.workouts w on w.id = i.workout_id
    where i.id = sets.item_id and w.user_id = auth.uid()
  ));

-- exercises: global defaults (user_id is null) are readable by everyone signed
-- in; a user writes only their OWN rows. Global rows are seeded by migrations
-- and are not writable by any client.
create policy exercises_select on public.exercises
  for select using (user_id = auth.uid() or user_id is null);
create policy exercises_insert on public.exercises
  for insert with check (user_id = auth.uid());
create policy exercises_update on public.exercises
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy exercises_delete on public.exercises
  for delete using (user_id = auth.uid());

-- predictions: user_id = auth.uid() for every verb.
create policy predictions_select on public.predictions
  for select using (user_id = auth.uid());
create policy predictions_insert on public.predictions
  for insert with check (user_id = auth.uid());
create policy predictions_update on public.predictions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy predictions_delete on public.predictions
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Global default exercises (user_id = null). Aliases resolve the user's
-- shorthand; increment_kg follows CLAUDE.md §7: +5 lower compound, +2.5 upper
-- compound, +1.25 isolation, null for bodyweight/cardio/holds.
-- ---------------------------------------------------------------------------
insert into public.exercises (user_id, canonical, aliases, modality, increment_kg) values
  (null, 'Bench Press',        '{bench,bp,flat bench,bench press}',            'strength', 2.5),
  (null, 'Incline Bench Press','{incline,incline bench,incline bp}',           'strength', 2.5),
  (null, 'Incline Dumbbell Press','{incline db,incline db press,incline dumbbell}', 'strength', 2.5),
  (null, 'Overhead Press',     '{ohp,press,shoulder press,military press}',    'strength', 2.5),
  (null, 'Squat',              '{back squat,bs,squats}',                       'strength', 5),
  (null, 'Front Squat',        '{fs,front squats}',                            'strength', 5),
  (null, 'Deadlift',           '{dl,deads,conventional deadlift}',             'strength', 5),
  (null, 'Romanian Deadlift',  '{rdl,romanian dl,stiff leg deadlift}',         'strength', 5),
  (null, 'Barbell Row',        '{row,bb row,bent over row,pendlay row}',       'strength', 2.5),
  (null, 'Lat Pulldown',       '{pulldown,lat pull,pulldowns}',                'strength', 2.5),
  (null, 'Pull-up',            '{pull ups,pullups,pull-ups,chins,chin ups}',   'strength', null),
  (null, 'Weighted Pull-up',   '{weighted pull-ups,weighted pullups,weighted chins}', 'strength', 2.5),
  (null, 'Dip',                '{dips,weighted dips}',                         'strength', null),
  (null, 'Push-up',            '{push ups,pushups,push-ups}',                  'strength', null),
  (null, 'Leg Press',          '{legpress}',                                   'strength', 5),
  (null, 'Hip Thrust',         '{thrusts,glute bridge}',                       'strength', 5),
  (null, 'Biceps Curl',        '{curls,curl,db curls,bicep curls}',            'strength', 1.25),
  (null, 'Triceps Pushdown',   '{pushdown,pushdowns,tricep pushdown,cable pushdown}', 'strength', 1.25),
  (null, 'Lateral Raise',      '{lateral raises,laterals,side raises}',        'strength', 1.25),
  (null, 'Chest Fly',          '{flyes,flies,fly,pec deck,cable fly}',         'strength', 1.25),
  (null, 'Leg Curl',           '{leg curls,hamstring curl}',                   'strength', 1.25),
  (null, 'Leg Extension',      '{leg extensions,quad extension}',              'strength', 1.25),
  (null, 'Run',                '{running,jog,sprint,sprints}',                 'cardio',   null),
  (null, 'Row (Erg)',          '{rowing,erg,rower}',                           'cardio',   null),
  (null, 'Ski Erg',            '{ski,skierg}',                                 'cardio',   null),
  (null, 'Sled Push',          '{sled,prowler,prowler push}',                  'carry',    null),
  (null, 'Farmer Carry',       '{farmers,farmers walk,farmer walk,carries}',   'carry',    null),
  (null, 'Plank',              '{planks,front plank}',                         'hold',     null),
  (null, 'Wall Ball',          '{wall balls,wallballs}',                       'strength', null),
  (null, 'Burpee',             '{burpees}',                                    'cardio',   null);
