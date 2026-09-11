// delete-account — Supabase Edge Function (CLAUDE.md §11, PLAN D1).
//
// Apple requires in-app account deletion wherever an account can be created
// in-app, and the You screen used to answer that with an Alert promising
// deletion "within 30 days" while doing nothing. This is the real thing, and it
// is immediate.
//
// WHY A FUNCTION AND NOT A CLIENT DELETE. RLS lets a client delete its own
// rows, but nothing lets a client delete its own row in `auth.users` — that
// needs the service-role key, which may never leave the server (§7.3, and the
// same rule that keeps the model key here). Every table in this schema
// references `auth.users ... on delete cascade`, so deleting the auth user
// takes profiles, workouts, items, sets, exercises, predictions, plan_days,
// corrections, alias_overrides and the rate-limit row with it in one statement.
//
// SECURITY MODEL
//  - AUTH: verify_jwt in config.toml AND an explicit getUser() here. The id
//    deleted is the one in the verified token; a user_id in the body is never
//    read. That is the whole reason this cannot delete someone else's account.
//  - NO INPUT: the request has no body worth parsing, so there is no input to
//    validate and nothing to inject.
//  - PII: nothing about the account is logged, including on failure.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { corsHeaders } from '../_shared/cors.ts';

const RATE_LIMIT_MAX_CALLS = 30;
const RATE_LIMIT_WINDOW_SECONDS = 600; // shared bump_parse_rate window

Deno.serve(async (req) => {
  // Per request, because the allow-list reflects the caller's own origin (S11).
  const cors = corsHeaders(req);
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
    error: authError,
  } = await supabaseUser.auth.getUser();
  if (authError || !user) return json({ error: 'unauthorized' }, 401);

  const supabaseService = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // RATE LIMIT (S12) — shares the per-user window with the three AI functions.
  //
  // The blast radius here is one row and it is the caller's own, so this is not
  // about protecting other accounts. It is that this was a free authenticated
  // endpoint doing real work with the service-role key, and every other
  // function that does real work is metered. A person deleting their account
  // does it once; a loop hitting it does not, and the deletion cascade is the
  // most expensive statement in this schema.
  const { data: allowed, error: rateError } = await supabaseService.rpc('bump_parse_rate', {
    p_user: user.id,
    p_max: RATE_LIMIT_MAX_CALLS,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
  });
  if (rateError) return json({ error: 'rate_limit_unavailable' }, 500);
  if (!allowed) return json({ error: 'rate_limited' }, 429);

  const { error } = await supabaseService.auth.admin.deleteUser(user.id);
  if (error) {
    // Say that it failed; never say which account, and never echo the message
    // back to a client that has no use for it.
    console.error('delete-account failed');
    return json({ error: 'delete_failed' }, 500);
  }

  return json({ deleted: true });
});
