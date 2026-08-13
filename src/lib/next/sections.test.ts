import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  adherenceChip,
  briefHeadline,
  buildSections,
  DELTA_SUSPECT_RATIO,
  moveLabel,
  movingReading,
  sparkSeries,
} from './sections.ts';

import type { Brief } from '../db/brief.ts';

const EMPTY: Brief = {
  dayLabel: null,
  forToday: false,
  lines: [],
  headline: null,
  stalls: [],
  movers: [],
  adherence: null,
  prReach: null,
  sessions7: 0,
  sessions8w: 0,
  notes: [],
};

const brief = (over: Partial<Brief>): Brief => ({ ...EMPTY, ...over });

const mover = (canonical: string, deltaKg: number, currentE1rm: number, series: number[] = []) => ({
  canonical,
  deltaKg,
  weeks: 8,
  currentE1rm,
  series,
});

const stall = (canonical: string, weight: number, deloadTo: number | null = null) => ({
  canonical,
  weight,
  sessions: 3,
  deloadTo,
});

// --- the dedupe rule ---------------------------------------------------------

test('one exercise, one home: the session card wins over both other sections', () => {
  const s = buildSections(
    brief({
      lines: [{ name: 'Bench press', canonical: 'Bench press', value: '3×12 120 kg', why: null }],
      stalls: [stall('Bench press', 120, 107.5)],
      movers: [mover('Bench press', 6.5, 140)],
    }),
  );
  assert.equal(s.sessionRows.length, 1);
  assert.deepEqual(s.standing, [], 'the plateau left the standing section');
  assert.deepEqual(s.moving, [], 'and the climb left the moving section');
});

test('the losing plateau is not discarded — it becomes the row WATCH line', () => {
  const s = buildSections(
    brief({
      lines: [{ name: 'Bench press', canonical: 'Bench press', value: '3×12 120 kg', why: null }],
      stalls: [stall('Bench press', 120, 107.5)],
    }),
  );
  assert.deepEqual(s.sessionRows[0]!.watch, { sessions: 3, deloadTo: 107.5 });
});

test('a stall with no backoff load never becomes a WATCH line', () => {
  const s = buildSections(
    brief({
      lines: [{ name: 'Bench press', canonical: 'Bench press', value: '3×12', why: null }],
      stalls: [stall('Bench press', 120, null)],
    }),
  );
  assert.equal(s.sessionRows[0]!.watch, null);
});

test('dedupe keys on the canonical name, not the display one', () => {
  // The plan spells it "Bench", the record spells it "Bench press".
  const s = buildSections(
    brief({
      lines: [{ name: 'Bench', canonical: 'Bench press', value: '3×12 120 kg', why: null }],
      stalls: [stall('BENCH PRESS', 120, 107.5)],
    }),
  );
  assert.deepEqual(s.standing, [], 'case and spelling differences are one lift');
  assert.ok(s.sessionRows[0]!.watch);
});

test('a lift the session does not name keeps its own section', () => {
  const s = buildSections(
    brief({
      lines: [{ name: 'Squat', canonical: 'Squat', value: '3×5 100 kg', why: null }],
      stalls: [stall('Bench press', 120, 107.5)],
      movers: [mover('Row', 6.5, 90, [80, 84, 90])],
    }),
  );
  assert.deepEqual(s.standing.map((r) => r.name), ['Bench press']);
  assert.deepEqual(s.moving.map((r) => r.name), ['Row']);
});

test('standing still outranks moving for the same lift', () => {
  const s = buildSections(
    brief({
      stalls: [stall('Bench press', 120, 107.5)],
      movers: [mover('Bench press', 6.5, 140)],
    }),
  );
  assert.equal(s.standing.length, 1);
  assert.deepEqual(s.moving, []);
});

test('no exercise name appears twice across the three sections', () => {
  const s = buildSections(
    brief({
      lines: [
        { name: 'Bench press', canonical: 'Bench press', value: '3×12 120 kg', why: null },
        { name: 'Row', canonical: 'Row', value: '3×8 70 kg', why: null },
      ],
      stalls: [stall('Bench press', 120, 107.5), stall('Squat', 140, 125)],
      movers: [mover('Row', 6.5, 90), mover('Squat', 5, 160), mover('Curl', 3, 40)],
    }),
  );
  const names = [
    ...s.sessionRows.map((r) => r.key),
    ...s.standing.map((r) => r.key),
    ...s.moving.map((r) => r.key),
  ];
  assert.equal(new Set(names).size, names.length, names.join(', '));
});

test('moving is capped at three, biggest trend first', () => {
  const s = buildSections(
    brief({
      movers: [
        mover('A', 3, 100),
        mover('B', 9, 100),
        mover('C', 5, 100),
        mover('D', 7, 100),
      ],
    }),
  );
  assert.deepEqual(s.moving.map((r) => r.name), ['B', 'D', 'C']);
});

// --- the decision the row leads with -----------------------------------------

test('the lever is stated in words, and carries its own increment', () => {
  assert.deepEqual(moveLabel({ kind: 'weight', deltaKg: 2.5 }), {
    label: 'ADD 2.5 KG',
    tone: 'signal',
  });
  assert.deepEqual(moveLabel({ kind: 'rep' }), { label: 'ADD A REP', tone: 'signal' });
});

test('the two moves that are not progress wear amber, never green', () => {
  assert.equal(moveLabel({ kind: 'hold' })!.tone, 'attention');
  assert.equal(moveLabel({ kind: 'backoff', toKg: 107.5 })!.tone, 'attention');
});

test('no decision, no label — a first-ever session invents nothing', () => {
  assert.equal(moveLabel(null), null);
  assert.equal(moveLabel(undefined), null);
});

test('the decision reaches the row', () => {
  const s = buildSections(
    brief({
      lines: [
        {
          name: 'Bench press',
          canonical: 'Bench press',
          value: '120 × 12·12·12',
          why: null,
          move: { kind: 'rep' },
        },
      ],
    }),
  );
  assert.deepEqual(s.sessionRows[0]!.move, { label: 'ADD A REP', tone: 'signal' });
});

test('a ghost line has no reason code and so claims no decision', () => {
  const s = buildSections(
    brief({ lines: [{ name: 'Bench press', canonical: 'Bench press', value: '3×5 120 kg', why: null }] }),
  );
  assert.equal(s.sessionRows[0]!.move, null);
});

// --- the trust guard ---------------------------------------------------------

test('a believable delta prints as a signed number', () => {
  assert.deepEqual(movingReading(mover('Bench press', 6.5, 140)), {
    kind: 'delta',
    text: '+6.5 kg',
  });
});

test('the absurd +64 kg is refused and shown as a direction instead', () => {
  const warned: unknown[] = [];
  const reading = movingReading(mover('Bench press', 64, 140), (_m, d) => warned.push(d));
  assert.deepEqual(reading, { kind: 'direction', text: 'climbing' });
  assert.equal(warned.length, 1, 'the refusal is logged for the root-cause fix');
});

test('the threshold is a quarter of the CURRENT e1RM, inclusive', () => {
  const at = 100 * DELTA_SUSPECT_RATIO; // exactly 25 kg on a 100 kg e1RM
  assert.equal(movingReading(mover('Squat', at, 100)).kind, 'delta', 'exactly at the line is kept');
  assert.equal(movingReading(mover('Squat', at + 0.1, 100)).kind, 'direction');
});

test('a delta with no usable denominator is refused, never divided by zero', () => {
  assert.equal(movingReading(mover('Squat', 5, 0)).kind, 'direction');
  assert.equal(movingReading(mover('Squat', 5, Number.NaN)).kind, 'direction');
  assert.equal(movingReading(mover('Squat', Number.NaN, 100)).kind, 'direction');
});

test('a refused NEGATIVE trend says falling, not climbing', () => {
  assert.deepEqual(movingReading(mover('Squat', -60, 140)), {
    kind: 'direction',
    text: 'falling',
  });
});

test('no delta over a quarter of the e1RM ever reaches the screen as a number', () => {
  const s = buildSections(brief({ movers: [mover('Bench press', 64, 140)] }));
  assert.equal(s.moving[0]!.reading.kind, 'direction');
  assert.ok(!/\d/.test(s.moving[0]!.reading.text), 'the fallback carries no figure at all');
});

test('every moving row states the same window', () => {
  const s = buildSections(brief({ movers: [mover('A', 3, 100), mover('B', 4, 100)] }));
  assert.deepEqual(new Set(s.moving.map((r) => r.subtext)), new Set(['est. 1RM · 8 wk']));
});

// --- the sparkline -----------------------------------------------------------

test('a flat trend gets no sparkline', () => {
  assert.deepEqual(sparkSeries([100, 100.2, 100.1]), []);
});

test('a shaped trend keeps its values', () => {
  assert.deepEqual(sparkSeries([100, 104, 110]), [100, 104, 110]);
});

test('two points are a segment, not a trend', () => {
  assert.deepEqual(sparkSeries([100, 120]), []);
  assert.deepEqual(sparkSeries(undefined), []);
});

// --- the adherence chip ------------------------------------------------------

test('"0 of N prescriptions" cannot render', () => {
  assert.equal(adherenceChip({ followed: 0, edited: 0, ignored: 4, settled: 4 }), null);
});

test('below half followed stays unsaid', () => {
  assert.equal(adherenceChip({ followed: 2, edited: 0, ignored: 3, settled: 5 }), null);
});

test('exactly half is enough, and reads as a plain count', () => {
  assert.equal(
    adherenceChip({ followed: 2, edited: 0, ignored: 2, settled: 4 }),
    '2 of 4 prescriptions followed',
  );
});

test('no settled record, no chip', () => {
  assert.equal(adherenceChip(null), null);
  assert.equal(adherenceChip({ followed: 0, edited: 0, ignored: 0, settled: 0 }), null);
});

// --- the headline ------------------------------------------------------------

test('the headline is one stat and one highlight', () => {
  const s = briefHeadline(
    brief({ sessions7: 3, stalls: [stall('Bench press', 120, 107.5)] }),
  );
  assert.equal(s, '3 sessions this week. Bench press is your lift to watch.');
});

test('a PR in reach outranks a plateau', () => {
  const s = briefHeadline(
    brief({
      sessions7: 2,
      prReach: { name: 'Squat', weightKg: 145 },
      stalls: [stall('Bench press', 120, 107.5)],
    }),
  );
  assert.equal(s, '2 sessions this week. Squat is in reach of its heaviest yet.');
});

test('a plateau outranks a climb', () => {
  const s = briefHeadline(
    brief({ sessions7: 1, stalls: [stall('Bench press', 120)], movers: [mover('Row', 6, 90)] }),
  );
  assert.equal(s, '1 session this week. Bench press is your lift to watch.');
});

test('with nothing to highlight the stat stands alone', () => {
  assert.equal(briefHeadline(brief({ sessions7: 0 })), 'No sessions logged this week.');
});

// --- the ghost sentence ------------------------------------------------------

test('the ghost sentence attaches to the row it actually names', () => {
  const s = buildSections(
    brief({
      lines: [
        { name: 'Squat', canonical: 'Squat', value: '3×5 100 kg', why: null },
        { name: 'Bench press', canonical: 'Bench press', value: '3×12 120 kg', why: null },
      ],
      headline: 'Nothing much left at 120 on bench press last time. Same weight, one more rep.',
    }),
  );
  assert.equal(s.sessionRows[0]!.why, null, 'the squat did not borrow the bench sentence');
  assert.ok(s.sessionRows[1]!.why?.includes('bench press'));
  assert.equal(s.sessionNote, null, 'consumed, so it is not also printed on the card');
});

test('a sentence naming no row on the card stays a card-level line', () => {
  const s = buildSections(
    brief({
      lines: [{ name: 'Squat', canonical: 'Squat', value: '3×5 100 kg', why: null }],
      headline: 'Two sessions stuck at 120 on bench press. Backing off to 107.5.',
    }),
  );
  assert.ok(s.sessionNote?.includes('bench press'));
  assert.equal(s.sessionRows[0]!.why, null);
});

test("the engine's own reason is never overwritten by the ghost sentence", () => {
  const s = buildSections(
    brief({
      lines: [
        { name: 'Bench press', canonical: 'Bench press', value: '3×12 120 kg', why: 'you filled every set of 12 at 120' },
      ],
      headline: 'Nothing much left at 120 on bench press last time.',
    }),
  );
  assert.equal(s.sessionRows[0]!.why, 'you filled every set of 12 at 120');
  assert.ok(s.sessionNote, 'the unused sentence still has a home');
});

// --- provenance --------------------------------------------------------------

test('the provenance line stays truthful about who phrased the prose', () => {
  assert.equal(buildSections(EMPTY).provenance, 'Every number read from your record.');
  assert.equal(
    buildSections(EMPTY, { phrased: true }).provenance,
    'Phrased from your brief — every number read from your record.',
  );
});
