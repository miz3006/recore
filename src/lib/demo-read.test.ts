import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { readWrittenLine } from './demo-read.ts';

/**
 * THE OFFLINE READING ENGINE, SCORED AGAINST THE REAL PARSER'S OWN CORPUS.
 *
 * `scripts/parse-eval-cases.json` is what the edge function is evaluated with —
 * 105 notes of how people actually write, English and Slovene, collected for
 * the model (79 of them until 10 September 2026, when a wide sweep across gym,
 * street-workout and hybrid training added 26 more). The demo screen cannot call that function (no account exists on the
 * fourth screen of a funnel), so it reads with `demo-read.ts` — and the only
 * way "it reads well now" survives the next change is if it is a NUMBER in a
 * test rather than a claim in a commit message.
 *
 * Two floors, both deliberately below where the engine sits today, so an
 * ordinary refactor does not fail the suite and a regression does:
 *
 *  · it must READ at least 98 of the 105 notes (it reads 102 — the three it
 *    does not are two voice-dictated word-number lines and one note that is
 *    pure junk and is SUPPOSED to read as nothing);
 *  · and it must get the exercise COUNT right on at least 94 (it gets 98).
 *
 * The count floor was 60 of 79 until 10 September 2026, when a sweep of ~260
 * written lines across gym, street-workout and hybrid training turned up twelve
 * distinct misreads — timed sets collapsing to one, light machine loads
 * dropped, one number read as both reps and kilograms, movements renamed by the
 * segment splitter or by a noise word taken off the wrong end. Each is a test
 * below; together they took the ORIGINAL 79-case corpus from 66 right to 76.
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

test('the engine reads at least 98 of the notes the real parser is scored on', () => {
  const read = CASES.filter((c) => readPage(c.input).length > 0);
  assert.ok(
    read.length >= 98,
    `only ${read.length}/${CASES.length} read — ${CASES.filter((c) => readPage(c.input).length === 0)
      .map((c) => JSON.stringify(c.input))
      .join(', ')}`,
  );
});

test('and finds the right NUMBER of exercises on at least 94 of them', () => {
  const right = CASES.filter((c) => readPage(c.input).length === c.expect.length);
  assert.ok(right.length >= 94, `only ${right.length}/${CASES.length} matched the expected item count`);
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


// ---------------------------------------------------------------------------
// THE WIDE SWEEP, 10 September 2026. Every test below is one defect found by
// reading ~260 written lines — a gym's whole vocabulary, street workout, and
// hybrid/conditioning — through this engine and looking at what came back.
// ---------------------------------------------------------------------------

/** Every set of the first movement a line carries, as [reps, kg, m, s]. */
const shapeOf = (line: string) =>
  readWrittenLine(line)[0]!.sets.map((s) => [s.reps, s.weightKg, s.distanceM, s.durationS]);

test('a count against a TIME is that many holds, not one', () => {
  // Read as one set, five sets of a ten-second lever became "a lever, 10s" —
  // most of the work on a calisthenics or conditioning line simply vanished.
  assert.equal(readWrittenLine('front lever tuck 5x10s')[0]!.sets.length, 5);
  assert.deepEqual(shapeOf('plank 3x60s'), [
    [null, null, null, 60],
    [null, null, null, 60],
    [null, null, null, 60],
  ]);
  // The unit may stand off from its number, and the pair may be written round
  // the other way.
  assert.deepEqual(shapeOf('wall handstand 3x45 sec'), [
    [null, null, null, 45],
    [null, null, null, 45],
    [null, null, null, 45],
  ]);
  assert.equal(readWrittenLine('30s x4 plank')[0]!.sets.length, 4);
  assert.equal(readWrittenLine('tabata push ups 8x20s')[0]!.sets.length, 8);
  // Minutes are minutes.
  assert.deepEqual(shapeOf('bike 2x10 min'), [
    [null, null, null, 600],
    [null, null, null, 600],
  ]);
});

test('a bare "s" is Slovene for "with", not seconds', () => {
  // "4 serije po 10 s 70kg" — four sets of ten WITH seventy kilos. Read as a
  // time it would be four ten-second holds, which is not what anybody wrote.
  assert.deepEqual(shapeOf('bench 4 serije po 10 s 70kg'), [
    [10, 70, null, null],
    [10, 70, null, null],
    [10, 70, null, null],
    [10, 70, null, null],
  ]);
});

test('a light machine load is a load, not nothing', () => {
  // A number under the load floor used to be dropped, so half a gym's cable and
  // dumbbell work arrived with no weight on it at all.
  assert.deepEqual(shapeOf('cable fly 15 3x15')[0], [15, 15, null, null]);
  assert.deepEqual(shapeOf('face pull 20 3x20')[0], [20, 20, null, null]);
  assert.deepEqual(shapeOf('kb press 24 3x8')[0], [8, 24, null, null]);
  assert.deepEqual(shapeOf('cable lateral raise 7.5 3x15')[0], [15, 7.5, null, null]);
});

test('and a number the rep scheme already used is never ALSO the load', () => {
  // "squats x30" came back as thirty reps at thirty kilograms, "double unders
  // 3x100" as a hundred reps at a hundred kilos: one number, read twice.
  assert.deepEqual(shapeOf('squats x30'), [[30, null, null, null]]);
  assert.ok(readWrittenLine('double unders 3x100')[0]!.sets.every((s) => s.weightKg === null));
  assert.ok(readWrittenLine('pull ups 3x10')[0]!.sets.every((s) => s.weightKg === null));
  assert.deepEqual(shapeOf('sklece do odpovedi 25'), [[25, null, null, null]]);
  // A number a counter word follows is that count: three SETS, not three kilos.
  assert.ok(
    readWrittenLine('zgibi max 3 serije: 14, 11, 9')[0]!.sets.every((s) => s.weightKg === null),
  );
});

test('a slash lists movements, and never splits a rep list', () => {
  const items = readWrittenLine('bench 80kg 3x8 / rows 60kg 3x10 / curls 15kg 3x12');
  assert.deepEqual(
    items.map((i) => i.name),
    ['Bench press', 'Barbell row', 'Curls'],
  );
  assert.equal(items[1]!.sets[0]!.weightKg, 60);
  // The slash inside a rep list has no spaces around it and no words after it.
  assert.equal(readWrittenLine('bench 80kg 8/7/6')[0]!.sets.length, 3);
});

test('"and" inside a movement\'s name does not split it in half', () => {
  // It used to produce an exercise called "Jerk" — somebody's clean and jerk
  // renamed to half of itself.
  assert.equal(readWrittenLine('clean and jerk 90kg 3x2')[0]!.name, 'Clean and jerk');
  assert.equal(readWrittenLine('clean and press 60kg 5x3')[0]!.name, 'Clean and press');
  // With numbers on both sides it is still two movements.
  assert.equal(readWrittenLine('bench 80kg 3x8 and rows 60kg 3x10').length, 2);
});

test('a continuation word opens a new set group with or without a comma', () => {
  // "…100kg x3 then 140kg 3x5" read the 3 of "3x5" as three kilograms.
  const [squat] = readWrittenLine('squat wu 20kg x10, 60kg x5, 100kg x3 then 140kg 3x5');
  assert.equal(squat!.name, 'Squat');
  assert.deepEqual(
    squat!.sets.map((s) => [s.weightKg, s.reps]),
    [
      [20, 10],
      [60, 5],
      [100, 3],
      [140, 5],
      [140, 5],
      [140, 5],
    ],
  );
  // The ramp is warm-up work; the top sets are not.
  assert.equal(squat!.sets[0]!.kind, 'warmup');
});

test('a drop reads the bar coming down, not a rep count', () => {
  const [bench] = readWrittenLine('bench 80kg x8, dropset to 60 then 40');
  assert.deepEqual(
    bench!.sets.map((s) => [s.weightKg, s.reps]),
    [
      [80, 8],
      [60, null],
      [40, null],
    ],
  );
  assert.equal(bench!.sets[1]!.kind, 'drop');
});

test('a counter or a remark is never a movement', () => {
  // Each of these produced a card: "Rounds", "Emom", "Time", "Min rest".
  for (const line of ['3 rounds:', 'EMOM 10:', 'time 7:42', '5 sets total', '2 min rest']) {
    assert.deepEqual(readWrittenLine(line), [], `"${line}" should read as nothing`);
  }
  // A remark after a movement belongs to the movement, not to a card of its own.
  const [lever] = readWrittenLine('front lever holds, best was 12s');
  assert.equal(lever!.name, 'Front lever holds');
  assert.equal(lever!.sets[0]!.durationS, 12);
});

test('a movement named AFTER its rep count still reads', () => {
  // "10 thrusters 40kg" — every circuit and metcon on earth — read as nothing.
  assert.deepEqual(shapeOf('10 thrusters 40kg'), [[10, 40, null, null]]);
  assert.equal(readWrittenLine('12 kb swings 24kg')[0]!.name, 'Kb swings');
  // Two numbers in a row still stay unnamed rather than becoming "Felt smooth".
  assert.deepEqual(readWrittenLine('180 2x3 felt smooth'), []);
});

test('rest is not work', () => {
  const [bench] = readWrittenLine('bench 5x5 100kg, pavza 3 min');
  assert.equal(bench!.sets.length, 5);
  assert.ok(bench!.sets.every((s) => s.durationS === null));
  const [squat] = readWrittenLine('squat 3x5 140kg, 2 min rest between sets');
  assert.equal(squat!.sets.length, 3);
  assert.ok(squat!.sets.every((s) => s.durationS === null));
  assert.equal(readWrittenLine('rest 90s').length, 0);
});

test('tempo is a prescription, never a count', () => {
  // "tempo 30X1" was read as a pair and turned three sets of eight into nine.
  assert.equal(readWrittenLine('squat 100kg 3x8 tempo 30X1')[0]!.sets.length, 3);
  assert.equal(readWrittenLine('rdl 80kg 3x10 3-1-3')[0]!.sets.length, 3);
});

test('the clock and the pound sign are read as what they are', () => {
  // "1:02:30" used to lose its hour to the M:SS rule and leave a stray 1.
  assert.deepEqual(shapeOf('bike 1:02:30 32km'), [[null, null, 32000, 3750]]);
  assert.deepEqual(shapeOf('long run 21,1km 1:52:30'), [[null, null, 21100, 6750]]);
  assert.deepEqual(shapeOf('row 2000m 7:45'), [[null, null, 2000, 465]]);
  // "225#" is 225 POUNDS — read as kilograms it doubles somebody's bench.
  assert.equal(readWrittenLine('bench 225# 3x5')[0]!.sets[0]!.weightKg, 102.06);
});

test('the bar with nothing on it weighs twenty kilograms', () => {
  const [bench] = readWrittenLine('bench prazna palica 2x10, potem 60kg 3x8');
  assert.equal(bench!.name, 'Bench press');
  assert.deepEqual(
    bench!.sets.map((s) => [s.weightKg, s.reps]),
    [
      [20, 10],
      [20, 10],
      [60, 8],
      [60, 8],
      [60, 8],
    ],
  );
  assert.equal(readWrittenLine('squat just the bar x10')[0]!.sets[0]!.weightKg, 20);
});

test('assistance is not a load, and added weight is', () => {
  const [assisted] = readWrittenLine('assisted pull ups bw-15 3x10');
  assert.equal(assisted!.name, 'Assisted pull ups');
  assert.ok(assisted!.sets.every((s) => s.weightKg === null));
  assert.equal(readWrittenLine('dips bw+20 3x8')[0]!.sets[0]!.weightKg, 20);
  assert.equal(readWrittenLine('weighted dips bw+25kg 3x8')[0]!.sets[0]!.weightKg, 25);
});

test('a movement keeps every word of its own name', () => {
  // "toes to bar" lost its bar to the empty-bar cleanup and became "Toes to".
  assert.equal(readWrittenLine('toes to bar 4x12')[0]!.name, 'Toes to bar');
  // A chin-up is not a pull-up: the app's exercise table keeps them apart.
  assert.equal(readWrittenLine('chin ups 3x10')[0]!.name, 'Chin ups');
  assert.equal(readWrittenLine('pull ups 3x10')[0]!.name, 'Pull-ups');
  // A bullet or a dash in front of the line is not part of the name.
  assert.equal(readWrittenLine('- squat — 120kg x5')[0]!.name, 'Squat');
  assert.equal(readWrittenLine('• bench – 80kg x8')[0]!.name, 'Bench press');
});

test('an "@" before a weight is a weight, not an RPE', () => {
  // Stripping it left the line with a bare "kg" and nothing to read at all.
  assert.deepEqual(shapeOf('bench 5 @ 100kg'), [[5, 100, null, null]]);
  assert.equal(readWrittenLine('ohp 42.5 3x8 @8')[0]!.sets[0]!.rir, 2);
});

test('a whole written session reads line by line without inventing anything', () => {
  const page = [
    'Push A',
    'bench 100kg 5,5,4 @8',
    'incline db press 30kg 3x10',
    'cable fly 12 3x15',
    'dips bw+10 3x10',
    'plank 3x45s',
    'run 5k 24:30',
  ];
  const items = page.flatMap((line) => readWrittenLine(line));
  assert.deepEqual(
    items.map((i) => i.name),
    ['Bench press', 'Incline db press', 'Cable fly', 'Dips', 'Plank', 'Run'],
  );
  assert.deepEqual(
    items.map((i) => i.sets.length),
    [3, 3, 3, 3, 3, 1],
  );
  assert.equal(items[2]!.sets[0]!.weightKg, 12);
  assert.equal(items[5]!.sets[0]!.distanceM, 5000);
});

/**
 * THE WIDE CORPUS — 60 notes, ~260 written lines, gym + street workout +
 * hybrid (`scripts/parse-eval-cases-wide.json`). The engine is not scored
 * against it (that file exists for the MODEL, which is the app's real reader);
 * what is asserted here is that nothing it reads is ever ABSURD, because an
 * absurd reading is the one thing the demo screen may not show.
 */
const WIDE: EvalCase[] = JSON.parse(
  readFileSync(
    path.join(import.meta.dirname, '..', '..', 'scripts', 'parse-eval-cases-wide.json'),
    'utf8',
  ),
);

test('no line in either corpus produces an impossible reading', () => {
  for (const c of [...CASES, ...WIDE]) {
    for (const item of readPage(c.input)) {
      const where = `${JSON.stringify(c.input)} → ${item.name}`;
      assert.ok(item.name.trim().length >= 2, `${where}: name too short`);
      assert.ok(item.name.length <= 80, `${where}: name too long`);
      assert.ok(!/^[^\p{L}\d]/u.test(item.name), `${where}: name starts with punctuation`);
      assert.ok(item.sets.length > 0 && item.sets.length <= 20, `${where}: ${item.sets.length} sets`);
      for (const s of item.sets) {
        assert.ok(
          s.reps == null || (Number.isInteger(s.reps) && s.reps >= 1 && s.reps <= 100),
          `${where}: reps ${s.reps}`,
        );
        assert.ok(
          s.weightKg == null || (s.weightKg > 0 && s.weightKg <= 500),
          `${where}: weight ${s.weightKg}`,
        );
        assert.ok(s.distanceM == null || s.distanceM > 0, `${where}: distance ${s.distanceM}`);
        assert.ok(s.durationS == null || s.durationS > 0, `${where}: duration ${s.durationS}`);
        assert.ok(s.rir == null || (s.rir >= -5 && s.rir <= 10), `${where}: rir ${s.rir}`);
        // A set that says nothing at all would render as an empty row.
        assert.ok(
          s.reps != null || s.weightKg != null || s.distanceM != null || s.durationS != null,
          `${where}: a set with nothing in it`,
        );
      }
    }
  }
});

test('reading is stable: the same line twice reads the same twice', () => {
  // The number rules use module-level regexes; a stray `lastIndex` between
  // calls would make the second read of a line differ from the first.
  for (const c of [...CASES, ...WIDE]) {
    const once = JSON.stringify(readPage(c.input));
    const twice = JSON.stringify(readPage(c.input));
    assert.equal(twice, once, `unstable reading for ${JSON.stringify(c.input)}`);
  }
});

test('every case in both corpora reads without throwing, whatever is in it', () => {
  for (const c of [...CASES, ...WIDE]) {
    for (const line of c.input.split('\n')) {
      assert.doesNotThrow(() => readWrittenLine(line), `threw on ${JSON.stringify(line)}`);
      // The same line with junk around it must not throw either.
      assert.doesNotThrow(() => readWrittenLine(`  ${line}  💪 ((( ,,, ---`));
    }
  }
});

/**
 * A GYM'S WHOLE VOCABULARY, in the notations people write it in.
 *
 * The corpus files above are notes; this is the other axis — one movement at a
 * time, across every shape the grammar knows, asking one question: does the
 * person's own name survive? A lost word is a RENAMED movement ("side plank"
 * came back as "Plank", "toes to bar" as "Toes to"), and a renamed movement
 * merges two different histories the moment it reaches the record.
 */
const MOVEMENTS = [
  'bench press', 'incline bench press', 'decline bench press', 'close grip bench press', 'floor press',
  'squat', 'front squat', 'box squat', 'pause squat', 'hack squat', 'zercher squat', 'safety bar squat',
  'deadlift', 'sumo deadlift', 'romanian deadlift', 'stiff leg deadlift', 'deficit deadlift', 'rack pull',
  'overhead press', 'push press', 'behind the neck press', 'arnold press', 'landmine press',
  'barbell row', 'pendlay row', 't bar row', 'seal row', 'chest supported row', 'meadows row', 'inverted row',
  'lat pulldown', 'straight arm pulldown', 'cable row', 'face pull', 'shrug', 'upright row', 'rear delt fly',
  'lateral raise', 'biceps curl', 'hammer curl', 'preacher curl', 'concentration curl', 'spider curl',
  'triceps pushdown', 'overhead triceps extension', 'skull crusher', 'kickback', 'diamond push up',
  'leg press', 'leg extension', 'leg curl', 'nordic curl', 'calf raise', 'seated calf raise', 'tibialis raise',
  'hip thrust', 'glute bridge', 'good morning', 'back extension', 'reverse hyper', 'cable pull through',
  'lunge', 'walking lunge', 'reverse lunge', 'bulgarian split squat', 'step up', 'pistol squat', 'sissy squat',
  'pull up', 'chin up', 'wide grip pull up', 'neutral grip pull up', 'commando pull up', 'muscle up',
  'dip', 'ring dip', 'bench dip', 'push up', 'archer push up', 'pike push up', 'handstand push up',
  'front lever', 'back lever', 'planche', 'human flag', 'l sit', 'dragon flag', 'hollow hold', 'superman hold',
  'handstand hold', 'dead hang', 'toes to bar', 'hanging leg raise', 'knee raise', 'ab wheel', 'plank',
  'side plank', 'russian twist', 'sit up', 'crunch', 'cable crunch', 'burpee', 'box jump', 'broad jump',
  'kettlebell swing', 'turkish get up', 'goblet squat', 'farmer carry', 'suitcase carry', 'sled push',
  'sled drag', 'yoke walk', 'sandbag carry', 'tire flip', 'battle rope', 'wall ball', 'thruster',
  'power clean', 'hang clean', 'snatch', 'clean pull', 'overhead squat', 'muscle snatch',
  'run', 'sprint', 'jog', 'row erg', 'ski erg', 'assault bike', 'cycling', 'swimming', 'jump rope',
  'double under', 'stair climber', 'incline walk', 'hike', 'elliptical', 'shadow boxing',
];

const NOTATIONS = [
  (m: string) => `${m} 3x8 60kg`,
  (m: string) => `${m} 60kg 3x10`,
  (m: string) => `${m} 3x12`,
  (m: string) => `${m} 100x5 90x8`,
  (m: string) => `${m} 4x30s`,
  (m: string) => `${m} 5x200m`,
  (m: string) => `${m} 20kg 8/7/6`,
  (m: string) => `${m} bw+10 3x8 @8`,
  (m: string) => `${m.toUpperCase()} 3X5 80KG`,
];

test('every movement in a gym reads, in every notation', () => {
  for (const movement of MOVEMENTS) {
    for (const write of NOTATIONS) {
      const line = write(movement);
      const items = readWrittenLine(line);
      assert.ok(items.length > 0, `nothing read from ${JSON.stringify(line)}`);
      assert.equal(items.length, 1, `${JSON.stringify(line)} split into ${items.length} movements`);
      assert.ok(items[0]!.sets.length > 0, `${JSON.stringify(line)} read no sets`);
    }
  }
});

test('and keeps every word of the name it was written with', () => {
  const renamed = new Map([
    // The only renames this engine may do: a canonical the whole flow keys on.
    ['bench press', 'Bench press'],
    ['squat', 'Squat'],
    ['deadlift', 'Deadlift'],
    ['overhead press', 'Overhead press'],
    ['barbell row', 'Barbell row'],
    ['pull up', 'Pull-ups'],
  ]);
  for (const movement of MOVEMENTS) {
    for (const write of NOTATIONS) {
      const line = write(movement);
      const name = readWrittenLine(line)[0]!.name;
      const expected = renamed.get(movement);
      if (expected) {
        assert.equal(name, expected, JSON.stringify(line));
        continue;
      }
      for (const word of movement.split(' ')) {
        if (word.length <= 2) continue;
        assert.ok(
          name.toLowerCase().includes(word),
          `${JSON.stringify(line)} lost "${word}" — read as "${name}"`,
        );
      }
    }
  }
});
