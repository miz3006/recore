import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  KEYBOARD_FULL_FRACTION,
  MIN_BAND_PX,
  bandHeightAt,
  bandMarginAt,
  ctaLiftAt,
  illustrationHeight,
  illustrationHeightCompact,
  keyboardProgress,
} from './band.ts';

/** The three devices §A.4 asks the band to be verified on. */
const SE = 667;
const FIFTEEN = 852;
const PRO_MAX = 932;

/** The two ends of the transition on the reference device. The component works
 * them out the same way, on the render thread — see the worklet rule below. */
const FULL = illustrationHeight(FIFTEEN);
const COMPACT = illustrationHeightCompact(FIFTEEN);

test('the band is a share of the window, never of the screen content', () => {
  assert.equal(illustrationHeight(SE), Math.round(SE * 0.15));
  assert.equal(illustrationHeight(FIFTEEN), Math.round(FIFTEEN * 0.17));
  assert.equal(illustrationHeight(PRO_MAX), Math.round(PRO_MAX * 0.17));
  // Taller phone, taller band — the ordering must never invert.
  assert.ok(illustrationHeight(SE) < illustrationHeight(FIFTEEN));
  assert.ok(illustrationHeight(FIFTEEN) < illustrationHeight(PRO_MAX));
});

test('the compact band shrinks the mascot but never erases it', () => {
  for (const h of [SE, FIFTEEN, PRO_MAX]) {
    assert.ok(illustrationHeightCompact(h) < illustrationHeight(h));
    assert.ok(illustrationHeightCompact(h) >= MIN_BAND_PX);
  }
});

test('the band is a quarter of the window, not a third', () => {
  // The owner asked for smaller drawings on 14 Aug 2026, and the page has to
  // fit with the keyboard up even if the transition never runs — so the FULL
  // band, not just the compact one, is what has to be small enough.
  for (const h of [SE, FIFTEEN, PRO_MAX]) {
    assert.ok(
      illustrationHeight(h) <= h * 0.17 + 1,
      `the band is ${illustrationHeight(h) / h} of a ${h} pt window`,
    );
    // …and never so small the drawing stops being the first thing seen.
    assert.ok(illustrationHeight(h) >= h * 0.13);
  }
});

test('the transition is a short travel, not a collapse', () => {
  for (const h of [FIFTEEN, PRO_MAX]) {
    const travel = illustrationHeight(h) - illustrationHeightCompact(h);
    assert.ok(travel < illustrationHeight(h) * 0.4, 'the band gives up more than a third');
  }
});

test('keyboard height maps onto 0…1 monotonically and clamps at both ends', () => {
  assert.equal(keyboardProgress(0, FIFTEEN), 0);
  assert.equal(keyboardProgress(-40, FIFTEEN), 0);
  assert.equal(keyboardProgress(FIFTEEN * KEYBOARD_FULL_FRACTION, FIFTEEN), 1);
  // A real iOS keyboard is taller than the normalising fraction: it must pin
  // at 1 rather than run the band past its compact size.
  assert.equal(keyboardProgress(FIFTEEN * 0.45, FIFTEEN), 1);
  assert.equal(keyboardProgress(200, 0), 0);

  let previous = -1;
  for (let kb = 0; kb <= 420; kb += 4) {
    const p = keyboardProgress(kb, FIFTEEN);
    assert.ok(p >= previous, `progress fell from ${previous} to ${p} at ${kb} pt`);
    previous = p;
  }
});

test('the illustration interpolates monotonically from open to closed', () => {
  const full = FULL;
  const compact = COMPACT;

  assert.equal(bandHeightAt(0, full, compact), full);
  assert.equal(bandHeightAt(1, full, compact), compact);

  // Strictly decreasing all the way down, and back up the identical values —
  // one animation, run forwards and then backwards.
  const STEP = 0.01;
  let previous = full;
  for (let p = STEP; p <= 1 + 1e-9; p += STEP) {
    const h = bandHeightAt(p, full, compact);
    assert.ok(h < previous, `height rose from ${previous} to ${h} at progress ${p}`);
    previous = h;
  }
  // Closing runs the SAME interpolation backwards — the identical heights in
  // the opposite order, not a second animation with its own shape.
  const opening: number[] = [];
  for (let p = 0; p <= 1 + 1e-9; p += STEP) opening.push(bandHeightAt(p, full, compact));
  const closing: number[] = [];
  for (let p = 1; p >= -1e-9; p -= STEP) closing.push(bandHeightAt(p, full, compact));
  closing.reverse();
  assert.equal(opening.length, closing.length);
  opening.forEach((h, i) => assert.ok(Math.abs(h - closing[i]!) < 1e-9));
});

test('nothing pops: no single step of the transition is a visible jump', () => {
  const [full, compact] = [FULL, COMPACT];
  const travel = full - compact;
  const STEP = 0.01;
  let biggest = 0;
  for (let p = STEP; p <= 1 + 1e-9; p += STEP) {
    biggest = Math.max(biggest, bandHeightAt(p - STEP, full, compact) - bandHeightAt(p, full, compact));
  }
  // A hundredth of the transition may never move more than a hundredth of the
  // distance — i.e. the curve is continuous, with no step in it anywhere.
  assert.ok(biggest <= travel * STEP + 1e-6, `a single step moved ${biggest} pt`);
});

test('progress outside 0…1 is clamped rather than extrapolated', () => {
  assert.equal(bandHeightAt(-1, FULL, COMPACT), FULL);
  assert.equal(bandHeightAt(2, FULL, COMPACT), COMPACT);
  assert.equal(bandHeightAt(Number.NaN, FULL, COMPACT), FULL);
});

test('the band margins collapse on the same value the height does', () => {
  assert.equal(bandMarginAt(0, 16), 16);
  assert.equal(bandMarginAt(1, 16), 0);
  assert.equal(bandMarginAt(0.5, 16), 8);
  assert.equal(bandMarginAt(4, 16), 0);
});

test('every device the spec names transitions without clipping the band', () => {
  for (const h of [SE, FIFTEEN, PRO_MAX]) {
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const band = bandHeightAt(p, illustrationHeight(h), illustrationHeightCompact(h));
      assert.ok(band >= illustrationHeightCompact(h) - 1e-9);
      assert.ok(band <= illustrationHeight(h) + 1e-9);
    }
  }
});

/**
 * The regression that only a device could find (14 Aug 2026).
 *
 * `keyboardProgress` called a shared `clamp01`, and on the UI runtime that
 * helper is not initialised in the worklet's closure — the onboarding screen
 * threw `clamp01 is not a function` on first render. Reanimated cannot check
 * this and `tsc` cannot either, so the file's own rule is checked here: a
 * function carrying the `worklet` directive may call NOTHING that this module
 * declares.
 */
test('every worklet in band.ts is self-contained', () => {
  const source = readFileSync(path.join(import.meta.dirname, 'band.ts'), 'utf8');
  const declared = [...source.matchAll(/^(?:export )?function (\w+)/gm)].map((m) => m[1]!);
  assert.ok(declared.length >= 5, 'no functions found — the pattern stopped matching');

  const bodies = [...source.matchAll(/^(?:export )?function (\w+)[^]*?^}/gm)];
  let worklets = 0;
  for (const match of bodies) {
    const body = match[0];
    if (!body.includes("'worklet'")) continue;
    worklets += 1;
    for (const name of declared) {
      if (name === match[1]) continue;
      assert.ok(
        !new RegExp(`\\b${name}\\s*\\(`).test(body),
        `worklet ${match[1]} calls ${name} — a worklet may only do arithmetic on its arguments`,
      );
    }
  }
  // keyboardProgress, bandHeightAt, bandMarginAt, ctaLiftAt. Raise this only
  // when a NEW worklet is added deliberately — the count is here so a helper
  // that quietly grows a 'worklet' directive cannot skip the check above.
  assert.equal(worklets, 4, `expected 4 worklets in band.ts, found ${worklets}`);
});

test('the CTA lift clears the keyboard and never pushes the button down', () => {
  // A tall phone's QWERTY over a 34 pt home indicator: the button rides the
  // keyboard, not the paper under it.
  assert.equal(ctaLiftAt(336, 34), -302);
  // Keyboard down.
  assert.equal(ctaLiftAt(0, 34), 0);
  // A keyboard shorter than the inset (an external keyboard's accessory bar)
  // must not return a positive offset — that would push the CTA off the page.
  assert.equal(ctaLiftAt(20, 34), 0);
  assert.equal(ctaLiftAt(34, 34), 0);
  // No safe area: the whole height is the lift.
  assert.equal(ctaLiftAt(260, 0), -260);
  assert.equal(ctaLiftAt(Number.NaN, 34), 0);
});
