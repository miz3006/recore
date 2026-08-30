import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { color } from './theme/color.ts';
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
  const text = readFileSync(new URL('./paper-field.ts', import.meta.url), 'utf8');
  for (const gone of ['paperFieldMotion', 'CYCLE_MS', 'DRIFT_PX']) {
    assert.ok(!text.includes(`export ${gone}`), `${gone} is back — the canvas must not move`);
  }
});

test('every stop is in the canvas family and none is outside it', () => {
  for (const stop of PAPER_FIELD_STOPS) {
    assert.ok(isCanvasTone(stop), `${stop} is not a canvas tone`);
  }
  // The guard has to be able to say no, or it is asserting nothing.
  assert.equal(isCanvasTone('#FFFFFF'), false); // white is a SURFACE, never the canvas
  assert.equal(isCanvasTone('#F2F2F7'), false); // the grouped grey this replaced
  assert.equal(isCanvasTone('#F8F9FB'), false); // near-white, but cool
  assert.equal(isCanvasTone('#F0F0F0'), false); // tintless, and no longer near-white
  assert.equal(isCanvasTone('#007AFF'), false); // the brand
  assert.equal(isCanvasTone('#FCF9F4'), false); // the warm paper of 20 Aug — too light for this canvas now
  assert.equal(channels('nope'), null);
});

test('rule 3 is "blue never leads", and the canvas itself passes it', () => {
  // 28 Aug 2026: the rule used to be `r >= g && r >= b`, which rejected the
  // app's own canvas — #F4F5EF is rgb(244, 245, 239), green ahead of red by one.
  const [r, g, b] = channels(CANVAS)!;
  assert.ok(g > r, 'the canvas is green-led — that is the case rule 3 was rewritten for');
  assert.ok(b <= Math.max(r, g), 'blue leads the canvas');
  assert.ok(isCanvasTone(CANVAS));
  // A magenta-leaning lavender is still admissible; a blue-leaning one is not.
  assert.equal(isCanvasTone('#F7F4F7'), true);
  assert.equal(isCanvasTone('#F4F4F9'), false);
});

test('the step between stops is under what an eye resolves', () => {
  const worst = largestStopContrast(PAPER_FIELD_STOPS);
  assert.ok(worst > 1, 'a field with no difference between stops is a flat colour');
  assert.ok(worst <= MAX_STOP_CONTRAST, `stops differ by ${worst}:1 — that reads as a gradient`);
});

test('the stops are matched on LUMINANCE, so every ink measures the same on all three', () => {
  // The 28 Aug derivation solved each stop for the canvas's own relative
  // luminance rather than for its OKLCH lightness. That is what lets
  // `theme/color.ts` say "on canvas" and mean one number.
  for (const stop of PAPER_FIELD_STOPS) {
    assert.ok(
      contrast(stop, CANVAS) <= 1.01,
      `${stop} is ${contrast(stop, CANVAS)}:1 from the canvas — the stops are no longer luminance-matched`,
    );
  }
  const spread = (ink: string) => {
    const rs = PAPER_FIELD_STOPS.map((s) => contrast(ink, s));
    return Math.max(...rs) - Math.min(...rs);
  };
  for (const ink of [color.textPrimary, color.textSecondary, color.signal, color.gain]) {
    assert.ok(spread(ink) < 0.1, `${ink} varies by ${spread(ink)} across the field`);
  }
});

test('every information-carrying ink clears AA on every stop', () => {
  for (const stop of PAPER_FIELD_STOPS) {
    for (const [name, ink] of [
      ['textSecondary', color.textSecondary],
      ['attention', color.attention],
      ['gain', color.gain],
      ['loss', color.loss],
      ['warning', color.warning],
      ['error', color.error],
    ] as const) {
      assert.ok(contrast(ink, stop) >= 4.5, `${name} ${ink} is ${contrast(ink, stop)}:1 on ${stop}`);
    }
    // textMuted and the brand are large-text / non-text marks only — 3:1.
    assert.ok(contrast(color.textMuted, stop) >= 3, `textMuted fails 3:1 on ${stop}`);
    assert.ok(contrast(color.brand, stop) >= 3, `brand fails 3:1 on ${stop}`);
  }
});

test('TRIPWIRE: signal is four thousandths under AA on the paper canvas', () => {
  // Owner-accepted on 28 Aug 2026, and asserted rather than mentioned so it
  // cannot quietly become folklore. `signal` #547C00 measured 4.57:1 on the
  // canvas it left and measures 4.4962:1 on this one. Neither the green nor the
  // canvas may move without the owner (CLAUDE.md §3; onboarding-v2-spec §0).
  //
  // WHEN THIS FAILS, one of two things happened and both need a decision:
  //   - it went UP   → the fix landed. #4F7500 is the value that clears 4.5 on
  //                    every stop. Replace this test with a plain >= 4.5.
  //   - it went DOWN → something darkened the canvas or lightened the green.
  //                    Re-measure the whole ladder in theme/color.ts.
  const worst = Math.min(...PAPER_FIELD_STOPS.map((s) => contrast(color.signal, s)));
  assert.ok(worst >= 4.49, `signal fell further: ${worst}:1`);
  assert.ok(worst < 4.5, `signal now clears AA (${worst}:1) — delete this tripwire`);
});

test('the canvas colour is a stop of its own field, and the theme is the source', () => {
  assert.ok(PAPER_FIELD_STOPS.includes(CANVAS));
  // Imported, not string-matched: the field cannot drift from the palette now.
  assert.equal(CANVAS, color.canvas);
  assert.deepEqual([...PAPER_FIELD_STOPS], [color.canvasTop, color.canvas, color.canvasBot]);
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
