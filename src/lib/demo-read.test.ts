import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { readWrittenLine } from './demo-read.ts';

/**
 * THE OFFLINE READING ENGINE, SCORED AGAINST THE REAL PARSER'S OWN CORPUS.
 *
 * `scripts/parse-eval-cases.json` is what the edge function is evaluated with —
 * 79 lines of how people actually write, English and Slovene, collected for the
 * model. The demo screen cannot call that function (no account exists on the
 * fourth screen of a funnel), so it reads with `demo-read.ts` — and the only
 * way "it reads well now" survives the next change is if it is a NUMBER in a
 * test rather than a claim in a commit message.
 *
 * Two floors, both deliberately below where the engine sits today, so an
 * ordinary refactor does not fail the suite and a regression does:
 *
 *  · it must READ at least 70 of the 79 lines (it reads 77);
 *  · and it must get the exercise COUNT right on at least 60 (it gets 66).
 *
 * WHAT IT DOES NOT CHASE, and why: word numerals ("three sets of eight at
 * eighty kilos"), plate-number lb inference ("185x5x3" as 185 lb), superset
 * grouping, and the canonical exercise NAMES — those come from the app's
 * exercise table, which the funnel has no access to before an account. Each is
 * a model's job or a database's, and pretending otherwise here would trade a
 * missed read for a wrong one.
 */
const CASES: EvalCase[] = JSON.parse(
  readFileSync(path.join(import.meta.dirname, '..', '..', 'scripts', 'parse-eval-cases.json'), 'utf8'),
);

interface EvalCase {
  name: string;
  input: string;
  expect: { exercise: string; line?: number; sets?: number; reps?: number; weight_kg?: number | null }[];
}

/** Every exercise the engine finds in a whole written page. */
function readPage(input: string) {
  return input.split('\n').flatMap((line, index) => readWrittenLine(line).map((item) => ({ ...item, line: index })));
}

test('the engine reads at least 70 of the 79 lines the real parser is scored on', () => {
  const read = CASES.filter((c) => readPage(c.input).length > 0);
  assert.ok(
    read.length >= 70,
    `only ${read.length}/${CASES.length} read — ${CASES.filter((c) => readPage(c.input).length === 0)
      .map((c) => JSON.stringify(c.input))
      .join(', ')}`,
  );
});

test('and finds the right NUMBER of exercises on at least 60 of them', () => {
  const right = CASES.filter((c) => readPage(c.input).length === c.expect.length);
  assert.ok(right.length >= 60, `only ${right.length}/${CASES.length} matched the expected item count`);
});

test('a load and its reps are never read as a set count', () => {
  // The defect that started this: "100x8 90x10 80x12" came back as a hundred
  // sets of eight, which is not a missed read, it is a wrong one.
  const [bench] = readWrittenLine('bench 100x8 90x10 80x12');
  assert.equal(bench!.sets.length, 3);
  assert.deepEqual(
    bench!.sets.map((s) => [s.weightKg, s.reps]),
    [
      [100, 8],
      [90, 10],
      [80, 12],
    ],
  );

  const [dl] = readWrittenLine('dl 140x5, 160x3, 180x1');
  assert.deepEqual(
    dl!.sets.map((s) => [s.weightKg, s.reps]),
    [
      [140, 5],
      [160, 3],
      [180, 1],
    ],
  );
});

test('sets, reps and load are told apart by their sizes', () => {
  const shape = (line: string) =>
    readWrittenLine(line)[0]!.sets.map((s) => [s.weightKg, s.reps] as const);

  assert.deepEqual(shape('bench 3x8 80kg'), [
    [80, 8],
    [80, 8],
    [80, 8],
  ]);
  // Small on the left is a set count; small on the right is how many times.
  assert.equal(shape('dips 2x16 1x15').length, 3);
  assert.equal(shape('dips 15x2 16x1').length, 3);
  // Neither is small: 24 kg for twenty, not twenty sets.
  assert.deepEqual(shape('kb swing 24 x20'), [[24, 20]]);
});

test('a rep list outranks the pair in front of it', () => {
  const [incline] = readWrittenLine('Incline DB press 35 kg x 8 (rir 2)/ 9 (rir 0) / 8 (rir -1)');
  assert.deepEqual(
    incline!.sets.map((s) => s.reps),
    [8, 9, 8],
  );
  assert.ok(incline!.sets.every((s) => s.weightKg === 35));
});

test('prose after a comma never becomes an exercise', () => {
  const items = readWrittenLine('squat 5x5 140kg, last 2 were grindy');
  assert.equal(items.length, 1);
  assert.equal(items[0]!.name, 'Squat');
  assert.equal(items[0]!.sets.length, 5);

  assert.equal(readWrittenLine('bench 5x5 100kg, pavza 3 min').length, 1);
  assert.equal(readWrittenLine('veslanje z drogom 60kg 3x10, še 2 v rezervi').length, 1);
});

test('a continuation belongs to the movement before it, at its load', () => {
  // "then", "potem", "drop", "myo" open a continuation, never a movement.
  const [legPress] = readWrittenLine('leg press 200kg 15 + myo 5,5,4');
  assert.equal(legPress!.name, 'Leg press');
  assert.equal(legPress!.sets.length, 4);
  // The myo reps are done at the weight already on the machine.
  assert.ok(legPress!.sets.every((s) => s.weightKg === 200));

  const [curls] = readWrittenLine('curls 15kg to failure, got 12');
  assert.equal(curls!.name, 'Curls');
  assert.deepEqual(
    curls!.sets.map((s) => [s.weightKg, s.reps]),
    [[15, 12]],
  );
});

test('several movements on one line are several movements', () => {
  const items = readWrittenLine('squat 120 5x5, rows 60 3x10');
  assert.deepEqual(
    items.map((i) => i.name),
    ['Squat', 'Barbell row'],
  );
  // A superset written inline splits too.
  assert.equal(readWrittenLine('bench 80 3x8 ss bb row 60 3x8').length, 2);
  // A rep list is never a second movement.
  assert.equal(readWrittenLine('bench 100kg 5,5,4').length, 1);
});

test('a movement keeps its qualifier instead of being renamed', () => {
  // The old grammar matched a CONTAINED alias and called this "Bench press",
  // which is a different exercise from the one the person wrote.
  assert.equal(readWrittenLine('incline bench 3x10 60kg')[0]!.name, 'Incline bench');
  assert.equal(readWrittenLine('bench 3x10 60kg')[0]!.name, 'Bench press');
  // Words that describe the work are not part of the name.
  assert.equal(readWrittenLine('push ups AMRAP 22')[0]!.name, 'Push ups');
  assert.equal(readWrittenLine('deadlift warm up 60x5')[0]!.name, 'Deadlift');
});

test('the kind of work survives into the sets', () => {
  assert.ok(readWrittenLine('deadlift warm up 60x5')[0]!.sets.every((s) => s.kind === 'warmup'));
  assert.ok(readWrittenLine('push ups AMRAP 22')[0]!.sets.every((s) => s.kind === 'amrap'));
  const [curls] = readWrittenLine('curls 15kg x12 drop 10kg x8');
  assert.equal(curls!.sets.length, 2);
});

test('an RPE becomes reps in reserve, and never a rep count', () => {
  const [ohp] = readWrittenLine('ohp 42.5 3x8 @8');
  assert.equal(ohp!.sets.length, 3);
  assert.ok(ohp!.sets.every((s) => s.reps === 8 && s.rir === 2));
  assert.equal(readWrittenLine('squat 5x3 150kg @8,5')[0]!.sets[0]!.rir, 1.5);
  assert.equal(readWrittenLine('biceps curl 15kg 10 @11')[0]!.sets[0]!.reps, 10);
});

test('distance and time are read as themselves', () => {
  assert.deepEqual(readWrittenLine('400m run')[0], {
    name: 'Run',
    unit: 'kg',
    sets: [{ kind: 'working', reps: null, weightKg: null, distanceM: 400, durationS: null, rir: null }],
  });
  assert.equal(readWrittenLine('tek 2,5km')[0]!.sets[0]!.distanceM, 2500);
  assert.equal(readWrittenLine('plank 60s')[0]!.sets[0]!.durationS, 60);
  assert.equal(readWrittenLine('kolo 30 min')[0]!.sets[0]!.durationS, 1800);
  // Laps, both ways round.
  assert.equal(readWrittenLine('sled push 4x50m')[0]!.sets.length, 4);
  assert.equal(readWrittenLine('sled push 20m x4')[0]!.sets.length, 4);
});

test('a line with nothing readable in it reads as nothing', () => {
  for (const line of ['', '   ', 'felt tired today', 'Push day', 'asdfghjkl', 'bench']) {
    assert.deepEqual(readWrittenLine(line), [], `"${line}" should read as nothing`);
  }
});

test('no line in the corpus produces an absurd number of sets', () => {
  for (const c of CASES) {
    for (const item of readPage(c.input)) {
      assert.ok(
        item.sets.length <= 20,
        `${JSON.stringify(c.input)} read ${item.sets.length} sets of ${item.name}`,
      );
    }
  }
});
