import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { SCHEMA_SQL } from '../db/schema.ts';

/**
 * THE PULL ORDER IS A FOREIGN KEY, NOT A PREFERENCE.
 *
 * `items.exercise_id` and `alias_overrides.exercise_id` reference `exercises`,
 * and this database runs with `PRAGMA foreign_keys = ON` (`db/index.ts`). A
 * pull that inserts a workout's structure before the catalogue it points at
 * therefore does not degrade — it THROWS, and `pullRemote` has no inner
 * try/catch, so the whole pass dies with it: no catalogue, no alias fixes, no
 * ghosts, and `last_pull_at` never written, so the next pass starts from the
 * same place and dies in the same spot. For ever.
 *
 * That is not a hypothetical. On 10 September 2026 a development device was
 * found with `last_pull_at` unset and thirty exercise rows in the account for
 * eight movements: nothing had ever been pulled, so every parse resolved
 * against an empty catalogue, invented a row and pushed it. The tests below
 * pin the constraint that caused it and the order that fixes it.
 */

const openSchema = () => {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  return db;
};

const WORKOUT = ['w1', 'u1', '2026-09-10T10:00:00Z', 'bench 3x8 80kg', '2026-09-10', '2026-09-10'];

test('the schema really does enforce foreign keys', () => {
  const db = openSchema();
  assert.equal(db.prepare('PRAGMA foreign_keys').get()!.foreign_keys, 1);
  db.close();
});

test('structure pulled BEFORE the catalogue throws and takes the pass with it', () => {
  const db = openSchema();
  db.prepare(
    'INSERT INTO workouts (id, user_id, performed_at, raw_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(...WORKOUT);

  assert.throws(
    () =>
      db
        .prepare(
          'INSERT OR REPLACE INTO items (id, workout_id, position, exercise_id, group_key, group_pos) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run('i1', 'w1', 0, 'exercise-this-device-has-never-seen', null, null),
    /FOREIGN KEY/i,
    'an item may not reference an exercise the device has not pulled yet',
  );

  assert.throws(
    () =>
      db
        .prepare(
          'INSERT INTO alias_overrides (user_id, alias, exercise_id, created_at) VALUES (?, ?, ?, ?)',
        )
        .run('u1', 'bench', 'exercise-this-device-has-never-seen', '2026-09-10'),
    /FOREIGN KEY/i,
  );
  db.close();
});

test('and lands cleanly when the catalogue comes first', () => {
  const db = openSchema();
  db.prepare(
    'INSERT INTO workouts (id, user_id, performed_at, raw_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(...WORKOUT);
  db.prepare(
    'INSERT INTO exercises (id, user_id, canonical, aliases, modality, increment_kg, dirty) VALUES (?, ?, ?, ?, ?, ?, 0)',
  ).run('e1', 'u1', 'Bench Press', '["bench"]', 'strength', 2.5);

  db.prepare(
    'INSERT OR REPLACE INTO items (id, workout_id, position, exercise_id, group_key, group_pos) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('i1', 'w1', 0, 'e1', null, null);
  db.prepare(
    'INSERT INTO alias_overrides (user_id, alias, exercise_id, created_at) VALUES (?, ?, ?, ?)',
  ).run('u1', 'bench', 'e1', '2026-09-10');

  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM items').get()!.n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM alias_overrides').get()!.n, 1);
  db.close();
});

test('pullRemote pulls the catalogue before anything that references it', () => {
  // The order above is only true if the code keeps it. This reads the function
  // itself rather than trusting a comment.
  const source = readFileSync(path.join(import.meta.dirname, 'index.ts'), 'utf8');
  const pull = source.slice(source.indexOf('async function pullRemote'));
  const at = (needle: string) => {
    const i = pull.indexOf(needle);
    assert.ok(i > 0, `pullRemote no longer contains ${needle}`);
    return i;
  };
  const exercises = at("from('exercises')");
  assert.ok(exercises < at("from('alias_overrides')"), 'alias overrides reference exercises');
  assert.ok(exercises < at("from('workouts')"), 'the catalogue is pulled before the workouts');
  assert.ok(exercises < at('pullStructure('), 'items reference exercises');
});
