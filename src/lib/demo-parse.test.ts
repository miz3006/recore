import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  canonicalLift,
  DEMO_EXAMPLE,
  demoIncrement,
  inWrittenUnit,
  matchKeyLift,
  parseDemoEntry,
  parseDemoLine,
  serializeDemoEntry,
  toDemoEntry,
  toKilograms,
} from './demo-parse.ts';

/**
 * The demo grammar's contract. Two halves matter here and they pull in opposite
 * directions: it has to read the shapes people actually write (so the aha
 * moment lands on their own line), and it has to REFUSE anything it cannot
 * honestly read (so the demo falls back to the canned example instead of
 * inventing a record).
 */

const OFFERED = ['Bench press', 'Squat', 'Deadlift', 'Overhead press', 'Pull-ups', 'Barbell row'];

test('the canned example is a line the grammar genuinely reads', () => {
  const reading = parseDemoLine(DEMO_EXAMPLE);
  assert.ok(reading);
  assert.equal(reading.exerciseName, 'Bench press');
  assert.equal(reading.weightKg, 100);
  assert.deepEqual(reading.reps, [5, 5, 4]);
  assert.equal(reading.unit, 'kg');
});

test('the acceptance line reads exactly as written', () => {
  const reading = parseDemoLine('deadlift 140kg 5,5,5');
  assert.ok(reading);
  assert.equal(reading.exerciseName, 'Deadlift');
  assert.equal(reading.weightKg, 140);
  assert.deepEqual(reading.reps, [5, 5, 5]);
});

test('sets x reps expands into one number per set', () => {
  const reading = parseDemoLine('squat 100 5x5');
  assert.ok(reading);
  assert.equal(reading.exerciseName, 'Squat');
  assert.equal(reading.weightKg, 100);
  assert.deepEqual(reading.reps, [5, 5, 5, 5, 5]);
});

test('a bodyweight movement parses with no load at all', () => {
  const reading = parseDemoLine('pull ups 3x8');
  assert.ok(reading);
  assert.equal(reading.exerciseName, 'Pull-ups');
  assert.equal(reading.weightKg, null);
  assert.deepEqual(reading.reps, [8, 8, 8]);
});

test('pounds are stored in kilograms and remembered as pounds', () => {
  const reading = parseDemoLine('bench 225 lbs 5,5,3');
  assert.ok(reading);
  assert.equal(reading.unit, 'lb');
  assert.ok(reading.weightKg! > 102 && reading.weightKg! < 102.2, `got ${reading.weightKg}`);
});

test('the weight never gets read as a set of a hundred reps', () => {
  const reading = parseDemoLine('bench 100kg 5,5,4');
  assert.ok(reading);
  assert.ok(!reading.reps.includes(100));
});

test('spacing, capitals and a trailing comment do not change the reading', () => {
  const reading = parseDemoLine('  Bench   Press  80 kg   8, 8, 7  ');
  assert.ok(reading);
  assert.equal(reading.exerciseName, 'Bench press');
  assert.equal(reading.weightKg, 80);
  assert.deepEqual(reading.reps, [8, 8, 7]);
});

test('a line with nothing to record returns null rather than a guess', () => {
  for (const gibberish of ['', '   ', 'asdfghjkl', 'felt strong today', '12345', 'x', 'bench']) {
    assert.equal(parseDemoLine(gibberish), null, `"${gibberish}" should not parse`);
  }
});

test('an absurd load is a typo, not a record', () => {
  assert.equal(parseDemoLine('bench 9000kg 5,5,5'), null);
});

test('shorthand resolves to the name the rest of the flow uses', () => {
  assert.equal(canonicalLift('bp'), 'Bench press');
  assert.equal(canonicalLift('ohp'), 'Overhead press');
  assert.equal(canonicalLift('DL'), 'Deadlift');
  assert.equal(canonicalLift('back squat'), 'Squat');
  assert.equal(canonicalLift('bent over row'), 'Barbell row');
  assert.equal(canonicalLift('leg extension'), null);
});

test('"bench press" never loses to the shorter "press" alias', () => {
  assert.equal(canonicalLift('bench press'), 'Bench press');
});

test('an unknown movement keeps the words the person wrote', () => {
  const reading = parseDemoLine('incline db press 30kg 12,12');
  assert.ok(reading);
  assert.equal(reading.exerciseName, 'Incline db press');
});

test('a demo line maps onto the key-lift chips, or onto nothing', () => {
  assert.equal(matchKeyLift('bench', OFFERED), 'Bench press');
  assert.equal(matchKeyLift('Deadlift', OFFERED), 'Deadlift');
  assert.equal(matchKeyLift('Incline db press', OFFERED), null);
});

test('units convert both ways and land on a real plate jump', () => {
  assert.equal(toKilograms(100, 'kg'), 100);
  assert.ok(Math.abs(toKilograms(225, 'lb') - 102.06) < 0.05);
  assert.equal(inWrittenUnit(100, 'kg'), 100);
  assert.equal(inWrittenUnit(102.06, 'lb'), 225);
  assert.equal(demoIncrement('kg'), 2.5);
  assert.equal(demoIncrement('lb'), 5);
});

test('an entry survives a round trip through storage', () => {
  const reading = parseDemoLine('deadlift 140kg 5,5,5')!;
  const entry = toDemoEntry('deadlift 140kg 5,5,5', reading, 'typed', true);
  const back = parseDemoEntry(serializeDemoEntry(entry));
  assert.deepEqual(back, entry);
});

test('a malformed or older stored answer degrades to no demo, never a crash', () => {
  assert.equal(parseDemoEntry(null), null);
  assert.equal(parseDemoEntry(''), null);
  assert.equal(parseDemoEntry('{'), null);
  assert.equal(parseDemoEntry('[]'), null);
  assert.equal(parseDemoEntry('{"rawText":"","exerciseName":"Squat"}'), null);
  const partial = parseDemoEntry('{"rawText":"squat 100 5x5","exerciseName":"Squat"}');
  assert.deepEqual(partial, {
    rawText: 'squat 100 5x5',
    exerciseName: 'Squat',
    weightKg: null,
    reps: [],
    source: 'typed',
    parsedLocally: true,
    unit: 'kg',
  });
});
