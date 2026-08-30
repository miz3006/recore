import assert from 'node:assert/strict';
import test from 'node:test';

import { incrementKg, sessionsPerStep } from './flow.ts';
import { firstSessionTargets, kg, PROJECTION_WEEKS, projectionFor } from './projection.ts';
import type { V2Answers } from '../../state/onboarding-v2.ts';

/**
 * CLAUDE.md §2 rule 3: every load and every progression calculation comes from
 * code. That makes this arithmetic testable, and it is the only part of the
 * flow where being wrong would put a false number in front of a person.
 */

function answers(partial: Partial<V2Answers> = {}): V2Answers {
  return {
    tracker: null,
    obstacles: [],
    attribution: null,
    demoText: '',
    demoEntries: [],
    name: '',
    goal: null,
    experience: null,
    frequency: null,
    split: null,
    keyLifts: [],
    liftLoads: {},
    smallestPlateKg: null,
    committed: false,
    recap: null,
    notificationsGranted: null,
    ...partial,
  };
}

test('no key lift means no projection — nothing is invented to draw', () => {
  assert.equal(projectionFor(answers()), null);
  assert.equal(projectionFor(answers({ keyLifts: ['Bench press'] })), null);
});

test('the projection starts at exactly the load that was typed', () => {
  const p = projectionFor(
    answers({ keyLifts: ['Bench press'], liftLoads: { 'Bench press': 82.5 }, experience: '6m2y' }),
  );
  assert.ok(p);
  assert.equal(p.startKg, 82.5);
  assert.equal(p.series[0], 82.5);
  assert.equal(p.series.length, PROJECTION_WEEKS + 1);
});

test('experience picks the increment and how often it lands', () => {
  assert.equal(incrementKg('under6m'), 5);
  assert.equal(incrementKg('over5y'), 1.25);
  assert.equal(sessionsPerStep('under6m'), 1);
  assert.equal(sessionsPerStep('over5y'), 4);

  const novice = projectionFor(
    answers({ keyLifts: ['Squat'], liftLoads: { Squat: 60 }, experience: 'under6m' }),
  );
  const veteran = projectionFor(
    answers({ keyLifts: ['Squat'], liftLoads: { Squat: 60 }, experience: 'over5y' }),
  );
  assert.ok(novice && veteran);
  // A novice adds 5 kg every week; a five-year lifter adds 1.25 every fourth.
  assert.equal(novice.endKg, 60 + 5 * 12);
  assert.equal(veteran.endKg, 60 + 1.25 * 3);
  assert.ok(novice.endKg > veteran.endKg);
});

test('the series never goes down', () => {
  const p = projectionFor(
    answers({ keyLifts: ['Deadlift'], liftLoads: { Deadlift: 100 }, experience: '2y5y' }),
  );
  assert.ok(p);
  for (let i = 1; i < p.series.length; i += 1) {
    assert.ok(p.series[i] >= p.series[i - 1]);
  }
  assert.equal(p.endKg, p.series[p.series.length - 1]);
});

test('a first-session target is the typed load plus the stated increment', () => {
  const a = answers({
    keyLifts: ['Bench press', 'Squat'],
    liftLoads: { 'Bench press': 80, Squat: 100 },
    experience: '6m2y',
  });
  const targets = firstSessionTargets(a);
  assert.equal(targets.length, 2);
  for (const target of targets) {
    // This is the claim screen 17 prints out loud. If it ever stops holding,
    // the sentence under the number becomes a lie.
    assert.equal(target.targetKg, target.currentKg + target.addedKg);
    assert.equal(target.addedKg, 2.5);
    assert.ok(target.sets >= 3);
  }
  assert.equal(targets[0].targetKg, 82.5);
});

test('the goal answer only ever changes the set count', () => {
  const base = { keyLifts: ['Bench press'], liftLoads: { 'Bench press': 80 }, experience: '6m2y' };
  const strength = firstSessionTargets(answers({ ...base, goal: 'strength' }))[0];
  const hypertrophy = firstSessionTargets(answers({ ...base, goal: 'hypertrophy' }))[0];
  assert.equal(strength.targetKg, hypertrophy.targetKg);
  assert.ok(hypertrophy.sets > strength.sets);
});

test('loads are written the way English writes them', () => {
  assert.equal(kg(82.5), '82.5');
  assert.equal(kg(80), '80');
  assert.equal(kg(1.25), '1.25');
});
