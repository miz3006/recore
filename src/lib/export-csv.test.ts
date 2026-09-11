import assert from 'node:assert/strict';
import { test } from 'node:test';

import { csvField, RISKY_LEAD } from './csv-field.ts';

/**
 * S6 — CSV formula injection on export (security review, 10 Sep 2026).
 *
 * The attack these pin: a third-party "Hevy export" carries an exercise named
 * `=cmd|'/c calc'!A1`, `import/apply.ts` stores that name as written, the user
 * exports their record, and the formula runs when the export is opened in a
 * spreadsheet. The rule is that a name a spreadsheet would evaluate leaves this
 * function as text, and that everything already true about quoting stays true.
 */

test('a plain name is untouched', () => {
  assert.equal(csvField('Bench Press'), 'Bench Press');
  assert.equal(csvField('Squat 3x5'), 'Squat 3x5');
});

test('a formula lead is neutralised with an apostrophe', () => {
  // Single quotes are not CSV metacharacters — nothing to double, nothing to
  // wrap. The apostrophe alone is what disarms it.
  assert.equal(csvField("=cmd|'/c calc'!A1"), "'=cmd|'/c calc'!A1");
  assert.equal(csvField('=1+1'), "'=1+1");
  assert.equal(csvField('+SUM(A1:A9)'), "'+SUM(A1:A9)");
  assert.equal(csvField('-2+3'), "'-2+3");
  assert.equal(csvField('@SUM(A1)'), "'@SUM(A1)");
});

test('a leading tab or CR is a formula lead too — the whitespace is stripped first', () => {
  // The tab needs no quotes: the delimiter here is a comma, so a tab inside a
  // field is just a character. The CR does, and gets both.
  assert.equal(csvField('\t=1+1'), "'\t=1+1");
  assert.equal(csvField('\r=1+1'), '"\'\r=1+1"');
});

test('a name with a comma is still quoted', () => {
  assert.equal(csvField('Squat, low bar'), '"Squat, low bar"');
});

test('an embedded quote is still doubled', () => {
  assert.equal(csvField('Farmer\'s "walk"'), '"Farmer\'s ""walk"""');
});

test('a newline or CR anywhere still forces quotes', () => {
  assert.equal(csvField('Row\nmachine'), '"Row\nmachine"');
  assert.equal(csvField('Row\rmachine'), '"Row\rmachine"');
});

test('a risky lead AND a comma get both treatments, apostrophe inside the quotes', () => {
  assert.equal(csvField('=Squat, low bar'), '"\'=Squat, low bar"');
});

test('the lead rule only looks at the first character', () => {
  assert.equal(csvField('Squat = heavy'), 'Squat = heavy');
  assert.equal(csvField('1+1'), '1+1');
  assert.equal(RISKY_LEAD.test('Squat'), false);
  assert.equal(RISKY_LEAD.test('=Squat'), true);
});

test('an empty field stays empty', () => {
  assert.equal(csvField(''), '');
});
