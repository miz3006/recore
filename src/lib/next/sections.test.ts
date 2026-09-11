import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  adherenceChip,
  briefHeadline,
  buildSections,
  lastDoneOf,
  moveLabel,
  reasonLine,
  sessionTitleOf,
  targetsLine,
  type SessionRow,
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
  tagPattern: null,
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

test('one exercise, one home: the session claims it once, plateau folded in', () => {
  const s = buildSections(
    brief({
      lines: [{ name: 'Bench press', canonical: 'Bench press', value: '3×12 120 kg', why: null }],
      stalls: [stall('Bench press', 120, 107.5)],
      movers: [mover('Bench press', 6.5, 140)],
    }),
  );
  assert.equal(s.sessionRows.length, 1, 'one row, not a row and two signals');
  assert.ok(s.sessionRows[0]!.watch, 'the plateau is IN the row, not beside it');
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
  assert.equal(s.sessionRows.length, 1, 'case and spelling differences are one lift');
  assert.ok(s.sessionRows[0]!.watch);
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
  assert.equal(moveLabel({ kind: 'backoff', fromKg: 120, toKg: 107.5 })!.tone, 'attention');
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
  // The row carries the engine's OWN lever, not a phrasing of it: the reason
  // line needs the arithmetic, and `moveLabel` still turns this into words.
  assert.deepEqual(s.sessionRows[0]!.move, { kind: 'rep' });
  assert.deepEqual(moveLabel(s.sessionRows[0]!.move), { label: 'ADD A REP', tone: 'signal' });
});

test('a line with no reason code claims no decision', () => {
  const s = buildSections(
    brief({ lines: [{ name: 'Bench press', canonical: 'Bench press', value: '3×5 120 kg', why: null }] }),
  );
  assert.equal(s.sessionRows[0]!.move, null);
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

// --- the reason line: every row explains its own target ----------------------

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
const said = (r: SessionRow): string | null =>
  (reasonLine(r) ?? []).map((s) => s.text).join('') || null;

test('the row states what changed and what it changed from', () => {
  assert.equal(
    said(row({ move: { kind: 'weight', deltaKg: 2.5 }, lastDay: '2026-08-08' })),
    'up 2.5 from Sat 8 Aug',
  );
});

test('the planned magnitude is the only tinted part of the line', () => {
  const line = reasonLine(row({ move: { kind: 'weight', deltaKg: 2.5 }, lastDay: '2026-08-08' }))!;
  assert.deepEqual(
    line.map((s) => s.tone),
    ['plain', 'planned', 'plain'],
  );
  assert.equal(line[1]!.text, '2.5');
});

test('a rep and a hold carry no figure, and so carry no colour', () => {
  const rep = reasonLine(row({ move: { kind: 'rep' }, lastDay: '2026-08-08' }))!;
  assert.deepEqual(rep, [{ text: 'one more rep than Sat 8 Aug', tone: 'plain' }]);
  const hold = reasonLine(row({ move: { kind: 'hold' }, lastDay: '2026-08-08' }))!;
  assert.deepEqual(hold, [{ text: 'same weight as Sat 8 Aug', tone: 'plain' }]);
});

test('a backoff states its own size, in the tone a backoff already wears', () => {
  const line = reasonLine(
    row({ move: { kind: 'backoff', fromKg: 90, toKg: 85 }, lastDay: '2026-08-08' }),
  )!;
  assert.equal(line.map((s) => s.text).join(''), 'down 5 from Sat 8 Aug');
  assert.equal(line[1]!.tone, 'watch', 'amber, never green — a backoff is not progress');
});

test('a plateau outranks the lever: it IS the reason for the target', () => {
  const line = reasonLine(
    row({ move: { kind: 'hold' }, lastDay: '2026-08-08', watch: { sessions: 3, deloadTo: 82.5 } }),
  )!;
  assert.deepEqual(line, [{ text: '3 sessions at this weight', tone: 'watch' }]);
});

test('one session at a weight is not three', () => {
  assert.equal(said(row({ watch: { sessions: 1, deloadTo: 80 } })), '1 session at this weight');
});

test('an unresolved name loses the date, never invents one', () => {
  assert.equal(said(row({ move: { kind: 'weight', deltaKg: 2.5 }, lastDay: null })), 'up 2.5');
});

test('no lever, but a record: the line states the evidence and claims nothing', () => {
  assert.equal(
    said(row({ last: '3×8 80', lastDay: '2026-08-08' })),
    'from 3×8 80 on Sat 8 Aug',
  );
});

test('no target, no line — the slot holds evidence, never an instruction', () => {
  assert.equal(reasonLine(row({ prescription: null, loadKg: null, last: '3×8 80' })), null);
});

test('nothing to say at all stays silent', () => {
  assert.equal(reasonLine(ROW), null);
});

test('the stakes ride the line as arithmetic, never as a badge', () => {
  const line = reasonLine(
    row({ move: { kind: 'weight', deltaKg: 2.5 }, lastDay: '2026-08-08', beatsBest: true }),
  )!;
  assert.equal(line.map((s) => s.text).join(''), 'up 2.5 from Sat 8 Aug · heaviest yet');
  assert.equal(line[line.length - 1]!.tone, 'planned');
});

// --- the title block ---------------------------------------------------------

test('a declared split day names itself', () => {
  assert.equal(
    sessionTitleOf(brief({ lines: [{ name: 'Bench press', value: '82.5', why: null }], dayLabel: 'Push day', forToday: true }), false),
    'Push day',
  );
});

test('no declared day is "Next session", not an invented one', () => {
  assert.equal(
    sessionTitleOf(brief({ lines: [{ name: 'Bench press', value: '82.5', why: null }] }), false),
    'Next session',
  );
});

test('a flat lifter is not owed a day name, and is not apologised to', () => {
  const b = brief({ lines: [{ name: 'Bench press', value: '82.5', why: null }], dayLabel: 'Push day', forToday: true });
  assert.equal(sessionTitleOf(b, true), 'Due now', 'flat wins over a label the record happens to carry');
});

test('an empty record says so before it says anything else', () => {
  assert.equal(sessionTitleOf(EMPTY, false), 'Nothing due yet');
  assert.equal(sessionTitleOf(EMPTY, true), 'Nothing due yet');
});

test('last done is the most recent day the session\'s lifts were touched', () => {
  assert.equal(
    lastDoneOf([
      row({ key: 'a', lastDay: '2026-08-08' }),
      row({ key: 'b', lastDay: '2026-08-12' }),
      row({ key: 'c', lastDay: null }),
    ]),
    '2026-08-12',
  );
});

test('no dated row, no date — never a guess', () => {
  assert.equal(lastDoneOf([row({ lastDay: null })]), null);
  assert.equal(lastDoneOf([]), null);
});

// --- what the session targets ------------------------------------------------

test('the summary counts lifts and names the patterns they vote for', () => {
  assert.equal(
    targetsLine([
      row({ key: 'a', name: 'Bench press', canonical: 'Bench press' }),
      row({ key: 'b', name: 'Overhead press', canonical: 'Overhead press' }),
      row({ key: 'c', name: 'Barbell row', canonical: 'Barbell row' }),
    ]),
    '3 lifts · push, pull',
  );
});

test('one lift is not lifts', () => {
  assert.equal(targetsLine([row({ name: 'Bench press', canonical: 'Bench press' })]), '1 lift · push');
});

test('a lift the lexicon does not know does not vote, and never guesses', () => {
  assert.equal(
    targetsLine([row({ name: 'Sled push-pull thing', canonical: 'Sled push-pull thing' })]),
    '1 lift',
  );
});

test('an empty session claims no patterns', () => {
  assert.equal(targetsLine([]), '0 lifts');
});

test('the stakes are stated once, on the first row that earns them', () => {
  const s = buildSections(
    brief({
      lines: [
        { name: 'Bench press', canonical: 'Bench press', value: '85 × 5·5·5', why: null, loadKg: 85, bestKg: 82.5 },
        { name: 'Lateral raise', canonical: 'Lateral raise', value: '14 × 12·12·12', why: null, loadKg: 14, bestKg: 12 },
        { name: 'Cable fly', canonical: 'Cable fly', value: '17.5 × 12·12·12', why: null, loadKg: 17.5, bestKg: 15 },
      ],
    }),
  );
  assert.deepEqual(
    s.sessionRows.map((r) => r.beatsBest),
    [true, false, false],
    'three "heaviest yet" lines is a hype reel (§15)',
  );
});
