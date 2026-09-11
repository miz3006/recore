-- The database webhook that fires `notify-comment` (coach feature, Phase 5).
--
-- SEPARATE FROM THE COACHING MIGRATION ON PURPOSE. Everything in
-- 20260910140000 is pure schema and runs identically on any database, local or
-- hosted. This one reaches OUT of the database to an HTTP endpoint, needs
-- `pg_net`, and needs two values that differ per project (the functions URL and
-- the shared secret). Keeping it apart means `supabase db reset` on a laptop
-- still succeeds when neither is configured — the trigger is created, it simply
-- has nowhere to call, and no comment insert ever fails because of it.
--
-- A COMMENT MUST NEVER FAIL BECAUSE A NOTIFICATION COULD NOT BE SENT. That is
-- the rule this whole file is shaped around and it is the same promise
-- CLAUDE.md §2 makes about the model: the record comes first. `pg_net` is
-- asynchronous — `net.http_post` queues the request and returns immediately —
-- and the trigger additionally swallows its own exceptions, so an unconfigured
-- project, a missing extension or a dead endpoint all end with the comment
-- committed and nothing else happening.

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- WHERE THE CONFIGURATION LIVES, AND WHY IT IS A TABLE.
--
-- The obvious home for "the functions URL" and "the shared secret" is a pair of
-- database settings (`alter database postgres set app.functions_url = …`). That
-- is what this migration asked for first, and it does not work ANYWHERE:
-- setting a custom parameter needs superuser, and the `postgres` role is not
-- one — not on Supabase Cloud, and not in the local CLI stack either. Both
-- answer `42501: permission denied to set parameter`.
--
-- So the two values live in a table instead, and the table follows the pattern
-- `parse_rate_limits` already established in the initial migration: **RLS
-- enabled with NO policies**, which makes it unreachable by anon and by
-- authenticated, and readable only by the service role and by `security
-- definer` functions like the trigger below. No client can read the secret; no
-- client can even see that the row exists.
--
-- `current_setting` is still consulted as a FALLBACK, because a session-level
-- `set app.notify_webhook_secret = …` needs no privileges at all and is the
-- only way to exercise this path inside a rolled-back test transaction
-- (`supabase/tests/coaching-rls.sql` does exactly that).
-- ---------------------------------------------------------------------------
create table public.app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;
-- No policies, on purpose. Service role and security-definer functions only.

comment on table public.app_config is
  'Server-side configuration read by security-definer functions. RLS on, no policies: unreachable from any client.';

create or replace function public.notify_comment_webhook()
returns trigger
language plpgsql
security definer
-- `net`, NOT `extensions`, IS IN THE PATH, and that distinction cost a silent
-- failure. `create extension pg_net with schema extensions` installs the
-- extension there but pg_net CREATES ITS OWN `net` SCHEMA for the queue and the
-- API regardless, so `extensions.net.http_post` does not exist. The call raised
-- `schema "net" does not exist`, the exception handler below swallowed it
-- exactly as designed, and every comment committed with no request ever
-- enqueued — invisible from the application and invisible in the logs.
--
-- Found 10 September 2026 by pointing this at an HTTP interceptor and watching
-- nothing arrive, then reading `net.http_request_queue` and finding it empty.
set search_path = public, net
as $$
declare
  -- Table first, session setting second. The fallback is what lets a test
  -- transaction drive this without any privilege at all.
  v_url    text := coalesce(
                     (select value from public.app_config where key = 'functions_url'),
                     nullif(current_setting('app.functions_url', true), ''));
  v_secret text := coalesce(
                     (select value from public.app_config where key = 'notify_webhook_secret'),
                     nullif(current_setting('app.notify_webhook_secret', true), ''));
begin
  if v_url is null or v_url = '' or v_secret is null or v_secret = '' then
    return new;  -- not configured: a local database, or a project without push
  end if;

  begin
    perform net.http_post(
      url     := v_url || '/notify-comment',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_secret
      ),
      -- Only the id is actually read by the function; the rest of the row is
      -- sent because that is the shape a Supabase webhook payload has, and the
      -- function re-reads everything it uses anyway.
      body    := jsonb_build_object('type', 'INSERT', 'record', to_jsonb(new))
    );
  exception when others then
    -- The comment is already written. Nothing about delivering a notification
    -- is worth rolling that back.
    --
    -- IT WARNS, THOUGH. The first version of this handler was a bare `null`,
    -- and that is how the `extensions.net` mistake above stayed invisible: a
    -- silent catch-all turns a permanent misconfiguration into a feature that
    -- simply never fires. A WARNING keeps the promise (the comment survives)
    -- without keeping the secret. It carries SQLERRM only — never the row.
    raise warning 'notify_comment_webhook: %', sqlerrm;
  end;

  return new;
end;
$$;

create trigger workout_comments_notify
  after insert on public.workout_comments
  for each row execute function public.notify_comment_webhook();
