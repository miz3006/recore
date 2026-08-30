import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { color, ink } from './color.ts';

/**
 * The palette's own guard rails (28 August 2026).
 *
 * Two jobs, and they are the two ways a design system rots:
 *
 * 1. **No colour is named anywhere but `color.ts`.** A hex in a component is a
 *    value nobody re-measures when the canvas moves — and the canvas has moved
 *    four times.
 * 2. **The neutrals are DERIVED, not picked.** Every grey is the canvas at a
 *    lower OKLCH lightness with its chroma and hue held, or the ink composited
 *    on the canvas at a fixed opacity. The arithmetic is re-run here, so a
 *    hand-typed "nearly the same" grey fails the build.
 */

// --- 1. no hex literals outside this file -----------------------------------

const SRC = path.join(import.meta.dirname, '..', '..');

/**
 * Where a literal is still legitimate.
 *
 * `color.ts` is the source. TESTS may name colours because a guard that cannot
 * write down the value it rejects is asserting nothing (`paper-field.test.ts`
 * has to be able to say "#F2F2F7 is not a canvas tone").
 *
 * COMMENTS are exempt everywhere, and deliberately: this repository records the
 * measured ratio beside almost every token, and the palette's history — which
 * value was tried, what it measured, why it lost — is the reason a future
 * change can be made safely. A rule that forced those out of the prose would
 * trade the thing that makes the system maintainable for a cleaner grep.
 */
const ALLOWED = new Set([path.join('lib', 'theme', 'color.ts')]);
const isTest = (f: string) => f.endsWith('.test.ts') || f.endsWith('.test.tsx');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(e.name)) out.push(full);
  }
  return out;
}

/** Source with block and line comments removed — what actually renders. */
function code(text: string): string[] {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/\/\/.*$/, ''));
}

test('no file outside color.ts names a colour', () => {
  const offenders: string[] = [];
  for (const file of walk(SRC)) {
    const rel = path.relative(SRC, file);
    if (ALLOWED.has(rel) || isTest(file)) continue;
    code(readFileSync(file, 'utf8')).forEach((line, i) => {
      const hits = line.match(/#[0-9A-Fa-f]{6}\b/g);
      if (hits) offenders.push(`${rel}:${i + 1}  ${hits.join(' ')}`);
    });
  }
  assert.deepEqual(
    offenders,
    [],
    `a colour is named outside the palette — move it into color.ts as a token:\n  ${offenders.join('\n  ')}`,
  );
});

test('every token is a full 6-digit hex, so blend() and alpha() can parse it', () => {
  for (const [name, value] of Object.entries(color)) {
    assert.match(value, /^#[0-9A-F]{6}$/, `color.${name} is ${value}`);
  }
});

// --- 2. the neutrals are derived --------------------------------------------

const ch = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
};
const hex = (rgb: number[]) =>
  `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
const toLinear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255;

function toOklab(h: string): [number, number, number] {
  const [R, G, B] = ch(h).map(toLinear) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function fromOklab([L, a, b]: [number, number, number]): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return hex(
    [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ].map(toSrgb),
  );
}
/** Scale OKLCH lightness, holding chroma and hue — the temperature is preserved. */
function darken(h: string, fraction: number): string {
  const [L, a, b] = toOklab(h);
  return fromOklab([L * (1 - fraction), a, b]);
}
/** `fg` at `opacity` over `bg`, resolved opaque. */
function over(fg: string, opacity: number, bg: string): string {
  const f = ch(fg);
  const b = ch(bg);
  return hex(f.map((v, i) => opacity * v + (1 - opacity) * b[i]!));
}

test('the tinted neutrals are the canvas darkened in OKLCH, hue and chroma held', () => {
  assert.equal(color.surfaceHigh, darken(color.canvas, 0.04), 'surfaceHigh is not canvas L × 0.96');
  assert.equal(color.divider, darken(color.canvas, 0.055), 'divider is not canvas L × 0.945');
  assert.equal(color.border, darken(color.canvas, 0.12), 'border is not canvas L × 0.88');
});

test('the greys are the ink composited on the canvas at a fixed opacity', () => {
  assert.equal(color.textSecondary, over(color.textPrimary, 0.64, color.canvas));
  assert.equal(color.textMuted, over(color.textPrimary, 0.5, color.canvas));
  assert.equal(color.disabled, over(color.textPrimary, 0.22, color.canvas));
  assert.equal(color.track, over(color.textPrimary, 0.1, color.canvas));
  // The chart series is sized for the card it is drawn on, not for the page.
  assert.equal(color.inkData, over(color.textPrimary, 0.55, color.surfaceHigh));
});

test('every derived neutral carries the canvas hue, not a cool one', () => {
  const hue = (h: string) => {
    const [, a, b] = toOklab(h);
    return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  };
  const canvasHue = hue(color.canvas);
  for (const name of ['surfaceHigh', 'divider', 'border', 'textSecondary', 'textMuted', 'disabled', 'track', 'inkData'] as const) {
    const d = Math.abs(hue(color[name]) - canvasHue);
    assert.ok(
      Math.min(d, 360 - d) < 25,
      `color.${name} is ${Math.round(hue(color[name]))}° against the canvas's ${Math.round(canvasHue)}° — it drifted off the paper`,
    );
  }
});

test('accent and textPrimary are the same ink, and surface is lighter than the canvas', () => {
  assert.equal(color.accent, color.textPrimary);
  assert.equal(color.brandGlow, color.brand);
  const lum = (h: string) => {
    const [r, g, b] = ch(h).map(toLinear) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  assert.ok(lum(color.surface) > lum(color.canvas), 'surface must float above the canvas');
  assert.ok(lum(color.surfaceHigh) < lum(color.canvas), 'surfaceHigh must recess below it');
});

test('the opacity ladder stays scheme-independent numbers, not colours', () => {
  for (const [name, value] of Object.entries(ink)) {
    assert.equal(typeof value, 'number', `ink.${name} must be an opacity, not a colour`);
    assert.ok(value >= 0 && value <= 1, `ink.${name} is ${value}`);
  }
});
