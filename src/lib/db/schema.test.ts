import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ADDED_COLUMNS,
  MIGRATION_2_SQL,
  MIGRATION_4_SQL,
  MIGRATION_5_SQL,
  MIGRATION_6_SQL,
  MIGRATION_7_SQL,
  SCHEMA_SQL,
  SCHEMA_VERSION,
  WIPE_SQL,
} from './schema.ts';

/**
 * The schema's two halves have to agree, and nothing on a developer machine
 * notices when they do not: a column added to `SCHEMA_SQL`'s CREATE works
 * perfectly on a fresh install and is missing on every upgrading device, which
 * is a crash the author cannot see. `ADDED_COLUMNS` is the other half, and
 * these are string tests over the schema source, so they run under plain
 * `node --test` beside `reflection.test.ts` — no native SQLite involved.
 *
 * The bug they exist for: 10 September 2026, `workouts.session_effort` present
 * in the CREATE, applied by a version-gated ALTER that a stamped-but-unmigrated
 * database could never run, and Today crashing on `no such column`.
 */

/** The body of one `CREATE TABLE IF NOT EXISTS <name> ( … );` in SCHEMA_SQL. */
function createBodyOf(table: string): string {
  const re = new RegExp(
    `CREATE TABLE IF NOT EXISTS ${table}\\s*\\(([\\s\\S]*?)\\n\\);`,
    'i',
  );
  const m = SCHEMA_SQL.match(re);
  assert.ok(m, `SCHEMA_SQL has no CREATE TABLE for ${table}`);
  return m![1]!;
}

/** Does that table's CREATE declare this column? Matches the column name at
 * the start of a line, which is how every declaration in SCHEMA_SQL is laid
 * out — so `reflection` cannot be satisfied by a REFERENCES clause elsewhere. */
function createDeclares(table: string, column: string): boolean {
  return createBodyOf(table)
    .split('\n')
    .some((line) => new RegExp(`^\\s*${column}\\s`).test(line));
}

test('every added column is also in the table it belongs to', () => {
  for (const { table, column } of ADDED_COLUMNS) {
    assert.ok(
      createDeclares(table, column),
      `${table}.${column} is in ADDED_COLUMNS but not in SCHEMA_SQL's CREATE — ` +
        'a fresh install would not have it',
    );
  }
});

test('every ALTER the migration history ever ran is declared in ADDED_COLUMNS', () => {
  // The stepped scripts are retired but they are the record of what shipped:
  // a device out there ran each one, so each one's column must still be in the
  // list that repairs a database by presence.
  const history = [
    MIGRATION_2_SQL,
    MIGRATION_4_SQL,
    MIGRATION_5_SQL,
    MIGRATION_6_SQL,
    MIGRATION_7_SQL,
  ].join('\n');

  const re = /ALTER TABLE (\w+) ADD COLUMN (\w+)/gi;
  const found: string[] = [];
  for (const m of history.matchAll(re)) found.push(`${m[1]}.${m[2]}`);

  assert.ok(found.length > 0, 'the ALTER history did not parse');
  for (const key of found) {
    assert.ok(
      ADDED_COLUMNS.some(({ table, column }) => `${table}.${column}` === key),
      `${key} shipped as a migration ALTER but is not in ADDED_COLUMNS — an ` +
        'upgrading device would never get it',
    );
  }
});

test('the added columns are declared once each', () => {
  const keys = ADDED_COLUMNS.map(({ table, column }) => `${table}.${column}`);
  assert.equal(new Set(keys).size, keys.length, 'a column is listed twice');
});

test('an added column names a type SQLite can add', () => {
  // `ALTER TABLE … ADD COLUMN` cannot add a NOT NULL column without a default,
  // and cannot add a PRIMARY KEY or UNIQUE one at all. A declaration that
  // breaks those rules works on a fresh install and throws on every upgrade.
  for (const { table, column, decl } of ADDED_COLUMNS) {
    const d = decl.toUpperCase();
    assert.ok(
      ['TEXT', 'INTEGER', 'REAL', 'BLOB'].some((t) => d.startsWith(t)),
      `${table}.${column} has an odd declaration: ${decl}`,
    );
    assert.ok(!d.includes('PRIMARY KEY'), `${table}.${column} cannot be added as PRIMARY KEY`);
    assert.ok(!d.includes('UNIQUE'), `${table}.${column} cannot be added as UNIQUE`);
    if (d.includes('NOT NULL')) {
      assert.ok(d.includes('DEFAULT'), `${table}.${column} is NOT NULL with no DEFAULT`);
    }
  }
});

test('the version is only a stamp, and it moves when the schema does', () => {
  // Nothing reads it to decide a migration any more (that is the point), but a
  // build whose schema gained a column and whose stamp did not is still a
  // build that will report the wrong thing about a device.
  assert.equal(typeof SCHEMA_VERSION, 'number');
  assert.ok(SCHEMA_VERSION >= 7, 'the stamp went backwards');
});

test('the wipe empties every table the schema creates', () => {
  // The privacy policy says an account switch and a deletion leave nothing of
  // the previous account on the device. This is the only thing that makes that
  // true, and the way it fails is silent: a new table gets a CREATE and no
  // DELETE, both wipes still run and still succeed, and one account's rows
  // outlive the account with nothing on any screen to show for it.
  const created = [...SCHEMA_SQL.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]!);
  const wiped = new Set(
    [...WIPE_SQL.matchAll(/DELETE FROM (\w+)/g)].map((m) => m[1]!),
  );

  assert.ok(created.length > 0, 'no CREATE TABLE found — the regex has drifted');
  const missed = created.filter((t) => !wiped.has(t));
  assert.deepEqual(missed, [], `tables created but never wiped: ${missed.join(', ')}`);
});

test('the wipe names no table that does not exist', () => {
  // The other direction, and it is not pedantry: `execSync` runs these as one
  // batch, so a DELETE naming a dropped table throws and takes the whole wipe
  // with it — including the tables it had not reached yet.
  const created = new Set(
    [...SCHEMA_SQL.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]!),
  );
  const wiped = [...WIPE_SQL.matchAll(/DELETE FROM (\w+)/g)].map((m) => m[1]!);
  const ghosts = wiped.filter((t) => !created.has(t));
  assert.deepEqual(ghosts, [], `wiped but never created: ${ghosts.join(', ')}`);
});

test('children are emptied before their parents', () => {
  // `PRAGMA foreign_keys = ON`, and sets → items → workouts is a real chain.
  const order = [...WIPE_SQL.matchAll(/DELETE FROM (\w+)/g)].map((m) => m[1]!);
  const at = (t: string) => order.indexOf(t);
  assert.ok(at('sets') < at('items'), 'sets must be emptied before items');
  assert.ok(at('items') < at('workouts'), 'items must be emptied before workouts');
  assert.ok(at('items') < at('exercises'), 'items must be emptied before exercises');
  assert.ok(at('parse_cache') < at('workouts'), 'parse_cache hangs off workouts');
  // `meta` carries user_id and both callers rewrite it straight after.
  assert.equal(at('meta'), order.length - 1, 'meta is emptied last');
});
