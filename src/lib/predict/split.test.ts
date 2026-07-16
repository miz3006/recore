import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clusterSessions, jaccard, pickNextSession, type SessionExercises } from './split.ts';

// Exercise-id shorthands: push / pull / legs / full-body day compositions.
const PUSH = ['bench', 'ohp', 'dips', 'lateral'];
const PUSH_B = ['bench', 'incline', 'ohp', 'fly'];
const PULL = ['row', 'pullup', 'curl', 'facepull'];
const LEGS = ['squat', 'rdl', 'legpress', 'calf'];
const FULL = ['squat', 'bench', 'row'];

let n = 0;
const s = (exerciseIds: string[]): SessionExercises => ({ id: `w${n++}`, exerciseIds });

test('jaccard basics', () => {
  assert.equal(jaccard(new Set(['a', 'b']), new Set(['a', 'b'])), 1);
  assert.equal(jaccard(new Set(['a', 'b']), new Set(['c', 'd'])), 0);
  assert.equal(jaccard(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'd'])), 0.5);
  assert.equal(jaccard(new Set(), new Set()), 0);
});

test('clusters a PPL week into three labels', () => {
  const labels = clusterSessions([s(PUSH), s(PULL), s(LEGS), s(PUSH), s(PULL), s(LEGS)]);
  assert.deepEqual(labels, [0, 1, 2, 0, 1, 2]);
});

test('PPL rotation: after push, predicts the latest pull session', () => {
  const sessions = [s(PUSH), s(PULL), s(LEGS), s(PUSH), s(PULL), s(LEGS), s(PUSH)];
  const picked = pickNextSession(sessions);
  assert.equal(picked, sessions[4]!.id, 'most recent PULL');
});

test('A/B alternation: after A, predicts the latest B', () => {
  const sessions = [s(PUSH), s(PULL), s(PUSH), s(PULL), s(PUSH)];
  const picked = pickNextSession(sessions);
  assert.equal(picked, sessions[3]!.id);
});

test('full-body every time → null (fallback to last)', () => {
  assert.equal(pickNextSession([s(FULL), s(FULL), s(FULL), s(FULL)]), null);
});

test('fewer than three sessions → null', () => {
  assert.equal(pickNextSession([s(PUSH), s(PULL)]), null);
});

test('one full cycle is enough: unique successor observed once', () => {
  const sessions = [s(PUSH), s(PULL), s(LEGS), s(PUSH)];
  const picked = pickNextSession(sessions);
  assert.equal(picked, sessions[1]!.id, 'the only PULL yet');
});

test('contradictory successors with no majority → null', () => {
  // After PUSH: once PULL, once LEGS — no signal.
  const sessions = [s(PUSH), s(PULL), s(PUSH), s(LEGS), s(PUSH)];
  assert.equal(pickNextSession(sessions), null);
});

test('dominant successor wins over a one-off deviation', () => {
  // P→Pu, P→Pu, P→L, then P: Pu has 2, L has 1 → Pu.
  const sessions = [
    s(PUSH), s(PULL),
    s(PUSH), s(PULL),
    s(PUSH), s(LEGS),
    s(PUSH),
  ];
  const picked = pickNextSession(sessions);
  assert.equal(picked, sessions[3]!.id, 'most recent PULL');
});

test('push variants drift into the same rotation slot via unique successor', () => {
  // PPL where push alternates A/B compositions: PA and PB form separate
  // clusters, but each still uniquely precedes PULL.
  const sessions = [s(PUSH), s(PULL), s(LEGS), s(PUSH_B), s(PULL), s(LEGS), s(PUSH)];
  const picked = pickNextSession(sessions);
  assert.equal(picked, sessions[4]!.id, 'most recent PULL');
});

test('no rest-day awareness needed: rotation is positional, not calendar', () => {
  // Same PPL but conceptually with rest gaps — input carries no dates at all.
  const sessions = [s(LEGS), s(PUSH), s(PULL), s(LEGS), s(PUSH)];
  const picked = pickNextSession(sessions);
  assert.equal(picked, sessions[2]!.id, 'PULL follows PUSH');
});
