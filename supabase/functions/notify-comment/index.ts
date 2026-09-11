// notify-comment — Supabase Edge Function (coach feature, Phase 5).
//
// Fired by a database webhook on INSERT into `workout_comments`. It works out
// who the OTHER party is and sends them one Expo push notification.
//
// SECURITY MODEL. This is the first function in the project that is NOT called
// by a signed-in client, so it cannot use the pattern the other four share
// (verify a JWT, act as that user). It is called by Postgres. Therefore:
//
//  - `verify_jwt = false` in config.toml, because there is no user token in a
//    trigger's outbound request. That is not a relaxation — it is replaced by
//    a shared secret the caller must present in `x-webhook-secret`, compared in
//    CONSTANT TIME, and the function answers 401 to anything without it. The
//    secret is set with `supabase secrets set NOTIFY_WEBHOOK_SECRET=...` and
//    the same value goes into the trigger (see the coaching-webhook migration).
//  - The body is a trigger payload, not user input, but it is treated as input
//    anyway: only `record.id` is read from it, and every other fact —
//    who wrote the comment, who owns the workout, who is linked to whom — is
//    re-read from the database with the service-role key. A forged body with a
//    real id can therefore only cause the correct notification to be sent.
//  - No PII is logged. Not the body, not the names, not the tokens.
//
// WHY IT RE-READS INSTEAD OF TRUSTING THE PAYLOAD. The webhook payload contains
// the whole inserted row, including `author_id` and `body`, and using them
// directly would save a round trip. It would also mean that anyone who learned
// the secret could make this function push arbitrary text to arbitrary users.
// Reading the row back by id makes the secret worth only "send a notification
// that was already going to be sent".

import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** The notification body is a PREVIEW, not the message. Long enough to know
 * whether it needs answering now, short enough that it is not the message
 * itself arriving outside the app. */
const PREVIEW_CHARS = 80;

/** Constant-time compare: a plain `===` on a secret leaks its length and its
 * matching prefix through timing. Cheap here, and free of a dependency. */
function secretMatches(given: string | null, expected: string): boolean {
  if (!given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405 });
  }

  const expected = Deno.env.get('NOTIFY_WEBHOOK_SECRET');
  if (!expected) {
    // Fail CLOSED. An unset secret must never mean "let everything through".
    console.error('notify-comment: NOTIFY_WEBHOOK_SECRET is not set');
    return new Response(JSON.stringify({ error: 'not_configured' }), { status: 500 });
  }
  if (!secretMatches(req.headers.get('x-webhook-secret'), expected)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  let commentId: string | null = null;
  try {
    const payload = await req.json();
    const id = payload?.record?.id;
    if (typeof id === 'string') commentId = id;
  } catch {
    return new Response(JSON.stringify({ error: 'bad_payload' }), { status: 400 });
  }
  if (!commentId) return new Response(JSON.stringify({ error: 'bad_payload' }), { status: 400 });

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Everything below is re-read, never taken from the payload.
  const { data: comment } = await db
    .from('workout_comments')
    .select('id, workout_id, exercise_ref, author_id, body')
    .eq('id', commentId)
    .single();
  if (!comment) return new Response(JSON.stringify({ ok: true, skipped: 'gone' }));

  const { data: workout } = await db
    .from('workouts')
    .select('id, user_id')
    .eq('id', comment.workout_id)
    .single();
  if (!workout) return new Response(JSON.stringify({ ok: true, skipped: 'gone' }));

  // WHO GETS IT. The author is either the workout's owner (the client) or their
  // coach; the recipient is whichever of the two they are not. If the link is
  // gone, nobody is notified — a revoked coach must not keep receiving a
  // client's replies, and that is checked HERE as well as in RLS.
  let recipient: string | null = null;
  if (comment.author_id === workout.user_id) {
    const { data: link } = await db
      .from('coach_clients')
      .select('coach_id')
      .eq('client_id', workout.user_id)
      .eq('status', 'active')
      .maybeSingle();
    recipient = link?.coach_id ?? null;
  } else {
    const { data: link } = await db
      .from('coach_clients')
      .select('coach_id')
      .eq('client_id', workout.user_id)
      .eq('coach_id', comment.author_id)
      .eq('status', 'active')
      .maybeSingle();
    recipient = link ? workout.user_id : null;
  }
  if (!recipient) return new Response(JSON.stringify({ ok: true, skipped: 'no_active_link' }));

  const { data: author } = await db
    .from('profiles')
    .select('display_name')
    .eq('id', comment.author_id)
    .single();

  const { data: tokens } = await db
    .from('push_tokens')
    .select('token')
    .eq('user_id', recipient);
  if (!tokens?.length) return new Response(JSON.stringify({ ok: true, skipped: 'no_tokens' }));

  const messages = tokens.map((t) => ({
    to: t.token as string,
    title: author?.display_name ?? 'Recore',
    body:
      comment.body.length > PREVIEW_CHARS
        ? `${comment.body.slice(0, PREVIEW_CHARS).trimEnd()}…`
        : comment.body,
    // What the tap needs to land on the right thread (Phase 5, last bullet).
    data: { workoutId: comment.workout_id, exerciseRef: comment.exercise_ref ?? null },
    sound: 'default' as const,
  }));

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });

  // DEAD TOKENS ARE REMOVED, not retried forever. Expo reports a reinstalled or
  // deleted app as `DeviceNotRegistered`, and a token that answers that once
  // will answer it every time — left in place it turns every future comment
  // into a guaranteed failed send.
  try {
    const body = await res.json();
    const tickets: unknown[] = Array.isArray(body?.data) ? body.data : [];
    const dead: string[] = [];
    tickets.forEach((ticket, i) => {
      const t = ticket as { status?: string; details?: { error?: string } };
      if (t?.status === 'error' && t?.details?.error === 'DeviceNotRegistered') {
        const token = messages[i]?.to;
        if (token) dead.push(token);
      }
    });
    if (dead.length) {
      await db.from('push_tokens').delete().eq('user_id', recipient).in('token', dead);
    }
  } catch {
    // A malformed ticket list is not a reason to fail the notification that was
    // already accepted. Nothing is logged — the response can contain tokens.
  }

  return new Response(JSON.stringify({ ok: true, sent: messages.length }));
});
