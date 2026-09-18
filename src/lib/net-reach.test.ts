import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isOfflineError,
  onConsumed,
  onReachable,
  onSynced,
  onUnreachable,
  REACH_ONLINE,
  sameReach,
} from './net-reach.ts';

// --- what counts as "the request never left the phone" -----------------------

test('supabase-js names the two cases it has names for', () => {
  assert.equal(isOfflineError({ name: 'FunctionsFetchError', message: 'Failed to send' }), true);
  assert.equal(isOfflineError({ name: 'AuthRetryableFetchError' }), true);
});

test("React Native's own wording, whatever wraps it", () => {
  // What a failed `fetch` looks like coming back through PostgREST: an ordinary
  // error object, no class, the platform's sentence in two fields.
  assert.equal(
    isOfflineError({
      message: 'TypeError: Network request failed',
      details: 'TypeError: Network request failed',
    }),
    true,
  );
  assert.equal(isOfflineError(new TypeError('Network request failed')), true);
});

test('the other platforms say it differently and all of them count', () => {
  assert.equal(isOfflineError({ message: 'Failed to fetch' }), true);
  assert.equal(isOfflineError({ message: 'Load failed' }), true);
  assert.equal(
    isOfflineError({ message: 'The Internet connection appears to be offline.' }),
    true,
  );
  assert.equal(isOfflineError({ message: 'The network connection was lost.' }), true);
  assert.equal(isOfflineError({ name: 'AbortError' }), true);
  assert.equal(isOfflineError({ message: 'Request timed out' }), true);
});

test("the app's own deadline reads as underground, whatever drops the class", () => {
  // The shape a cut PostgREST request really takes — probed against the live
  // service on 17 September 2026. `postgrest-js` flattens the class into the
  // message and hands back an object with no `name`, so the sentence is all
  // there is to go on.
  assert.equal(
    isOfflineError({
      message: 'AbortError: This operation was aborted',
      details: 'AbortError: This operation was aborted\n    at node:internal/deps/undici',
      code: '',
    }),
    true,
  );
  // React Native words the same abort differently, and supabase-js names it
  // outright when the request went to an edge function.
  assert.equal(isOfflineError({ message: 'AbortError: Aborted' }), true);
  assert.equal(isOfflineError({ name: 'FunctionsFetchError', message: 'Failed to send' }), true);
});

test('a transaction Postgres aborted is the service talking, not a lost signal', () => {
  // The false positive a loose test for "abort" would have created: this is an
  // answer, from a database that read the request.
  assert.equal(
    isOfflineError({
      code: '25P02',
      message: 'current transaction is aborted, commands ignored until end of transaction block',
    }),
    false,
  );
});

/**
 * THE LINE THIS FILE EXISTS TO DRAW. Every one of these proves the phone got
 * through — the service read the request and refused it. Calling any of them
 * "no signal" sends somebody out of a basement to fix an outage they cannot
 * reach from anywhere.
 */
test('a service that ANSWERS is never offline, however it answers', () => {
  // PostgREST: row-level security said no.
  assert.equal(
    isOfflineError({
      code: '42501',
      message: 'new row violates row-level security policy for table "workouts"',
    }),
    false,
  );
  // A constraint.
  assert.equal(
    isOfflineError({ code: '23505', message: 'duplicate key value violates unique constraint' }),
    false,
  );
  // The edge function, down.
  assert.equal(
    isOfflineError({ name: 'FunctionsHttpError', message: 'Edge Function returned a non-2xx status code' }),
    false,
  );
  // A rate limit, an expired session, a refusal about the note itself.
  assert.equal(isOfflineError({ message: 'Too Many Requests' }), false);
  assert.equal(isOfflineError({ message: 'JWT expired' }), false);
});

test('nothing at all is not evidence of anything', () => {
  assert.equal(isOfflineError(null), false);
  assert.equal(isOfflineError(undefined), false);
  assert.equal(isOfflineError({}), false);
  assert.equal(isOfflineError({ message: '' }), false);
});

// --- the state machine -------------------------------------------------------

test('it opens online, and says nothing until something has actually failed', () => {
  assert.equal(REACH_ONLINE.offline, false);
  assert.equal(REACH_ONLINE.since, null);
  assert.equal(REACH_ONLINE.settledAt, null);
  assert.equal(REACH_ONLINE.wasOffline, false);
});

test('the first failure stamps when it started; the next ones do not move it', () => {
  const down = onUnreachable(REACH_ONLINE, 1_000);
  assert.equal(down.offline, true);
  assert.equal(down.since, 1_000);

  const stillDown = onUnreachable(down, 9_000);
  assert.equal(stillDown.since, 1_000, 'the stretch started once');
  assert.equal(stillDown, down, 'and the identical state is returned unchanged');
});

test('an answer ends it, and remembers that there was something to end', () => {
  const back = onReachable(onUnreachable(REACH_ONLINE, 1_000));
  assert.equal(back.offline, false);
  assert.equal(back.since, null);
  assert.equal(back.wasOffline, true, 'the recovery is still owed a confirmation');
});

/**
 * THE ONE RULE THE CONFIRMATION LINE RESTS ON. Being reachable again is not the
 * same as the queue having drained, and the second is what Today promised. An
 * ordinary pass — of which there are dozens an hour — may never claim a
 * recovery that never happened.
 */
test('a sync pass only confirms when there was an outage to recover from', () => {
  assert.equal(onSynced(REACH_ONLINE, 5_000).settledAt, null, 'no outage, no confirmation');

  const recovered = onSynced(onReachable(onUnreachable(REACH_ONLINE, 1_000)), 5_000);
  assert.equal(recovered.settledAt, 5_000);
  assert.equal(recovered.wasOffline, false, 'consumed — the next pass is ordinary again');

  assert.equal(
    onSynced(recovered, 9_000).settledAt,
    5_000,
    'a second pass does not re-confirm the same recovery',
  );
});

test('a pass that limped while still offline confirms nothing', () => {
  const down = onUnreachable(REACH_ONLINE, 1_000);
  assert.equal(onSynced(down, 5_000).settledAt, null);
  assert.equal(onSynced(down, 5_000).offline, true);
});

test('going under again withdraws a confirmation that has not been shown', () => {
  const recovered = onSynced(onReachable(onUnreachable(REACH_ONLINE, 1_000)), 5_000);
  const downAgain = onUnreachable(recovered, 6_000);
  assert.equal(downAgain.settledAt, null, 'the page may not say "saved" while it is not');
  assert.equal(downAgain.offline, true);
});

test('the page consumes the confirmation exactly once', () => {
  const recovered = onSynced(onReachable(onUnreachable(REACH_ONLINE, 1_000)), 5_000);
  const shown = onConsumed(recovered);
  assert.equal(shown.settledAt, null);
  assert.equal(onConsumed(shown), shown, 'and consuming nothing changes nothing');
});

test('equality is by value, so an unchanged pass never notifies a screen', () => {
  assert.equal(sameReach(REACH_ONLINE, { ...REACH_ONLINE }), true);
  assert.equal(sameReach(REACH_ONLINE, onUnreachable(REACH_ONLINE, 1)), false);
});
