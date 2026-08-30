import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

/**
 * An emoji may not be drawn into a line box borrowed from the text face.
 *
 * Apple Color Emoji carries its own metrics — about 1.49x its point size at
 * 19 pt, against SF Pro's 1.18x — because an emoji's ink fills the em. A line
 * box is measured down from its own top, so pinning one shorter than the ink
 * does not shrink the glyph or centre it: iOS keeps the baseline where the
 * descent puts it and the top of every emoji is cut off. The flow carries an
 * emoji on every option of the goal and experience screens, so a single
 * hardcoded line height here is a defect on eleven screens at once.
 *
 * The failure is invisible in review — `lineHeight: 24` next to `fontSize: 19`
 * reads as generous — and it is worse for the readers who need type large,
 * because `moderateScale` does not grow with the OS font scale. That is what
 * this test is for: the correct value is NO value, and nothing about the source
 * says so on its own.
 */
const OPTION_ROW = path.join(import.meta.dirname, 'OptionRow.tsx');

test('the onboarding emoji keeps its own line box', () => {
  const source = readFileSync(OPTION_ROW, 'utf8');

  const style = /\n  emoji: \{([\s\S]*?)\n  \},/.exec(source);
  assert.ok(style, 'OptionRow no longer has an `emoji` style — has the row been rewritten?');

  assert.ok(
    !/lineHeight/.test(style[1]),
    'the emoji style pins a lineHeight; the emoji face is taller than the text face and the top of the glyph is cut off',
  );
  assert.match(
    style[1],
    /fontSize: moderateScale\(/,
    'the emoji size must still scale with the device like every other token',
  );
});
