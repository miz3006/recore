import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dark, light, type Palette } from './color.ts';
import { AA_BODY, contrastRatio, luminance, meetsAA } from './contrast.ts';

/**
 * The §17 gate: every text token must clear WCAG AA against every surface it can
 * land on, in BOTH themes. This is the test that stops an inaccessible palette
 * reaching a phone — it already caught §6.3's light `inkFaint` at 2.49:1, which
 * fails even the large-text threshold (see PLAN.md Deviations).
 */

/** Every background a text token can sit on. */
const SURFACES = ['canvas', 'surface', 'surfaceHigh'] as const;

/**
 * Every token that renders as text. `rule` is excluded — it is a hairline, not
 * text, and §17's threshold is about reading. `emberSoft` and `scrim` are washes.
 */
const TEXT_TOKENS = ['ink', 'inkMuted', 'inkFaint', 'ember', 'warn', 'danger'] as const;

const THEMES: [string, Palette][] = [
  ['dark', dark],
  ['light', light],
];

for (const [themeName, palette] of THEMES) {
  test(`${themeName}: every text token clears AA on every surface`, () => {
    const failures: string[] = [];
    for (const token of TEXT_TOKENS) {
      for (const surface of SURFACES) {
        const ratio = contrastRatio(palette[token], palette[surface]);
        if (ratio < AA_BODY) {
          failures.push(
            `${themeName}.${token} on ${themeName}.${surface} = ${ratio.toFixed(2)}:1 ` +
              `(needs ${AA_BODY}:1) — ${palette[token]} on ${palette[surface]}`,
          );
        }
      }
    }
    assert.deepEqual(failures, [], `\n  ${failures.join('\n  ')}\n`);
  });
}

test('ember on canvas clears AA in both themes — §17 calls this one out by name', () => {
  assert.ok(meetsAA(dark.ember, dark.canvas), 'dark ember on canvas');
  assert.ok(meetsAA(light.ember, light.canvas), 'light ember on canvas');
});

test('the light theme darkens ember specifically to survive paper (§6.3)', () => {
  assert.ok(
    luminance(light.ember) < luminance(dark.ember),
    'light ember must be darker than dark ember',
  );
});

test('contrastRatio is symmetric and correctly bounded', () => {
  assert.equal(contrastRatio('#FFFFFF', '#000000').toFixed(2), '21.00');
  assert.equal(contrastRatio('#000000', '#FFFFFF').toFixed(2), '21.00');
  assert.equal(contrastRatio('#777777', '#777777').toFixed(2), '1.00');
});

test('luminance ignores any alpha channel — pairs are judged at full opacity', () => {
  assert.equal(luminance('#FF6B3D'), luminance('#FF6B3D1F'));
  assert.equal(luminance('#FFF'), luminance('#FFFFFF'));
});
