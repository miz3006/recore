import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  CANVAS,
  MAX_STOP_DELTA,
  PAPER_FIELD_CYCLE_MS,
  PAPER_FIELD_LOCATIONS,
  PAPER_FIELD_STOPS,
  channels,
  isCanvasTone,
  largestStopDelta,
  paperFieldMotion,
} from './paper-field.ts';

test('reduce motion disables the gradient animation, and keeps the gradient', () => {
  const still = paperFieldMotion(true);
  assert.equal(still.animated, false);
  assert.equal(still.cycleMs, 0);
  assert.equal(still.driftPx, 0);
  // The fallback is a STATIC gradient, not a flat colour: the stops are the
  // field, the drift is only how it moves.
  assert.equal(PAPER_FIELD_STOPS.length, 3);
});

test('with motion allowed the drift is measured in tens of seconds', () => {
  const moving = paperFieldMotion(false);
  assert.equal(moving.animated, true);
  assert.ok(moving.driftPx > 0);
  assert.ok(moving.cycleMs >= 20_000, `${moving.cycleMs} ms is not "tens of seconds"`);
  assert.equal(moving.cycleMs, PAPER_FIELD_CYCLE_MS);
});

test('every stop is in the white canvas family and none is outside it', () => {
  for (const stop of PAPER_FIELD_STOPS) {
    assert.ok(isCanvasTone(stop), `${stop} is not a white canvas tone`);
  }
  assert.equal(isCanvasTone('#FFFFFF'), true); // the canvas itself
  // The guard has to be able to say no, or it is asserting nothing.
  assert.equal(isCanvasTone('#007AFF'), false);
  assert.equal(isCanvasTone('#F4F5EF'), false); // the warm paper this replaced
  assert.equal(isCanvasTone('#FDFDF8'), false); // white, tinted warm
  assert.equal(isCanvasTone('#F8F9FB'), false); // white, tinted cool
  assert.equal(isCanvasTone('#F0F0F0'), false); // neutral, but no longer white
  assert.equal(channels('nope'), null);
});

test('the contrast between stops is barely perceptible', () => {
  const delta = largestStopDelta(PAPER_FIELD_STOPS);
  assert.ok(delta > 0, 'a field with no difference between stops is a flat colour');
  assert.ok(delta <= MAX_STOP_DELTA, `stops differ by ${delta} — that reads as a gradient`);
});

test('the canvas colour is a stop of its own field', () => {
  assert.ok(PAPER_FIELD_STOPS.includes(CANVAS));
  // …and it is still the surface Today is drawn on. The theme is RN-only and cannot be
  // imported here, so the value is checked against the theme's source.
  const themeSource = readFileSync(
    path.join(import.meta.dirname, 'theme', 'color.ts'),
    'utf8',
  );
  assert.ok(
    new RegExp(`surface: '${CANVAS}'`).test(themeSource),
    `the field's ${CANVAS} is no longer color.surface`,
  );
});

test('the stops run in order along the diagonal, off-centre', () => {
  assert.equal(PAPER_FIELD_LOCATIONS.length, PAPER_FIELD_STOPS.length);
  assert.equal(PAPER_FIELD_LOCATIONS[0], 0);
  assert.equal(PAPER_FIELD_LOCATIONS[PAPER_FIELD_LOCATIONS.length - 1], 1);
  for (let i = 1; i < PAPER_FIELD_LOCATIONS.length; i += 1) {
    assert.ok(PAPER_FIELD_LOCATIONS[i]! > PAPER_FIELD_LOCATIONS[i - 1]!);
  }
  assert.notEqual(PAPER_FIELD_LOCATIONS[1], 0.5);

  // Lightest to deepest, so the ramp never doubles back on itself.
  const luminance = PAPER_FIELD_STOPS.map((s) => {
    const [r, g, b] = channels(s)!;
    return r + g + b;
  });
  for (let i = 1; i < luminance.length; i += 1) {
    assert.ok(luminance[i]! < luminance[i - 1]!, 'the ramp of the field reverses');
  }
});
