import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  CANVAS,
  MAX_STOP_CONTRAST,
  PAPER_FIELD_LOCATIONS,
  PAPER_FIELD_STOPS,
  channels,
  contrast,
  isCanvasTone,
  largestStopContrast,
} from './paper-field.ts';

test('the field is a gradient of three stops and nothing about it moves', () => {
  assert.equal(PAPER_FIELD_STOPS.length, 3);
  // The drift is retired (design skill §Canvas: "static, and never animates"),
  // so this module must not hand a component anything to animate.
  const source = readFileSync(path.join(import.meta.dirname, 'paper-field.ts'), 'utf8');
  for (const gone of ['paperFieldMotion', 'CYCLE_MS', 'DRIFT_PX']) {
    assert.ok(!source.includes(`export ${gone}`) && !source.includes(`export const ${gone}`) &&
      !source.includes(`export function ${gone}`), `${gone} is back — the canvas must not move`);
  }
});

test('every stop is in the canvas family and none is outside it', () => {
  for (const stop of PAPER_FIELD_STOPS) {
    assert.ok(isCanvasTone(stop), `${stop} is not a canvas tone`);
  }
  // The guard has to be able to say no, or it is asserting nothing.
  assert.equal(isCanvasTone('#FFFFFF'), false); // white is a SURFACE, never the canvas
  assert.equal(isCanvasTone('#F2F2F7'), false); // the grouped grey this replaced
  assert.equal(isCanvasTone('#F4F5EF'), false); // the green-cast paper before that
  assert.equal(isCanvasTone('#F8F9FB'), false); // near-white, but cool
  assert.equal(isCanvasTone('#F0F0F0'), false); // tintless, and no longer near-white
  assert.equal(isCanvasTone('#0B5CD6'), false); // the brand
  assert.equal(channels('nope'), null);
});

test('the step between stops is under what an eye resolves', () => {
  const worst = largestStopContrast(PAPER_FIELD_STOPS);
  assert.ok(worst > 1, 'a field with no difference between stops is a flat colour');
  assert.ok(worst <= MAX_STOP_CONTRAST, `stops differ by ${worst}:1 — that reads as a gradient`);
});

test('the ink ladder is measurable against one canvas value', () => {
  // Everything in the app is contrast-checked against `canvas`. That only holds
  // if no pixel of the gradient is meaningfully darker than it, whatever the
  // stop under it.
  for (const stop of PAPER_FIELD_STOPS) {
    assert.ok(
      contrast(stop, CANVAS) <= MAX_STOP_CONTRAST,
      `${stop} is ${contrast(stop, CANVAS)}:1 from the canvas the ink was measured on`,
    );
  }
  assert.ok(contrast('#6E6E73', PAPER_FIELD_STOPS[2]!) >= 4.5, 'textSecondary fails AA on a stop');
  assert.ok(contrast('#547C00', PAPER_FIELD_STOPS[2]!) >= 4.5, 'signal fails AA on a stop');
});

test('the canvas colour is a stop of its own field, and the theme agrees', () => {
  assert.ok(PAPER_FIELD_STOPS.includes(CANVAS));
  // The theme is RN-only and cannot be imported here, so the values are checked
  // against its source. All three tints, so a recolour cannot land by halves.
  const themeSource = readFileSync(path.join(import.meta.dirname, 'theme', 'color.ts'), 'utf8');
  assert.ok(
    new RegExp(`canvas: '${CANVAS}'`).test(themeSource),
    `the field's ${CANVAS} is no longer color.canvas`,
  );
  assert.ok(new RegExp(`canvasTop: '${PAPER_FIELD_STOPS[0]}'`).test(themeSource));
  assert.ok(new RegExp(`canvasBot: '${PAPER_FIELD_STOPS[2]}'`).test(themeSource));
});

test('the stops run in order along the diagonal, off-centre', () => {
  assert.equal(PAPER_FIELD_LOCATIONS.length, PAPER_FIELD_STOPS.length);
  assert.equal(PAPER_FIELD_LOCATIONS[0], 0);
  assert.equal(PAPER_FIELD_LOCATIONS[PAPER_FIELD_LOCATIONS.length - 1], 1);
  for (let i = 1; i < PAPER_FIELD_LOCATIONS.length; i += 1) {
    assert.ok(PAPER_FIELD_LOCATIONS[i]! > PAPER_FIELD_LOCATIONS[i - 1]!);
  }
  assert.notEqual(PAPER_FIELD_LOCATIONS[1], 0.5);

  // Peach at the top, lavender at the bottom: the ends differ by HUE, and the
  // warm end must stay the warm end.
  const [topR, , topB] = channels(PAPER_FIELD_STOPS[0])!;
  const [botR, , botB] = channels(PAPER_FIELD_STOPS[2])!;
  assert.ok(topR - topB > botR - botB, 'the warm end of the diagonal is no longer the top');
});
