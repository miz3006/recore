import assert from 'node:assert/strict';
import { test } from 'node:test';

import { estimateVolume, groupThousands } from './estimate.ts';

/**
 * THE TOOLBAR'S INSTANT TONNAGE — what the status pill shows in the seconds
 * between a line being typed and the edge function answering. It is display
 * garnish (`parsedVolume` replaces it the moment the reading lands) and it is
 * still a NUMBER the app puts on screen, so it may be rough but never absurd,
 * and never zero for a session that plainly has tonnage in it.
 */

test('sets × reps at a stated load', () => {
  assert.equal(estimateVolume('bench 3x8 80kg'), 1920);
  assert.equal(estimateVolume('bench 2x8 1x6 100kg'), 2200);
  assert.equal(estimateVolume('squat 5x5 140kg\nbench 3x8 80kg'), 5 * 5 * 140 + 3 * 8 * 80);
});

test('a load glued to its reps is still a load', () => {
  // The defect: `\b\d+\b` finds no boundary between the 0 and the x of
  // "100x5", so every line written this way estimated as ZERO and a staged
  // pyramid showed no tonnage at all.
  assert.equal(estimateVolume('deadlift 60x5 100x5 140x3'), 60 * 5 + 100 * 5 + 140 * 3);
  assert.equal(estimateVolume('bench 100x8 90x10 80x12'), 100 * 8 + 90 * 10 + 80 * 12);
  assert.equal(estimateVolume('squat 120kgx10 100kgx15 90kgx8'), 120 * 10 + 100 * 15 + 90 * 8);
});

test('bodyweight and cardio have no tonnage', () => {
  assert.equal(estimateVolume('dips 15x2 16x1'), 0);
  assert.equal(estimateVolume('pull ups 3x10'), 0);
  assert.equal(estimateVolume('plank 3x60s'), 0);
  assert.equal(estimateVolume('run 5k 24:30'), 0);
  assert.equal(estimateVolume(''), 0);
  assert.equal(estimateVolume('felt tired today'), 0);
});

test('a bare load that is neither a set count nor a rep count still counts', () => {
  assert.equal(estimateVolume('kb swing 24 x20'), 480);
});

test('pounds are converted before they are counted', () => {
  // 225 lb ≈ 102.06 kg; the pill speaks kilograms like every other number.
  const kg = estimateVolume('bench 225lbx5');
  assert.ok(Math.abs(kg - 5 * 102.06) < 1, `got ${kg}`);
});

test('the estimate never invents a number a line does not carry', () => {
  for (const line of ['Push day', '16.7.', 'squat', '???', '3 rounds:', 'bench press']) {
    assert.equal(estimateVolume(line), 0, line);
  }
});

test('thousands are grouped the way the pill prints them', () => {
  assert.equal(groupThousands(0), '0');
  assert.equal(groupThousands(999), '999');
  assert.equal(groupThousands(2040), '2,040');
  assert.equal(groupThousands(1234567), '1,234,567');
  assert.equal(groupThousands(1999.6), '2,000');
});

/**
 * THE PILL READS THE LINE NOW (11 September 2026). `estimateVolume` asks
 * `lib/demo-parse.ts` first and keeps the pairs grammar as its floor. Scored
 * against the eval corpus's own expectations, over the 22 cases that state
 * enough to compute a tonnage: 10/22 within 2% before, 20/22 after, ten better
 * and none worse. These pin the two readings that moved.
 */
test('a pound glued to its set notation is still a pound', () => {
  // "225lbx5" has no word boundary between the b and the x, so the unit used to
  // be missed and 225 lb was counted as 225 kg — a silent 2.2x overstatement,
  // invisible on kg lines because there is nothing to convert.
  const glued = estimateVolume('bench 225lbx5');
  const spaced = estimateVolume('bench 225lb x5');
  assert.ok(Math.abs(glued - spaced) < 1, `glued ${glued} vs spaced ${spaced}`);
  assert.ok(Math.abs(glued - 5 * 102.06) < 1, `got ${glued}`);
});

test('a classic plate number with no unit is pounds', () => {
  // The parser's own rule: 95/135/185/225/275/315/365/405 are pounds. Without
  // it "185x5x3" reported 2,775 kg for a session that was 1,259.
  const kg = estimateVolume('squat 185x5x3');
  assert.ok(Math.abs(kg - 15 * 83.9) < 15, `got ${kg}`);
});

test('a unit that IS written wins over the plate rule', () => {
  // Somebody who types 135kg means 135 kilograms and said so.
  assert.ok(Math.abs(estimateVolume('squat 135kg x5') - 675) < 1);
});

test('a better reader does not become a more inventive one', () => {
  // The floor from the older test, restated against the grammar-backed path.
  for (const line of ['Push day', '16.7.', 'squat', '???', '3 rounds:', 'bench press']) {
    assert.equal(estimateVolume(line), 0, line);
  }
});
