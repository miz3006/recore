import assert from 'node:assert/strict';
import { test } from 'node:test';

import { alpha, dark, light, paletteFor, resolveScheme } from './color.ts';

test('both palettes carry identical keys — no consumer ever branches on theme', () => {
  assert.deepEqual(Object.keys(light).sort(), Object.keys(dark).sort());
});

test('every token is a hex colour, and the soft/scrim tokens carry alpha', () => {
  for (const palette of [dark, light]) {
    for (const [name, value] of Object.entries(palette)) {
      assert.match(value, /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/, `${name} = ${value}`);
    }
    assert.equal(palette.emberSoft.length, 9, 'emberSoft must be #RRGGBBAA');
    assert.equal(palette.scrim.length, 9, 'scrim must be #RRGGBBAA');
  }
});

test('elevation inverts between themes (§6.3)', () => {
  const luma = (hex: string) => {
    const n = parseInt(hex.slice(1, 7), 16);
    return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
  };
  // Dark: surface is LIGHTER than canvas. Light: surfaceHigh is DARKER than surface.
  assert.ok(luma(dark.surface) > luma(dark.canvas), 'dark surface must be raised');
  assert.ok(luma(light.surfaceHigh) < luma(light.surface), 'light surfaceHigh must be recessed');
});

test('the two themes are genuinely distinct, not one palette twice', () => {
  assert.notEqual(dark.canvas, light.canvas);
  assert.notEqual(dark.ink, light.ink);
  // Light ember is darkened specifically to clear AA on paper (§17).
  assert.notEqual(dark.ember, light.ember);
});

test('resolveScheme: an explicit preference always wins', () => {
  assert.equal(resolveScheme('light', 'dark'), 'light');
  assert.equal(resolveScheme('dark', 'light'), 'dark');
  assert.equal(resolveScheme('light', null), 'light');
});

test('resolveScheme: system follows the device, and an unknown device means dark', () => {
  assert.equal(resolveScheme('system', 'light'), 'light');
  assert.equal(resolveScheme('system', 'dark'), 'dark');
  // Dark is the design target — flashing light in a dark gym is the costlier miss.
  assert.equal(resolveScheme('system', null), 'dark');
  assert.equal(resolveScheme('system', undefined), 'dark');
});

test('paletteFor returns the resolved palette object', () => {
  assert.equal(paletteFor('system', 'light'), light);
  assert.equal(paletteFor('system', 'dark'), dark);
  assert.equal(paletteFor('dark', 'light'), dark);
});

test('alpha appends a two-digit channel and clamps out of range', () => {
  assert.equal(alpha('#FF6B3D', 1), '#FF6B3Dff');
  assert.equal(alpha('#FF6B3D', 0), '#FF6B3D00');
  assert.equal(alpha('#FF6B3D', 2), '#FF6B3Dff');
  assert.equal(alpha('#FF6B3D', -1), '#FF6B3D00');
});

test('alpha REPLACES an existing alpha rather than appending a second one', () => {
  // #RRGGBBAAAA is silently invalid on iOS and yields a colour nobody chose.
  assert.equal(alpha(dark.emberSoft, 1), '#FF6B3Dff');
  assert.equal(alpha('#0E111366', 0.5), '#0E111380'); // 0.5 * 255 -> 128 -> 0x80
});

test('alpha expands three-digit hex, preserving the case it was given', () => {
  assert.equal(alpha('#FFF', 1), '#FFFFFFff');
  assert.equal(alpha('#fff', 0), '#ffffff00');
});
