-- DEMO SEED: one month of realistic training history for YOUR account.
-- Run in the Supabase SQL editor. Picks the FIRST auth user (adjust the
-- select below if your project has more than one).
--
-- What it creates (all as parsed structure + matching raw_text):
--   12 sessions over the last 28 days, A/B split:
--     A: Bench Press, Squat, Pull-up      B: Overhead Press, Deadlift, Barbell Row
--   with plausible progression, stalls, and RIR extracted "from the text",
--   plus a cached ghost prediction for TODAY.
--
-- Idempotent: re-running first clears the 3–28-days-ago window for that user
-- (yesterday and today are never touched, so your live test notes survive).

do $$
declare
  v_user uuid;
  v_plan jsonb := '[
    {"days_ago":28,"lines":[
      {"ex":"Bench Press","raw":"bench 3x8 90kg","sets":[[8,90,null],[8,90,null],[8,90,1]]},
      {"ex":"Squat","raw":"squat 3x5 120kg","sets":[[5,120,null],[5,120,null],[5,120,null]]},
      {"ex":"Pull-up","raw":"pull ups 3x8","sets":[[8,null,null],[8,null,null],[8,null,null]]}
    ]},
    {"days_ago":26,"lines":[
      {"ex":"Overhead Press","raw":"ohp 3x8 40kg","sets":[[8,40,null],[8,40,null],[8,40,1]]},
      {"ex":"Deadlift","raw":"deadlift 3x5 150kg","sets":[[5,150,null],[5,150,null],[5,150,1]]},
      {"ex":"Barbell Row","raw":"row 3x10 70kg","sets":[[10,70,null],[10,70,null],[10,70,null]]}
    ]},
    {"days_ago":24,"lines":[
      {"ex":"Bench Press","raw":"bench 3x8 92.5kg last rep grindy","sets":[[8,92.5,null],[8,92.5,null],[7,92.5,0]]},
      {"ex":"Squat","raw":"squat 3x5 125kg","sets":[[5,125,null],[5,125,null],[5,125,null]]},
      {"ex":"Pull-up","raw":"pull ups 3x9","sets":[[9,null,null],[9,null,null],[9,null,null]]}
    ]},
    {"days_ago":21,"lines":[
      {"ex":"Overhead Press","raw":"ohp 3x8 42.5kg","sets":[[8,42.5,null],[8,42.5,null],[7,42.5,0]]},
      {"ex":"Deadlift","raw":"deadlift 3x5 155kg","sets":[[5,155,null],[5,155,null],[5,155,null]]},
      {"ex":"Barbell Row","raw":"row 3x10 72.5kg","sets":[[10,72.5,null],[10,72.5,null],[10,72.5,null]]}
    ]},
    {"days_ago":19,"lines":[
      {"ex":"Bench Press","raw":"bench 3x8 95kg","sets":[[8,95,null],[8,95,null],[7,95,1]]},
      {"ex":"Squat","raw":"squat 3x5 130kg","sets":[[5,130,null],[5,130,null],[5,130,1]]},
      {"ex":"Pull-up","raw":"pull ups 3x9","sets":[[9,null,null],[9,null,null],[9,null,null]]}
    ]},
    {"days_ago":17,"lines":[
      {"ex":"Overhead Press","raw":"ohp 3x8 42.5kg had 2 more in the tank","sets":[[8,42.5,null],[8,42.5,null],[8,42.5,2]]},
      {"ex":"Deadlift","raw":"deadlift 3x5 160kg","sets":[[5,160,null],[5,160,null],[5,160,null]]},
      {"ex":"Barbell Row","raw":"row 3x10 75kg","sets":[[10,75,null],[10,75,null],[10,75,null]]}
    ]},
    {"days_ago":14,"lines":[
      {"ex":"Bench Press","raw":"bench 3x8 95kg felt smooth","sets":[[8,95,null],[8,95,null],[8,95,2]]},
      {"ex":"Squat","raw":"squat 3x5 135kg","sets":[[5,135,null],[5,135,null],[5,135,null]]},
      {"ex":"Pull-up","raw":"pull ups 3x10","sets":[[10,null,null],[10,null,null],[10,null,null]]}
    ]},
    {"days_ago":12,"lines":[
      {"ex":"Overhead Press","raw":"ohp 45kg 8,7,7","sets":[[8,45,null],[7,45,0],[7,45,0]]},
      {"ex":"Deadlift","raw":"deadlift 3x5 165kg last set 4","sets":[[5,165,null],[5,165,null],[4,165,0]]},
      {"ex":"Barbell Row","raw":"row 3x10 75kg","sets":[[10,75,null],[10,75,null],[10,75,1]]}
    ]},
    {"days_ago":10,"lines":[
      {"ex":"Bench Press","raw":"bench 3x8 97.5kg","sets":[[8,97.5,null],[8,97.5,null],[7,97.5,1]]},
      {"ex":"Squat","raw":"squat 3x5 140kg","sets":[[5,140,null],[5,140,null],[5,140,1]]},
      {"ex":"Pull-up","raw":"pull ups 3x10","sets":[[10,null,null],[10,null,null],[10,null,null]]}
    ]},
    {"days_ago":7,"lines":[
      {"ex":"Overhead Press","raw":"ohp 3x8 45kg","sets":[[8,45,null],[8,45,null],[7,45,1]]},
      {"ex":"Deadlift","raw":"deadlift 170kg 5,5,4 heavy","sets":[[5,170,null],[5,170,null],[4,170,0]]},
      {"ex":"Barbell Row","raw":"row 3x10 77.5kg","sets":[[10,77.5,null],[10,77.5,null],[10,77.5,null]]}
    ]},
    {"days_ago":5,"lines":[
      {"ex":"Bench Press","raw":"bench 3x8 97.5kg had 2 more in the tank","sets":[[8,97.5,null],[8,97.5,null],[8,97.5,2]]},
      {"ex":"Squat","raw":"squat 3x5 140kg felt smooth","sets":[[5,140,null],[5,140,null],[5,140,2]]},
      {"ex":"Pull-up","raw":"pull ups 3x10","sets":[[10,null,null],[10,null,null],[10,null,null]]}
    ]},
    {"days_ago":3,"lines":[
      {"ex":"Overhead Press","raw":"ohp 3x8 45kg","sets":[[8,45,null],[8,45,null],[8,45,1]]},
      {"ex":"Deadlift","raw":"deadlift 3x5 170kg","sets":[[5,170,null],[5,170,null],[5,170,1]]},
      {"ex":"Barbell Row","raw":"row 3x10 80kg","sets":[[10,80,null],[10,80,null],[10,80,null]]}
    ]}
  ]'::jsonb;
  v_sess jsonb;
  v_line jsonb;
  v_set jsonb;
  v_workout uuid;
  v_item uuid;
  v_ex uuid;
  v_raw text;
  v_pos int;
  v_spos int;
  v_when timestamptz;
begin
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then
    raise exception 'No user found — sign in to the app once first.';
  end if;

  -- Idempotency: clear the seed window (3–28 days ago) for this user.
  delete from public.workouts
   where user_id = v_user
     and performed_at >= (current_date - 28)::timestamptz
     and performed_at <  (current_date - 2)::timestamptz;

  for v_sess in select * from jsonb_array_elements(v_plan) loop
    v_workout := gen_random_uuid();
    select string_agg(l.value->>'raw', E'\n' order by l.ordinality)
      into v_raw
      from jsonb_array_elements(v_sess->'lines') with ordinality l;
    v_when := (current_date - (v_sess->>'days_ago')::int)::timestamp + time '12:00';

    insert into public.workouts (id, user_id, performed_at, raw_text, parse_version, created_at, updated_at)
    values (v_workout, v_user, v_when, v_raw, 2, now(), now());

    v_pos := 0;
    for v_line in select * from jsonb_array_elements(v_sess->'lines') loop
      select id into v_ex from public.exercises
       where canonical = v_line->>'ex' and user_id is null
       limit 1;
      if v_ex is null then
        raise exception 'Global exercise % missing — run the initial migration first.', v_line->>'ex';
      end if;

      v_item := gen_random_uuid();
      insert into public.items (id, workout_id, position, exercise_id)
      values (v_item, v_workout, v_pos, v_ex);

      v_spos := 0;
      for v_set in select * from jsonb_array_elements(v_line->'sets') loop
        insert into public.sets (item_id, position, kind, reps, weight_kg, rir)
        values (v_item, v_spos, 'working',
                (v_set->>0)::int,
                (v_set->>1)::numeric,
                (v_set->>2)::numeric);
        v_spos := v_spos + 1;
      end loop;
      v_pos := v_pos + 1;
    end loop;
  end loop;

  -- The ghost for TODAY, exactly as the engine would phrase it after the last
  -- A-session (bench: every set of 8 at 97.5 + RIR 2 → +2.5; squat likewise).
  insert into public.predictions (user_id, for_date, ghost_text, reason)
  values (v_user, current_date,
          E'bench press 3×6  100 kg\nsquat 3×5  145 kg\npull-up 3×11',
          'Last time at 97.5 you had 2 in reserve. So +2.5.')
  on conflict (user_id, for_date) do update
    set ghost_text = excluded.ghost_text,
        reason = excluded.reason,
        created_at = now();

  raise notice 'Seeded 12 sessions (3-28 days ago) + today''s ghost for user %', v_user;
end $$;
