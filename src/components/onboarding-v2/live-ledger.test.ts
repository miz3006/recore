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
const DEMO_PAGE = read('./DemoPage.tsx');
const READING = read('./screens/ReadingScreen.tsx');
const WELCOME = read('./SelfWritingLedger.tsx');
const NOTE_SURFACE = read('../note-surface.tsx');

test('the ledger imports the real entry card rather than defining one', () => {
  assert.match(LEDGER, /import \{ ExerciseCard \} from '@\/components\/note-surface'/);
  // If this ever fails, someone has written a second definition of what an
  // entry looks like, and the two will diverge.
  assert.ok(!/function ExerciseCard/.test(LEDGER), 'LiveLedger defines its own card');
});

/**
 * THE DEMO IS THE TODAY PAGE, NOT A SCREEN BUILT OUT OF ITS PARTS (10 September
 * 2026). The field was never the composer: the composer is the field plus the
 * rail, the live read-out, the reading beat and the one example sentence, and
 * the demo used to have the first of those five. `Composer` is now one shared
 * component and this is what stops a second copy of it appearing.
 */
test('the demo writes on the real Today composer', () => {
  assert.match(DEMO_PAGE, /import \{[\s\S]*?\bComposer\b[\s\S]*?\} from '@\/components\/note-surface'/);
  assert.match(DEMO_PAGE, /<Composer/);
  // `TextInput` still appears as the ref's TYPE (`RefObject<TextInput>`), which
  // is fine and is exactly why this looks for a JSX element — one at the start
  // of a line — rather than for the word.
  assert.ok(!/^\s*<TextInput\b/m.test(code(DEMO_PAGE)), 'the demo renders its own field');
  assert.ok(!/function Composer/.test(code(DEMO_PAGE)), 'the demo defines its own composer');
});

/**
 * Every part of the record on that page is Today's own definition, imported.
 * Each of these is a component somebody could plausibly rebuild "just to tweak
 * the spacing", which would look identical on the day and drift for ever after.
 */
test('the demo draws the record with Today’s own blocks', () => {
  for (const name of ['ExerciseCard', 'EditRow', 'NoteCard', 'PendingCard']) {
    assert.match(
      DEMO_PAGE,
      new RegExp(`import \\{[\\s\\S]*?\\b${name}\\b[\\s\\S]*?\\} from '@/components/note-surface'`),
      `DemoPage does not import ${name}`,
    );
    assert.ok(!new RegExp(`function ${name}\\b`).test(code(DEMO_PAGE)), `DemoPage defines its own ${name}`);
  }
});

test('Today still uses the same components it exports', () => {
  assert.match(NOTE_SURFACE, /export function NoteInput\(/);
  assert.match(NOTE_SURFACE, /export function ExerciseCard\(/);
  assert.match(NOTE_SURFACE, /export function Composer\(/);
  // The extraction has to be USED by Today, not just exported for the demo —
  // otherwise there are two fields again, one of them unread. `NoteInput` is
  // reached through `Composer` now, which is why it is not looked for as a tag.
  assert.match(NOTE_SURFACE, /<Composer\s/);
  assert.match(NOTE_SURFACE, /<ExerciseCard\b/);
});

/**
 * The two screens that REPLAY a parse still share one ledger. The demo screen
 * left this list on 10 September 2026 and did not lose anything by it: it draws
 * the record the way Today draws it — a card per reading, as each line settles —
 * which is a stronger claim than sharing a component with the replay.
 */
test('the read screen and the welcome demo draw the same ledger', () => {
  for (const [name, src] of [
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
    ['DemoPage', DEMO_PAGE],
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
  // `DemoScreen` is not on this list any more and cannot be: since 10 September
  // 2026 it is a BLEEDING screen — it hands the frame's body to a page that
  // brings its own left edge (`v2metrics.gutter`, asserted below), and what is
  // left in the screen file is the bar that rides on the keyboard, whose insets
  // are the accessory row's own and are deliberately Today's.
  for (const [name, src] of [
    ['LiveLedger', LEDGER],
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

/**
 * THE PAGE BRINGS ITS OWN EDGE, and it is the funnel's. Today's body sits at 16
 * because a UIKit large title hangs off a 16 pt layout margin; this page draws
 * no navigation bar and stands under the flow's back circle and progress rail,
 * which are at 24. One left edge per screen beats matching a number whose
 * reason is not present — but it has to be the TOKEN, so that the day the
 * funnel's gutter moves, this moves with it.
 */
test('the demo page draws on the funnel’s own gutter', () => {
  assert.match(code(DEMO_PAGE), /paddingHorizontal:\s*v2metrics\.gutter/);
  assert.ok(
    !/paddingHorizontal:\s*\d/.test(code(DEMO_PAGE)),
    'DemoPage hard-codes a gutter',
  );
});

/**
 * The demo runs before there is an account, so the doors that need one are not
 * drawn rather than drawn dead: no history to look up, nowhere to keep a note.
 */
test('the demo only offers the entry actions that work without an account', () => {
  assert.match(code(DEMO_PAGE), /only=\{DEMO_ACTIONS\}/);
  assert.match(code(DEMO_PAGE), /const DEMO_ACTIONS: EntryAction\[\] = \['fix', 'delete'\]/);
});
