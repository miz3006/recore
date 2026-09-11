import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildReceipt } from './parse/receipt.ts';

import {
  canonicalLift,
  DEMO_EXAMPLE,
  demoEntryOfItem,
  demoParseText,
  demoIncrement,
  inWrittenUnit,
  leadDemoEntry,
  matchKeyLift,
  parseDemoEntries,
  parseDemoEntry,
  parseDemoLine,
  serializeDemoEntries,
  serializeDemoEntry,
  splitLineSegments,
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

/** One written line, read and packed the way the demo screen packs it. */
function entryOf(line: string) {
  const reading = parseDemoLine(line);
  assert.ok(reading, `"${line}" should read`);
  return toDemoEntry(line, reading, 'typed', true);
}

test('a whole page of lines survives a round trip through storage', () => {
  const page = ['bench 100kg 5,5,4', 'squat 120kg 5x5', 'pull ups 3x8'].map(entryOf);
  assert.deepEqual(parseDemoEntries(serializeDemoEntries(page)), page);
});

test('a malformed page degrades to no lines, and drops only the bad ones', () => {
  assert.deepEqual(parseDemoEntries(null), []);
  assert.deepEqual(parseDemoEntries('{'), []);
  // An object where a list belongs — a snapshot from before the page existed.
  assert.deepEqual(parseDemoEntries(serializeDemoEntry(entryOf('squat 120kg 5x5'))), []);
  const mixed = `[${JSON.stringify(entryOf('squat 120kg 5x5'))},{"rawText":""},null]`;
  assert.equal(parseDemoEntries(mixed).length, 1);
});

test('the lead of a page is the first line carrying a load', () => {
  const noLoad = entryOf('pull ups 3x8');
  const loaded = entryOf('squat 120kg 5x5');
  assert.equal(leadDemoEntry([noLoad, loaded]), loaded);
  // Nothing on the page carries one: the first line is still the lead.
  assert.equal(leadDemoEntry([noLoad]), noLoad);
  assert.equal(leadDemoEntry([]), null);
});

test('a line splits where a new exercise starts, and never on a rep list', () => {
  assert.deepEqual(splitLineSegments('bench 100kg 5,5,4'), ['bench 100kg 5,5,4']);
  assert.deepEqual(splitLineSegments('bench 3x8, rows 3x10'), ['bench 3x8', 'rows 3x10']);
  assert.deepEqual(splitLineSegments('pull ups 3x8 + dips 3x10'), ['pull ups 3x8', 'dips 3x10']);
  assert.deepEqual(splitLineSegments('squat 100 5x5 and bench 80 5x5'), [
    'squat 100 5x5',
    'bench 80 5x5',
  ]);
});

test('the page reads as the app’s own parse result, one item per exercise', () => {
  const result = demoParseText('bench 100kg 5,5,4\nfelt strong\nsquat 120 5x5, rows 60 3x10');
  assert.equal(result.items.length, 3);
  assert.deepEqual(
    result.items.map((i) => [i.exercise, i.line]),
    [
      ['Bench press', 0],
      ['Squat', 2],
      ['Barbell row', 2],
    ],
  );
  // Every set is a working set carrying the line's load.
  const bench = result.items[0]!;
  assert.deepEqual(
    bench.sets.map((s) => [s.kind, s.reps, s.weight_kg]),
    [
      ['working', 5, 100],
      ['working', 5, 100],
      ['working', 4, 100],
    ],
  );
  // A demo result may never wear the real parser's version number.
  assert.equal(result.parse_version, 0);
});

test('the receipt the demo page renders is the one Today renders', () => {
  const receipt = buildReceipt(demoParseText('bench 100kg 5,5,4'), []);
  const row = receipt.rows[0]!;
  assert.equal(row.exercise, 'Bench press');
  assert.equal(row.setText, '100 kg × 5·5·4');
  assert.equal(row.table.loadHead, 'KG');
  assert.equal(row.table.workHead, 'REPS');
  assert.deepEqual(
    row.table.rows.map((r) => [r.label, r.load, r.work]),
    [
      ['1', '100', '5'],
      ['2', '100', '5'],
      ['3', '100', '4'],
    ],
  );
  assert.equal(receipt.totalSets, 3);
  assert.equal(receipt.volume, 1400);
});

test('a stored answer is built from the item, with the unit as written', () => {
  const line = 'bench 225lb 5,5,4';
  const item = demoParseText(line).items[0]!;
  const entry = demoEntryOfItem(item, line);
  assert.equal(entry.exerciseName, 'Bench press');
  assert.equal(entry.unit, 'lb');
  assert.deepEqual(entry.reps, [5, 5, 4]);
  assert.ok(entry.weightKg && Math.abs(entry.weightKg - 102.06) < 0.05);
});

// ---------------------------------------------------------------------------
// A WHOLE PAGE OF EVERYTHING (10 September 2026). The demo screen takes a
// written session, not one line, and the modalities it can be handed —
// strength, a hold, a carry, a run — each render differently in the receipt.
// ---------------------------------------------------------------------------

test('a mixed session reads as one card per movement, in the order written', () => {
  const page = [
    'Push A',
    'bench 100kg 5,5,4 @8',
    'cable fly 15 3x15',
    'dips bw+20 3x10 / push ups 3x25',
    'plank 3x60s',
    'farmers carry 2x40m 32kg',
    'run 5k 24:30',
  ].join('\n');
  const result = demoParseText(page);
  assert.deepEqual(
    result.items.map((i) => [i.exercise, i.line, i.modality]),
    [
      ['Bench press', 1, 'strength'],
      ['Cable fly', 2, 'strength'],
      ['Dips', 3, 'strength'],
      ['Push ups', 3, 'strength'],
      // A duration or a distance with no reps is 'cardio' here and nothing
      // finer: telling a plank (a hold) from a bike (cardio) needs a dictionary
      // of movements, which the funnel has no account to reach. The real
      // parser, which does, answers 'hold' and 'carry' for these two.
      ['Plank', 4, 'cardio'],
      ['Farmers carry', 5, 'cardio'],
      ['Run', 6, 'cardio'],
    ],
  );

  const receipt = buildReceipt(result, []);
  assert.deepEqual(
    receipt.rows.map((r) => r.setText),
    [
      '100 kg × 5·5·4',
      '15 kg × 15·15·15',
      '20 kg × 10·10·10',
      '25·25·25',
      '3× 60 s',
      // The carry keeps its distance and the run keeps its time — one metric
      // per card used to be all the compact line could say.
      '32 kg · 2× 40 m',
      '5000 m · 24:30',
    ],
  );
  // The tonnage counts the loaded reps and nothing else; the run's five
  // kilometres are distance, not weight.
  assert.equal(receipt.distanceM, 5080);
  assert.equal(receipt.volume, 100 * 14 + 15 * 45 + 20 * 30);
  // Every card has its own identity even when two of them read alike.
  assert.equal(new Set(receipt.rows.map((r) => r.doneKey)).size, receipt.rows.length);
});

test('a page of prose and headers produces no cards at all', () => {
  const page = ['Push day', 'felt tired today', '3 rounds:', '2 min rest', 'time 7:42'].join('\n');
  assert.deepEqual(demoParseText(page).items, []);
  assert.deepEqual(buildReceipt(demoParseText(page), []).rows, []);
});
