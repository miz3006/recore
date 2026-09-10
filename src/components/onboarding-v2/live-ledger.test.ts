import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

/**
 * THE DEMO IS NOT A MOCKUP, AND THIS IS WHAT KEEPS IT THAT WAY.
 *
 * Owner, 28 August 2026: "Use the real Today page components… Anything that
 * makes it behave differently from Today is a bug."
 *
 * A screenshot cannot catch the regression that matters here — somebody
 * copying `ExerciseCard` into v2 "just to tweak the spacing" would look
 * identical on the day they did it and drift for ever after. These read the
 * source and assert the import, which is the only thing that cannot drift.
 */

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

/** Source with comments removed. The prose in this codebase explains what the
 * code does NOT do ("Today parses through the edge function, and this does
 * not"), so scanning raw text for a forbidden word finds the explanation and
 * calls it the crime. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const LEDGER = read('./LiveLedger.tsx');
const DEMO = read('./screens/DemoScreen.tsx');
const READING = read('./screens/ReadingScreen.tsx');
const WELCOME = read('./SelfWritingLedger.tsx');
const NOTE_SURFACE = read('../note-surface.tsx');

test('the ledger imports the real entry card rather than defining one', () => {
  assert.match(LEDGER, /import \{ ExerciseCard \} from '@\/components\/note-surface'/);
  // If this ever fails, someone has written a second definition of what an
  // entry looks like, and the two will diverge.
  assert.ok(!/function ExerciseCard/.test(LEDGER), 'LiveLedger defines its own card');
});

test('the demo writes on the real Today input', () => {
  assert.match(DEMO, /import \{[^}]*NoteInput[^}]*\} from '@\/components\/note-surface'/);
  assert.match(DEMO, /<NoteInput/);
  // `TextInput` still appears as the ref's TYPE (`useRef<TextInput>`), which is
  // fine and is exactly why this looks for a JSX element — one at the start of
  // a line — rather than for the word.
  assert.ok(!/^\s*<TextInput\b/m.test(code(DEMO)), 'the demo renders its own field');
});

test('Today still uses the same two components it exports', () => {
  assert.match(NOTE_SURFACE, /export function NoteInput\(/);
  assert.match(NOTE_SURFACE, /export function ExerciseCard\(/);
  // The extraction has to be USED by Today, not just exported for the demo —
  // otherwise there are two fields again, one of them unread.
  assert.match(NOTE_SURFACE, /<NoteInput\s/);
  assert.match(NOTE_SURFACE, /<ExerciseCard\b/);
});

test('the demo, the read screen and the welcome demo all draw the same ledger', () => {
  for (const [name, src] of [
    ['DemoScreen', DEMO],
    ['ReadingScreen', READING],
    ['SelfWritingLedger', WELCOME],
  ] as const) {
    assert.match(src, /LiveLedger/, `${name} does not render the shared ledger`);
  }
});

test('nothing in v2 re-implements a set table or a reading row', () => {
  for (const [name, src] of [
    ['LiveLedger', LEDGER],
    ['DemoScreen', DEMO],
    ['ReadingScreen', READING],
    ['SelfWritingLedger', WELCOME],
  ] as const) {
    assert.ok(!/setText.*×|reps\.join/.test(code(src)), `${name} formats sets by hand`);
  }
});

/**
 * The one intended difference, asserted so it stays the only one: the parse
 * runs on the offline grammar. That is what lets the screen work with no
 * network and no account, which is the state it is always in.
 */
test('the parse is the local grammar, never the network', () => {
  assert.match(LEDGER, /demoParseText/);
  assert.match(LEDGER, /buildReceipt/);
  assert.ok(
    !/\bfetch\(|supabase|parse-workout/i.test(code(LEDGER)),
    'the demo reaches the network',
  );
});

test('the reading is built by the real receipt builder', () => {
  assert.match(LEDGER, /import \{ buildReceipt, type ReceiptRow \} from '@\/lib\/parse\/receipt'/);
  // No history yet, so no signals — the gutter stays silent rather than
  // labelled, exactly as it will on a real first session.
  assert.match(LEDGER, /buildReceipt\(demoParseText\(trimmed\), \[\]\)/);
});

/**
 * ALIGNMENT. Every screen in this flow sits on one left edge — `Frame`'s
 * gutter, `spacing.xxl` (24). It used to be the same number as Today's own
 * `BODY_PADDING_H` and is not since 9 September 2026, when Today moved onto the
 * system navigator and its body went to 16 to hang off UIKit's layout margin;
 * the funnel draws no navigation bar, so it keeps its own. What this test is
 * about is unchanged either way: a component that adds its OWN horizontal inset
 * puts itself a few points off whichever edge it is on, which is invisible in
 * isolation and obvious the moment two of them are stacked.
 */
const FRAME = read('./Frame.tsx');
const GHOST = read('./GhostRow.tsx');
const GREETING = read('./screens/GreetingScreen.tsx');
const BUILDING = read('./screens/BuildingScreen.tsx');
const DONE = read('./screens/DoneScreen.tsx');

test('nothing inside the frame adds its own horizontal inset', () => {
  for (const [name, src] of [
    ['LiveLedger', LEDGER],
    ['DemoScreen', DEMO],
    ['ReadingScreen', READING],
    ['GhostRow', GHOST],
  ] as const) {
    assert.ok(
      !/paddingHorizontal:\s*spacing\.(xs|sm|md)\b/.test(code(src)),
      `${name} insets itself off the frame's gutter`,
    );
    assert.ok(
      !/marginHorizontal:\s*spacing\.(xs|sm|md)\b/.test(code(src)),
      `${name} insets itself off the frame's gutter`,
    );
  }
});

test('the screens that opt out of Frame use the same gutter token', () => {
  for (const [name, src] of [
    ['GreetingScreen', GREETING],
    ['BuildingScreen', BUILDING],
    ['DoneScreen', DONE],
  ] as const) {
    assert.match(
      code(src),
      /paddingHorizontal:\s*v2metrics\.gutter/,
      `${name} does not sit on the shared gutter`,
    );
  }
});

test('an empty headline draws nothing rather than an empty line', () => {
  // The insight screens pass `headline=""` and centre their own statement. A
  // `largeTitle` Text with no text is ~40 pt of blank line height, and the
  // content gap sat under it — 72 pt of dead space above a centred screen.
  assert.match(code(FRAME), /\{headline \?/);
  assert.match(code(FRAME), /headline \|\| subline \? styles\.content : styles\.contentBare/);
});
