import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  patternOf,
  sharesOf,
  suggestSplitLabel,
  type SessionExercise,
} from './pattern.ts';

const ex = (canonical: string, sets = 3): SessionExercise => ({ canonical, sets });

test('the obvious ones land where a lifter would put them', () => {
  assert.equal(patternOf('Bench Press'), 'push');
  assert.equal(patternOf('Overhead Press'), 'push');
  assert.equal(patternOf('Triceps Pushdown'), 'push');
  assert.equal(patternOf('Lateral Raise'), 'push');
  assert.equal(patternOf('Barbell Row'), 'pull');
  assert.equal(patternOf('Pull-up'), 'pull');
  assert.equal(patternOf('Biceps Curl'), 'pull');
  assert.equal(patternOf('Lat Pulldown'), 'pull');
  assert.equal(patternOf('Back Squat'), 'legs');
  assert.equal(patternOf('Hip Thrust'), 'legs');
  assert.equal(patternOf('Calf Raise'), 'legs');
});

// Every one of these is a name whose words point at the wrong pattern. They are
// the reason `RULES` is ordered, and re-ordering it breaks exactly these.
test('name collisions resolve by rule order, not by the words in the name', () => {
  assert.equal(patternOf('Leg Press'), 'legs', 'contains "press" but is not a push');
  assert.equal(patternOf('Leg Curl'), 'legs', 'contains "curl" but is not a pull');
  assert.equal(patternOf('Leg Extension'), 'legs');
  assert.equal(patternOf('Hanging Leg Raise'), 'core', 'contains "leg" but is not a leg day');
  assert.equal(patternOf('Rear Delt Fly'), 'pull', 'contains "fly" but is the most pull thing there is');
  assert.equal(patternOf('Reverse Pec Deck'), 'pull');
  assert.equal(patternOf('Face Pull'), 'pull');
});

test('spelling variants of one movement are one movement', () => {
  assert.equal(patternOf('push-up'), 'push');
  assert.equal(patternOf('Push Up'), 'push');
  assert.equal(patternOf('pushup'), 'push');
  assert.equal(patternOf('  PULL-UPS  '), 'pull');
});

// The deadlift note in the module header, as an executable claim.
test('contested movements refuse to vote', () => {
  assert.equal(patternOf('Deadlift'), null);
  assert.equal(patternOf('Romanian Deadlift'), null);
  assert.equal(patternOf('Upright Row'), null);
  assert.equal(patternOf('Dumbbell Pullover'), null);
  assert.equal(patternOf('Power Clean'), null);
  assert.equal(patternOf('Good Morning'), null);
});

test('an unknown name is unknown, not guessed', () => {
  assert.equal(patternOf('Zercher Widowmaker'), null);
  assert.equal(patternOf(''), null);
  assert.equal(patternOf('   '), null);
});

test('shares are counted by working SET, never by exercise', () => {
  // Four sets of bench against one set of curls: a push day by volume, an even
  // split by exercise count. Volume is what the athlete means.
  const s = sharesOf([ex('Bench Press', 4), ex('Biceps Curl', 1)]);
  assert.equal(s.total, 5);
  assert.equal(s.push, 0.8);
  assert.equal(s.pull, 0.2);
  assert.equal(suggestSplitLabel([ex('Bench Press', 4), ex('Biceps Curl', 1)]), 'Push');
});

test('unknown sets dilute confidence rather than being ignored', () => {
  const s = sharesOf([ex('Bench Press', 2), ex('Zercher Widowmaker', 3)]);
  assert.equal(s.unknown, 0.6);
  assert.equal(s.push, 0.4);
  // 40 % push is not a push day, and the sheet must open with an empty field.
  assert.equal(suggestSplitLabel([ex('Bench Press', 2), ex('Zercher Widowmaker', 3)]), null);
});

test('the owner’s own example reads as Push', () => {
  const session = [
    ex('Bench Press'),
    ex('Chest Fly'),
    ex('Shoulder Press'),
    ex('Lateral Raise'),
    ex('Triceps Pushdown'),
  ];
  assert.equal(suggestSplitLabel(session), 'Push');
});

test('a pure day is named for its pattern, never "Upper"', () => {
  assert.equal(suggestSplitLabel([ex('Barbell Row'), ex('Pull-up'), ex('Biceps Curl')]), 'Pull');
  assert.equal(suggestSplitLabel([ex('Back Squat'), ex('Leg Press'), ex('Calf Raise')]), 'Legs');
});

test('push and pull together, with no legs, is an upper day', () => {
  assert.equal(suggestSplitLabel([ex('Bench Press'), ex('Barbell Row'), ex('Lateral Raise'), ex('Biceps Curl')]), 'Upper');
});

test('both halves present is a full body day', () => {
  assert.equal(suggestSplitLabel([ex('Back Squat', 4), ex('Bench Press', 3), ex('Barbell Row', 3)]), 'Full body');
});

test('nothing to go on returns null, not a default', () => {
  assert.equal(suggestSplitLabel([]), null);
  assert.equal(suggestSplitLabel([ex('Bench Press', 0)]), null);
  assert.equal(suggestSplitLabel([ex('Deadlift', 5)]), null, 'one contested movement names nothing');
});

test('a legs day carrying a deadlift is still a legs day', () => {
  // The contested set does not vote, but it does count in the denominator:
  // 6 of 9 sets are legs = 0.67, just over the line.
  const label = suggestSplitLabel([ex('Back Squat', 3), ex('Leg Press', 3), ex('Deadlift', 3)]);
  assert.equal(label, 'Legs');
});
