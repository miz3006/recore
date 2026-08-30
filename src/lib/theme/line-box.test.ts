import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

/**
 * ONE multiplier for the reader's text setting, applied ONCE, by whoever owns
 * the thing being measured.
 *
 * React Native grows a `fontSize` AND an explicit `lineHeight` by the OS font
 * scale (`RCTTextAttributes.mm:138`, clamped by the Text's own
 * `maxFontSizeMultiplier`). It does not grow a `View`. So there are exactly two
 * correct shapes, and the failure in both directions is invisible until
 * somebody runs the app at a text size that is not the default:
 *
 *   · text     `lineHeight: lineFor(22)`              — renderer scales it
 *   · a box    `minHeight: textRoom(lineFor(22))`     — nobody else will
 *
 * `lineFor` scaled by `osFontScale` itself until 23 Aug 2026, which squared the
 * multiplier on every line of text in the app: 18 % too tight at iOS's xSmall,
 * where the top of an ascender and the dot of an "i" are cut off by their own
 * line box, and half a line of extra leading at the 1.5x ceiling. It read as
 * correct at the default setting, which is why it survived a year of review —
 * so the rule is checked here rather than remembered.
 */
const SRC = path.join(import.meta.dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** `height: lineFor(20)` / `minHeight: lineFor(20)` — a box that will not grow. */
const BOX_FROM_LINE = /\b(?:min|max)?[Hh]eight:\s*lineFor\(/;
/** `lineHeight: textRoom(...)` — the same scale applied twice, the other way. */
const LINE_FROM_BOX = /\blineHeight:\s*textRoom\(/;
/** `lineHeight: <anything> * osFontScale` — the bug this file exists for. */
const LINE_TIMES_SCALE = /\blineHeight:[^,\n]*osFontScale/;

test('a line height is never used as a view height, and never pre-scaled', () => {
  const files = sourceFiles(SRC);
  assert.ok(files.length > 100, `only ${files.length} source files scanned — wrong path?`);

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const where = path.relative(process.cwd(), file);
    for (const [pattern, why] of [
      [BOX_FROM_LINE, 'sizes a view with `lineFor` — a view is not grown by the reader, wrap it: `textRoom(lineFor(n))`'],
      [LINE_FROM_BOX, 'sets a `lineHeight` through `textRoom` — the renderer already applies that scale to text'],
      [LINE_TIMES_SCALE, 'multiplies a `lineHeight` by `osFontScale` — the renderer already did'],
    ] as const) {
      const hit = pattern.exec(source);
      assert.ok(!hit, `${where}: ${why}\n    ${hit?.[0]}`);
    }
  }
});

test('lineFor itself does not apply the OS font scale', () => {
  const scale = readFileSync(path.join(SRC, 'lib', 'theme', 'scale.ts'), 'utf8');
  const body = /export function lineFor\([^)]*\): number \{([\s\S]*?)\n\}/.exec(scale);
  assert.ok(body, 'lineFor is no longer declared the way this test can read');
  assert.ok(
    !body[1].includes('osFontScale'),
    'lineFor scales by osFontScale again — the renderer already does, and the two multiply',
  );
});
