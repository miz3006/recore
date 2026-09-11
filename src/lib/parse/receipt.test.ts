import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildReceipt,
  lastSetOf,
  lastSetTextOf,
  matchPlanIndex,
  nameKey,
  namesMatch,
  typedNameOf,
} from './receipt.ts';
import { doneKeyFor, echoTextOf, setsLineText, setTableOf, topOfSets } from './summarize.ts';
import { type LineSignal, type ParseResult, type ParsedItem, type ParsedSet } from './types.ts';

const set = (over: Partial<ParsedSet>): ParsedSet => ({
  kind: 'working',
  reps: null,
  weight_kg: null,
  distance_m: null,
  duration_s: null,
  rir: null,
  parent: null,
  note: null,
  ...over,
});

const item = (exercise: string, line: number, sets: ParsedSet[]): ParsedItem => ({
  exercise,
  aliases_seen: [],
  modality: 'strength',
  group_key: null,
  line,
  sets,
});

const resultOf = (...items: ParsedItem[]): ParseResult => ({ items, parse_version: 2 });

test('echo voice: loaded, bodyweight, hold', () => {
  assert.equal(
    echoTextOf(topOfSets([set({ reps: 8, weight_kg: 82.5 }), set({ reps: 8, weight_kg: 82.5 })])),
    '2×8 82.5',
  );
  assert.equal(echoTextOf(topOfSets([set({ reps: 12 })])), '1×12');
  assert.equal(echoTextOf(topOfSets([set({ duration_s: 60 })])), '60 s');
});

test('warm-ups and drops shape neither the scheme nor the totals', () => {
  const bench = item('Bench Press', 0, [
    set({ kind: 'warmup', reps: 10, weight_kg: 40 }),
    set({ reps: 8, weight_kg: 80 }),
    set({ reps: 8, weight_kg: 80 }),
    set({ kind: 'drop', reps: 8, weight_kg: 60 }),
  ]);
  const receipt = buildReceipt(resultOf(bench), []);
  assert.equal(receipt.rows[0]!.setText, '80 kg × 8·8');
  assert.equal(receipt.totalSets, 2);
  // volume counts working + drop, never warm-ups (parsedVolume semantics)
  assert.equal(receipt.volume, 8 * 80 + 8 * 80 + 8 * 60);
});

test('faithful set text: pyramid keeps every weight AND rep (the display-bug fix)', () => {
  const squat = item('Squat', 0, [
    set({ reps: 10, weight_kg: 120 }),
    set({ reps: 15, weight_kg: 100 }),
    set({ reps: 8, weight_kg: 90 }),
  ]);
  assert.equal(buildReceipt(resultOf(squat), []).rows[0]!.setText, '120·100·90 kg × 10·15·8');
});

test('un-checked (not-done) exercises stay as rows but leave the totals (N2)', () => {
  const bench = item('Bench Press', 0, [
    set({ reps: 8, weight_kg: 80 }),
    set({ reps: 8, weight_kg: 80 }),
  ]);
  const squat = item('Squat', 1, [set({ reps: 5, weight_kg: 100 })]);
  const result = resultOf(bench, squat);
  // The user marked the squat NOT DONE — keyed by exercise + its sets text.
  const undone = new Set([doneKeyFor('Squat', setsLineText(squat.sets)!)]);
  const receipt = buildReceipt(result, [], undone);

  // Both exercises still render — the record is never lost...
  assert.equal(receipt.rows.length, 2);
  assert.equal(receipt.rows[1]!.exercise, 'Squat');
  // ...but only performed work counts toward the session totals.
  assert.equal(receipt.totalSets, 2); // bench's two sets only
  assert.equal(receipt.volume, 8 * 80 + 8 * 80); // the squat's 100×5 is excluded
});

// The composer keys its check rings off the RENDERED ROW (`doneKeyFor(row.exercise,
// row.setText)`); the totals, the projection and the PR signals key off the parsed
// ITEM. Those two have to produce the same string or an un-check is cosmetic: the
// ring goes off, and the set still counts everywhere. That is exactly what a second
// local key definition in `note-surface.tsx` did — it separated the two with a
// different character, silently, and nothing failed. Derive the key from the row
// here, the way the composer does, so the two can never drift apart again.
test('a key derived from the rendered row is the key the totals honour', () => {
  const bench = item('Bench Press', 0, [
    set({ reps: 8, weight_kg: 80 }),
    set({ reps: 8, weight_kg: 80 }),
  ]);
  const squat = item('Squat', 1, [set({ reps: 5, weight_kg: 100 })]);
  const result = resultOf(bench, squat);

  const rendered = buildReceipt(result, []).rows;
  const squatRow = rendered.find((r) => r.exercise === 'Squat')!;
  // ...the composer's own expression, character for character.
  const undone = new Set([doneKeyFor(squatRow.exercise, squatRow.setText)]);

  const receipt = buildReceipt(result, [], undone);
  assert.equal(receipt.rows.length, 2, 'the record keeps the line');
  assert.equal(receipt.totalSets, 2, "the un-checked squat's set is not counted");
  assert.equal(receipt.volume, 8 * 80 + 8 * 80, 'nor its tonnage');
});

test('faithful set text: rep list at one weight shows the real reps, not repeated', () => {
  const bench = item('Bench Press', 0, [
    set({ reps: 8, weight_kg: 80 }),
    set({ reps: 7, weight_kg: 80 }),
    set({ reps: 6, weight_kg: 80 }),
  ]);
  assert.equal(buildReceipt(resultOf(bench), []).rows[0]!.setText, '80 kg × 8·7·6');
});

test('faithful set text: bodyweight with a dropped last rep', () => {
  const dips = item('Dip', 0, [set({ reps: 16 }), set({ reps: 16 }), set({ reps: 15 })]);
  assert.equal(buildReceipt(resultOf(dips), []).rows[0]!.setText, '16·16·15');
});

test('faithful set text: uniform work stays compact', () => {
  const squat = item('Squat', 0, [
    set({ reps: 5, weight_kg: 100 }),
    set({ reps: 5, weight_kg: 100 }),
    set({ reps: 5, weight_kg: 100 }),
  ]);
  assert.equal(buildReceipt(resultOf(squat), []).rows[0]!.setText, '100 kg × 5·5·5');
});

// --- the per-set mini table (one row per set, under the exercise) ------------

test('set table: a pyramid keeps every set on its own row, in order', () => {
  const squat = item('Squat', 0, [
    set({ reps: 10, weight_kg: 120 }),
    set({ reps: 15, weight_kg: 100 }),
    set({ reps: 8, weight_kg: 90 }),
  ]);
  const table = buildReceipt(resultOf(squat), []).rows[0]!.table;
  assert.equal(table.loadHead, 'KG');
  assert.equal(table.workHead, 'REPS');
  assert.deepEqual(
    table.rows.map((r) => [r.label, r.load, r.work]),
    [
      ['1', '120', '10'],
      ['2', '100', '15'],
      ['3', '90', '8'],
    ],
  );
  assert.ok(table.rows.every((r) => r.counted));
});

test('set table: warm-ups and drops stay visible, labelled, and outside the numbering', () => {
  const bench = item('Bench Press', 0, [
    set({ kind: 'warmup', reps: 10, weight_kg: 40 }),
    set({ reps: 8, weight_kg: 80 }),
    set({ reps: 8, weight_kg: 80 }),
    set({ kind: 'drop', reps: 8, weight_kg: 60 }),
  ]);
  const table = setTableOf(bench.sets);
  // The WORD carries the kind, in its own field — never the position column,
  // and never tone alone (low-vision ruling, 9 Aug 2026). Exactly one of the
  // two is filled per row, which is what makes the numbering readable.
  assert.deepEqual(
    table.rows.map((r) => [r.label, r.mark]),
    [
      ['', 'warm-up'],
      ['1', null],
      ['2', null],
      ['', 'drop'],
    ],
  );
  assert.deepEqual(
    table.rows.map((r) => r.counted),
    [false, true, true, false],
  );
  // ...and the counted contract is untouched by showing them.
  assert.equal(buildReceipt(resultOf(bench), []).totalSets, 2);
});

test('set table: bodyweight drops the load column, mixed work marks the unloaded set', () => {
  const dips = setTableOf([set({ reps: 16 }), set({ reps: 16 }), set({ reps: 15 })]);
  assert.equal(dips.loadHead, null);
  assert.deepEqual(
    dips.rows.map((r) => [r.load, r.work]),
    [
      ['', '16'],
      ['', '16'],
      ['', '15'],
    ],
  );

  const mixed = setTableOf([set({ reps: 10, weight_kg: 20 }), set({ reps: 12 })]);
  assert.equal(mixed.loadHead, 'KG');
  assert.deepEqual(
    mixed.rows.map((r) => r.load),
    ['20', 'bw'],
  );
});

test('set table: cardio and holds get their own column and units', () => {
  const run = setTableOf([set({ distance_m: 5000 }), set({ distance_m: 400 })]);
  assert.equal(run.workHead, 'DIST');
  assert.deepEqual(
    run.rows.map((r) => r.work),
    ['5 km', '400 m'],
  );

  const plank = setTableOf([set({ duration_s: 45 }), set({ duration_s: 90 })]);
  assert.equal(plank.workHead, 'TIME');
  assert.deepEqual(
    plank.rows.map((r) => r.work),
    ['45 s', '1:30'],
  );
});

test('set table: RIR and a second metric ride along as the row note', () => {
  const carry = setTableOf([
    set({ reps: 8, weight_kg: 100, rir: 2 }),
    set({ weight_kg: 40, distance_m: 20, duration_s: 60 }),
  ]);
  assert.ok(carry.hasNote);
  // RIR is its own field — digits only, because the table draws the word "RIR"
  // itself in its own face. The ride-along note holds ONLY a second
  // measurement, so a weighted carry keeps its distance and its time.
  assert.deepEqual(
    carry.rows.map((r) => [r.load, r.work, r.rir, r.note]),
    [
      ['100', '8', '2', ''],
      ['40', '20 m', null, '1:00'],
    ],
  );
});

test('set table: a negative RIR survives — past failure is not at failure', () => {
  // Clamping it to 0 would erase the difference between a set that ended at
  // failure and one that took a forced rep past it (`types.ts`, MIN_RIR).
  const rows = setTableOf([
    set({ reps: 5, weight_kg: 100, rir: 0 }),
    set({ reps: 3, weight_kg: 100, rir: -1 }),
  ]).rows;
  assert.deepEqual(
    rows.map((r) => r.rir),
    ['0', '-1'],
  );
});

test('set table: AMRAP, myo and failure are counted AND keep their kind', () => {
  // "push ups AMRAP 22" used to render as a plain numbered set of 22 — the
  // parser read the word and the table dropped it on the floor.
  const push = setTableOf([set({ kind: 'amrap', reps: 22 })]);
  assert.deepEqual(
    push.rows.map((r) => [r.label, r.mark, r.kindTag, r.counted]),
    [['1', null, 'AMRAP', true]],
  );
  // …and one AMRAP set alone is now worth a table, because it says something
  // the compact one-liner drops.
  assert.ok(push.hasNote);

  // "leg press 200kg 15 + myo 5,5,4" — myo reps are counted work that chains
  // off the set above, so they are numbered AND indented.
  const legPress = setTableOf([
    set({ reps: 15, weight_kg: 200 }),
    set({ kind: 'myo', reps: 5, weight_kg: 200, parent: 0 }),
    set({ kind: 'myo', reps: 5, weight_kg: 200, parent: 0 }),
  ]);
  assert.deepEqual(
    legPress.rows.map((r) => [r.label, r.kindTag, r.chained]),
    [
      ['1', null, false],
      ['2', 'MYO', true],
      ['3', 'MYO', true],
    ],
  );

  assert.equal(setTableOf([set({ kind: 'failure', reps: 12, weight_kg: 15 })]).rows[0]!.kindTag, 'FAILURE');
});

test('set table: a drop chains off its parent, a warm-up does not', () => {
  const rows = setTableOf([
    set({ kind: 'warmup', reps: 10, weight_kg: 40 }),
    set({ reps: 8, weight_kg: 80 }),
    set({ kind: 'drop', reps: 8, weight_kg: 60, parent: 1 }),
  ]).rows;
  assert.deepEqual(
    rows.map((r) => r.chained),
    [false, false, true],
  );
  // An uncounted set is marked by its word and never also tagged — two names
  // for one row is one name too many.
  assert.equal(rows[0]!.kindTag, null);
  assert.equal(rows[2]!.kindTag, null);
});

test('comparison signal attaches, echo-kind does not', () => {
  const signals: LineSignal[] = [
    { line: 0, signal: { kind: 'up', delta: '+2.5' } },
    { line: 1, signal: { kind: 'set', text: '3×12 30' } },
  ];
  const receipt = buildReceipt(
    resultOf(
      item('Bench Press', 0, [set({ reps: 8, weight_kg: 82.5 })]),
      item('Incline DB Press', 1, [set({ reps: 12, weight_kg: 30 })]),
    ),
    signals,
  );
  assert.deepEqual(receipt.rows[0]!.signal, { kind: 'up', delta: '+2.5' });
  assert.equal(receipt.rows[1]!.signal, null, 'first-time exercise stays silent');
});

test('superset sharing a line: signal only on the first item', () => {
  const signals: LineSignal[] = [{ line: 0, signal: { kind: 'pr' } }];
  const receipt = buildReceipt(
    resultOf(
      item('Bench Press', 0, [set({ reps: 10, weight_kg: 60 })]),
      item('Chest Fly', 0, [set({ reps: 12, weight_kg: 12 })]),
    ),
    signals,
  );
  assert.equal(receipt.rows.length, 2);
  assert.deepEqual(receipt.rows[0]!.signal, { kind: 'pr' });
  assert.equal(receipt.rows[1]!.signal, null);
});

test('prose lines never reach the receipt (no items → no rows)', () => {
  const receipt = buildReceipt(resultOf(item('Squat', 2, [set({ reps: 5, weight_kg: 140 })])), []);
  assert.equal(receipt.rows.length, 1);
  assert.equal(receipt.rows[0]!.line, 2);
});

// --- typedNameOf / namesMatch (ghost checklist + correction marks) -----------

test('typedNameOf extracts the words before the first digit', () => {
  assert.equal(typedNameOf('tricpes 27kgx12x2'), 'tricpes');
  assert.equal(typedNameOf('incline smith machine 70kgx10x3'), 'incline smith machine');
  assert.equal(typedNameOf('  Weighted Dips 12-10-8'), 'weighted dips');
  assert.equal(typedNameOf('3x8 80kg bench'), '');
  assert.equal(typedNameOf('felt tired today'), 'felt tired today');
});

test('namesMatch is plural-insensitive containment, so typos do NOT match', () => {
  assert.ok(namesMatch('dips', 'Dip'));
  assert.ok(namesMatch('rows', 'Row'));
  assert.ok(namesMatch('incline smith machine', 'Incline Smith Machine Press'));
  assert.ok(namesMatch('biceps', 'Biceps Curl'));
  assert.ok(!namesMatch('tricpes', 'Triceps Pushdown'));
  assert.ok(!namesMatch('', 'Bench Press'));
  assert.ok(!namesMatch('bench press', 'Row'));
  // Two-letter fragments carry no evidence — mid-keystroke text never matches.
  assert.ok(!namesMatch('d', 'Deadlift'));
  assert.ok(!namesMatch('be', 'Bench Press'));
});

test('matchPlanIndex: exact wins, single containment passes, ambiguity checks nothing', () => {
  const plan = ['benchpres', 'overheadpres', 'squat'].map((k) => k);
  assert.equal(matchPlanIndex('bench press', plan), 0);
  assert.equal(matchPlanIndex('overhead press', plan), 1);
  assert.equal(matchPlanIndex('front squat', plan), 2); // single containment
  assert.equal(matchPlanIndex('press', plan), null); // ambiguous → silence
  assert.equal(matchPlanIndex('be', plan), null); // mid-keystroke fragment
  assert.equal(matchPlanIndex('deadlift', plan), null); // not in the plan
});

test('nameKey strips to letters and singular', () => {
  assert.equal(nameKey('Weighted Dips'), 'weighteddip');
  assert.equal(nameKey('21s'), ''); // digit-led names key to nothing
});

test('a run-only session totals in distance, not an empty 0 kg', () => {
  const run: ParsedItem = {
    ...item('Run', 0, [set({ distance_m: 5000, kind: 'working' })]),
    modality: 'cardio',
  };
  const receipt = buildReceipt(resultOf(run), []);
  assert.equal(receipt.volume, 0);
  assert.equal(receipt.distanceM, 5000);
  assert.equal(receipt.totalSets, 1);
});

test('the last set is the last COUNTED set of the last exercise', () => {
  const receipt = buildReceipt(
    resultOf(
      item('Squat', 0, [set({ reps: 5, weight_kg: 100 })]),
      item('Bench Press', 1, [
        set({ reps: 5, weight_kg: 120 }),
        // A warm-up written after the working set is still not what you just
        // did — the same rule that keeps it out of the tonnage.
        set({ kind: 'warmup', reps: 10, weight_kg: 40 }),
      ]),
    ),
    [],
  );
  assert.deepEqual(lastSetOf(receipt), { exercise: 'Bench Press', reading: '120 kg × 5' });
});

test('the last set speaks bodyweight, distance and time too', () => {
  assert.deepEqual(
    lastSetOf(buildReceipt(resultOf(item('Pull-up', 0, [set({ reps: 10 })])), [])),
    { exercise: 'Pull-up', reading: '10' },
  );
  assert.deepEqual(
    lastSetOf(buildReceipt(resultOf(item('Run', 0, [set({ distance_m: 5000 })])), [])),
    { exercise: 'Run', reading: '5 km' },
  );
});

test('nothing counted, nothing to report', () => {
  const warmupOnly = buildReceipt(
    resultOf(item('Squat', 0, [set({ kind: 'warmup', reps: 10, weight_kg: 40 })])),
    [],
  );
  assert.equal(lastSetOf(warmupOnly), null);
  assert.equal(lastSetOf(buildReceipt(resultOf(), [])), null);
});

test('each lift carries its OWN last set, for the end-of-session check-in', () => {
  const receipt = buildReceipt(
    resultOf(
      item('Incline DB Press', 0, [
        set({ kind: 'warmup', reps: 10, weight_kg: 20 }),
        set({ reps: 10, weight_kg: 40 }),
        set({ reps: 8, weight_kg: 40 }),
      ]),
      item('Cable Fly', 1, [set({ reps: 12, weight_kg: 15 })]),
    ),
    [],
  );
  // The set the feeling belongs to is the LAST working one, not the top set
  // and not an average.
  assert.equal(lastSetTextOf(receipt.rows[0]!), '40 kg × 8');
  assert.equal(lastSetTextOf(receipt.rows[1]!), '15 kg × 12');
  // The session-wide reading is the same function, read from the bottom up.
  assert.deepEqual(lastSetOf(receipt), { exercise: 'Cable Fly', reading: '15 kg × 12' });
});

test('a lift with nothing counted prints no last set at all', () => {
  // Warm-ups only: the row is a record, but there is no working set for the
  // check-in to ask about, so it prints nothing rather than a warm-up.
  assert.equal(
    lastSetTextOf({
      line: 0,
      exercise: 'Bench Press',
      setText: '40 kg × 10',
      table: setTableOf([set({ kind: 'warmup', reps: 10, weight_kg: 40 })]),
      working: [],
      signal: null,
      doneKey: 'Bench Press 40 kg × 10',
    }),
    null,
  );
});

// ---------------------------------------------------------------------------
// A note that repeats itself — the circuit written out round by round, or the
// same movement done twice at the same numbers.
// ---------------------------------------------------------------------------

test('two identical cards get two identities, not one', () => {
  const rows = buildReceipt(
    resultOf(
      item('Plank', 0, [set({ duration_s: 60 })]),
      item('Plank', 1, [set({ duration_s: 60 })]),
      item('Plank', 2, [set({ duration_s: 60 })]),
    ),
    [],
  ).rows;
  assert.equal(new Set(rows.map((r) => r.doneKey)).size, 3);
  // The FIRST keeps the plain key, so a check stored by an older build still
  // finds its card.
  assert.equal(rows[0]!.doneKey, doneKeyFor('Plank', '60 s'));
  assert.equal(rows[1]!.doneKey, `${doneKeyFor('Plank', '60 s')} #2`);
});

test('un-checking one of two identical cards excludes only that one', () => {
  // The defect: one key for both cards meant un-checking either dropped BOTH
  // out of the tonnage — half a session missing because its twin was skipped.
  const result = resultOf(
    item('Push-up', 0, [set({ reps: 20, weight_kg: 10 })]),
    item('Push-up', 1, [set({ reps: 20, weight_kg: 10 })]),
  );
  const both = buildReceipt(result, []);
  assert.equal(both.totalSets, 2);
  assert.equal(both.volume, 400);

  const second = buildReceipt(result, [], new Set([both.rows[1]!.doneKey]));
  // Both cards stay on the page — the record keeps what was written.
  assert.equal(second.rows.length, 2);
  // Only the un-checked one leaves the totals.
  assert.equal(second.totalSets, 1);
  assert.equal(second.volume, 200);

  const first = buildReceipt(result, [], new Set([both.rows[0]!.doneKey]));
  assert.equal(first.totalSets, 1);
  assert.equal(first.volume, 200);
});

test('numbering counts identical readings, not items', () => {
  // An item with no countable sets draws no row and has a key of its own ("Dip
  // " with an empty reading), so it does not push the next real Dip to #3.
  // `applyParseResult` walks the same list the same way, which is the whole
  // point: both must name the same card the same thing.
  const rows = buildReceipt(
    resultOf(
      item('Dip', 0, [set({ reps: 10 })]),
      item('Dip', 1, []),
      item('Dip', 2, [set({ reps: 10 })]),
    ),
    [],
  ).rows;
  assert.deepEqual(
    rows.map((r) => r.doneKey),
    [doneKeyFor('Dip', '10'), `${doneKeyFor('Dip', '10')} #2`],
  );
});

test('a carry, a hold and a split keep every metric on the compact line', () => {
  // The defect: the compact line answered with ONE fact and stopped, so a
  // loaded carry read "32 kg" with no distance, a weighted plank read "10 kg"
  // with no time, and a rowed 2 km read "2000 m" with no split — in each case
  // the half the line was written for.
  assert.equal(
    setsLineText([
      set({ distance_m: 40, weight_kg: 32 }),
      set({ distance_m: 40, weight_kg: 32 }),
    ]),
    '32 kg · 2× 40 m',
  );
  assert.equal(setsLineText([set({ duration_s: 45, weight_kg: 10 })]), '10 kg · 45 s');
  assert.equal(setsLineText([set({ distance_m: 2000, duration_s: 465 })]), '2000 m · 7:45');
  // The shapes that already read well are untouched.
  assert.equal(setsLineText([set({ duration_s: 60 }), set({ duration_s: 60 })]), '2× 60 s');
  assert.equal(setsLineText([set({ distance_m: 5000 })]), '5000 m');
  assert.equal(setsLineText([set({ reps: 10, weight_kg: 60 })]), '60 kg × 10');
  // Nothing countable is still nothing.
  assert.equal(setsLineText([]), null);
  assert.equal(setsLineText([set({ kind: 'warmup', reps: 10, weight_kg: 40 })]), null);
});
