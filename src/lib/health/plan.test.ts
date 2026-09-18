import assert from 'node:assert/strict';
import { test } from 'node:test';

import { activityForModalities, healthSkipReason, planHealthWorkout } from './plan.ts';

/** A span of `minutes`, starting at a fixed instant so nothing here reads a clock. */
function span(minutes: number): { createdAt: string; updatedAt: string } {
  const start = Date.parse('2026-09-17T17:00:00.000Z');
  return {
    createdAt: new Date(start).toISOString(),
    updatedAt: new Date(start + minutes * 60_000).toISOString(),
  };
}

test('a read session with a plausible span is written, start and end from the record', () => {
  const plan = planHealthWorkout({ ...span(62), modalities: ['strength'] });
  assert.ok(plan);
  assert.equal(plan!.startIso, '2026-09-17T17:00:00.000Z');
  assert.equal(plan!.endIso, '2026-09-17T18:02:00.000Z');
  assert.equal(plan!.minutes, 62);
  assert.equal(plan!.activity, 'strength');
});

test('a note typed from memory is not a timed session, so Health never sees it', () => {
  assert.equal(planHealthWorkout({ ...span(4), modalities: ['strength'] }), null);
});

test('a note left open overnight is not a session either', () => {
  assert.equal(planHealthWorkout({ ...span(9 * 60), modalities: ['strength'] }), null);
});

test('a session nobody has read yet waits instead of going in as a guess', () => {
  assert.equal(planHealthWorkout({ ...span(62), modalities: [] }), null);
});

test('a missing timestamp is a refusal, never a zero-length workout', () => {
  assert.equal(planHealthWorkout({ createdAt: null, updatedAt: null, modalities: ['strength'] }), null);
  assert.equal(
    planHealthWorkout({ createdAt: 'not a date', updatedAt: 'nor this', modalities: ['strength'] }),
    null,
  );
});

test('anything loaded, carried or held makes the session strength training', () => {
  assert.equal(activityForModalities(['strength']), 'strength');
  assert.equal(activityForModalities(['carry']), 'strength');
  assert.equal(activityForModalities(['hold']), 'strength');
  assert.equal(activityForModalities(['strength', 'cardio']), 'strength');
  assert.equal(activityForModalities(['cardio', 'hold']), 'strength');
});

test('only a session that is nothing but cardio is filed as cardio', () => {
  assert.equal(activityForModalities(['cardio']), 'cardio');
  assert.equal(activityForModalities(['cardio', 'cardio']), 'cardio');
});

test('a modality this file has never heard of still counts as training', () => {
  // A parser that grows a fifth modality must not silently stop a session
  // reaching Health.
  assert.equal(activityForModalities(['rowing-machine-thing']), 'strength');
});

test('an empty session has no activity at all — no default, no "Other"', () => {
  assert.equal(activityForModalities([]), null);
});

test('the skip reason names the condition that failed, and is silent when none did', () => {
  assert.equal(healthSkipReason({ ...span(62), modalities: ['strength'] }), null);
  assert.match(healthSkipReason({ ...span(62), modalities: [] })!, /has not read this session/);
  assert.match(healthSkipReason({ ...span(4), modalities: ['strength'] })!, /less than 10 minutes/);
  assert.match(healthSkipReason({ ...span(4), modalities: ['strength'] })!, /more than 6 hours/);
});
