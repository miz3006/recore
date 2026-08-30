import assert from 'node:assert/strict';
import { test } from 'node:test';

import { explain, groupOf, groupsOf } from './groups.ts';
import type { SessionRow } from './sections.ts';

const ROW: SessionRow = {
  key: 'bench press',
  name: 'Bench press',
  canonical: 'Bench press',
  move: null,
  bestKg: null,
  last: null,
  lastDay: null,
  prescription: '82.5 × 5·5·5',
  loadKg: 82.5,
  scheme: '5·5·5',
  beatsBest: false,
  why: null,
  watch: null,
  note: null,
};

const row = (over: Partial<SessionRow>): SessionRow => ({ ...ROW, ...over });

test('adding weight and adding a rep are both going up', () => {
  assert.equal(groupOf(row({ move: { kind: 'weight', deltaKg: 2.5 } })), 'up');
  assert.equal(groupOf(row({ move: { kind: 'rep' } })), 'up');
});

test('a plateau outranks the lever, exactly as it does in the reason line', () => {
  const stuck = row({ move: { kind: 'weight', deltaKg: 2.5 }, watch: { sessions: 3, deloadTo: 75 } });
  assert.equal(groupOf(stuck), 'hold', 'three sessions here is the fact that changes what you do');
});

test('a backoff is its own group, never filed under holding', () => {
  assert.equal(groupOf(row({ move: { kind: 'backoff', fromKg: 90, toKg: 85 } })), 'backoff');
});

test('a row with no prescription has no history yet', () => {
  assert.equal(groupOf(row({ prescription: null, loadKg: null })), 'new');
});

test('a prescription with no lever is counted in NO group — a summary never guesses', () => {
  assert.equal(groupOf(row({ move: null })), null);
});

test('the strip runs in one fixed order, whatever order the session is in', () => {
  const groups = groupsOf([
    row({ key: 'a', move: { kind: 'backoff', fromKg: 90, toKg: 85 } }),
    row({ key: 'b', prescription: null, loadKg: null }),
    row({ key: 'c', move: { kind: 'weight', deltaKg: 2.5 } }),
    row({ key: 'd', move: { kind: 'hold' } }),
  ]);
  assert.deepEqual(groups.map((g) => g.key), ['up', 'hold', 'backoff', 'new']);
});

test('empty groups never render a pill', () => {
  const groups = groupsOf([row({ move: { kind: 'weight', deltaKg: 2.5 } })]);
  assert.deepEqual(groups.map((g) => g.key), ['up']);
});

test('the session order survives inside a group — the strip counts, it does not sort', () => {
  const groups = groupsOf([
    row({ key: 'first', name: 'Bench press', move: { kind: 'weight', deltaKg: 2.5 } }),
    row({ key: 'second', name: 'Lateral raise', move: { kind: 'rep' } }),
  ]);
  assert.deepEqual(groups[0]!.rows.map((r) => r.name), ['Bench press', 'Lateral raise']);
});

test('nothing to group is no strip at all', () => {
  assert.deepEqual(groupsOf([]), []);
});

test('the explainer counts in the athlete\'s own units and never says "1 lifts"', () => {
  assert.match(explain('up', 1).title, /^1 lift moving up$/);
  assert.match(explain('up', 3).title, /^3 lifts moving up$/);
});

test('every group can explain itself', () => {
  for (const key of ['up', 'hold', 'backoff', 'new'] as const) {
    const e = explain(key, 2);
    assert.ok(e.title.length > 0, key);
    assert.ok(e.body.length > 30, `${key} body should be a real explanation`);
  }
});
