import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { mergeDuplicateWorkoutDays, type MergeDb } from './merge-days.ts';
import { SCHEMA_SQL } from './schema.ts';

/**
 * The local merge runs against the REAL schema, with foreign keys on, because
 * the thing most likely to go wrong is a repointed `items` row landing on a
 * workout that is about to be deleted. A mock could not fail that way.
 *
 * The remote twin was checked separately, against the hosted project, with a
 * coach's comment on the middle row — see the migration's own note.
 */

/** `node:sqlite` speaks `prepare()`; `expo-sqlite` speaks the three calls in
 *  `MergeDb`. This is the adapter, and it is the only difference between the
 *  database under test and the one on a phone. */
function open(): { db: DatabaseSync; api: MergeDb } {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  const api: MergeDb = {
    getAllSync: <T,>(sql: string, p: (string | number | null)[]) =>
      db.prepare(sql).all(...p) as T[],
    getFirstSync: <T,>(sql: string, p: (string | number | null)[]) =>
      (db.prepare(sql).get(...p) ?? null) as T | null,
    runSync: (sql: string, p: (string | number | null)[]) => db.prepare(sql).run(...p),
  };
  return { db, api };
}

const AT = '2026-09-10T10:00:00Z';

function seed(
  db: DatabaseSync,
  id: string,
  createdAt: string,
  rawText: string,
  opts: { items?: number; setsPer?: number; at?: string; reflection?: string } = {},
) {
  db.prepare(
    `INSERT INTO workouts (id, user_id, performed_at, raw_text, reflection, created_at, updated_at)
     VALUES (?, 'u1', ?, ?, ?, ?, ?)`,
  ).run(id, opts.at ?? AT, rawText, opts.reflection ?? null, createdAt, createdAt);
  for (let i = 0; i < (opts.items ?? 0); i++) {
    const itemId = `${id}-i${i}`;
    db.prepare('INSERT INTO items (id, workout_id, position) VALUES (?, ?, ?)').run(
      itemId,
      id,
      i,
    );
    for (let s = 0; s < (opts.setsPer ?? 0); s++) {
      db.prepare(
        "INSERT INTO sets (id, item_id, position, kind, reps, weight_kg) VALUES (?, ?, ?, 'working', 12, 120)",
      ).run(`${itemId}-s${s}`, itemId, s);
    }
  }
}

const count = (db: DatabaseSync, table: 'items' | 'sets') =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

const rows = (db: DatabaseSync) =>
  db.prepare("SELECT id, raw_text FROM workouts WHERE user_id = 'u1' ORDER BY created_at").all() as {
    id: string;
    raw_text: string;
  }[];

test('a day split in three becomes one row, oldest surviving', () => {
  const { db, api } = open();
  seed(db, 'w1', '2026-09-10T08:00:00Z', 'benchpress 120kgx12x3', { items: 1, setsPer: 3 });
  seed(db, 'w2', '2026-09-10T09:00:00Z', 'benchpress 120kgx12x3', { items: 1, setsPer: 3 });
  seed(db, 'w3', '2026-09-10T10:30:00Z', 'squat 100x5', { items: 2, setsPer: 2 });

  assert.equal(mergeDuplicateWorkoutDays(api, 'u1'), 2);

  const after = rows(db);
  assert.equal(after.length, 1);
  assert.equal(after[0]!.id, 'w1');
  // The identical row is the split, not a second session — it is NOT repeated.
  assert.equal(after[0]!.raw_text, 'benchpress 120kgx12x3\nsquat 100x5');
  // ...and neither is its READING. Two lines of text, three items and nine
  // sets is the defect this rule exists for: the day would be drawn with a
  // bench-press entry nothing in the record says was performed.
  assert.equal(count(db, 'items'), 3); // w1's one, w3's two
  assert.equal(count(db, 'sets'), 7); // 3 + 2 + 2
  db.close();
});

test('a duplicate whose words were dropped loses its sets with them', () => {
  const { db, api } = open();
  // The owner's screenshot, reduced: a survivor that already says the line
  // twice, and a split row that says it once more.
  seed(db, 'w1', '2026-09-10T08:00:00Z', 'benchpress 120kgx12x3\nbenchpress 120kgx12x3', {
    items: 2,
    setsPer: 3,
  });
  seed(db, 'w2', '2026-09-10T09:00:00Z', 'benchpress 120kgx12x3', { items: 1, setsPer: 3 });

  assert.equal(mergeDuplicateWorkoutDays(api, 'u1'), 1);
  assert.equal(rows(db)[0]!.raw_text, 'benchpress 120kgx12x3\nbenchpress 120kgx12x3');
  assert.equal(count(db, 'items'), 2);
  assert.equal(count(db, 'sets'), 6);
  db.close();
});

test('a survivor with no reading adopts the duplicate’s', () => {
  const { db, api } = open();
  // Same words, and only the duplicate was ever parsed. Dropping its structure
  // here would blank a day that no device can re-read offline.
  seed(db, 'w1', '2026-09-10T08:00:00Z', 'benchpress 120kgx12x3');
  seed(db, 'w2', '2026-09-10T09:00:00Z', 'benchpress 120kgx12x3', { items: 1, setsPer: 3 });

  mergeDuplicateWorkoutDays(api, 'u1');
  assert.equal(count(db, 'items'), 1);
  assert.equal(count(db, 'sets'), 3);
  assert.equal(
    (db.prepare("SELECT workout_id FROM items").get() as { workout_id: string }).workout_id,
    'w1',
  );
  db.close();
});

test('every set survives, and the structure lands in written order', () => {
  const { db, api } = open();
  seed(db, 'w1', '2026-09-10T08:00:00Z', 'bench', { items: 1, setsPer: 3 });
  seed(db, 'w2', '2026-09-10T09:00:00Z', 'squat', { items: 2, setsPer: 2 });

  mergeDuplicateWorkoutDays(api, 'u1');

  const items = db
    .prepare("SELECT id, position FROM items WHERE workout_id = 'w1' ORDER BY position")
    .all() as { id: string; position: number }[];
  assert.deepEqual(
    items.map((i) => i.position),
    [0, 1, 2],
  );
  assert.deepEqual(items.map((i) => i.id), ['w1-i0', 'w2-i0', 'w2-i1']);
  const setCount = db
    .prepare('SELECT COUNT(*) AS n FROM sets')
    .get() as { n: number };
  assert.equal(setCount.n, 7);
  db.close();
});

test('the survivor keeps its own reflection and inherits one it lacks', () => {
  const { db, api } = open();
  seed(db, 'a1', '2026-09-10T08:00:00Z', 'bench', { reflection: 'felt strong' });
  seed(db, 'a2', '2026-09-10T09:00:00Z', 'squat', { reflection: 'tired' });
  mergeDuplicateWorkoutDays(api, 'u1');
  assert.equal(
    (db.prepare("SELECT reflection FROM workouts WHERE id = 'a1'").get() as { reflection: string })
      .reflection,
    'felt strong',
  );

  const { db: db2, api: api2 } = open();
  seed(db2, 'b1', '2026-09-10T08:00:00Z', 'bench');
  seed(db2, 'b2', '2026-09-10T09:00:00Z', 'squat', { reflection: 'tired' });
  mergeDuplicateWorkoutDays(api2, 'u1');
  assert.equal(
    (db2.prepare("SELECT reflection FROM workouts WHERE id = 'b1'").get() as { reflection: string })
      .reflection,
    'tired',
  );
  db.close();
  db2.close();
});

test('two different days are left alone', () => {
  const { db, api } = open();
  seed(db, 'd1', '2026-09-10T08:00:00Z', 'bench', { at: '2026-09-10T10:00:00Z' });
  seed(db, 'd2', '2026-09-11T08:00:00Z', 'squat', { at: '2026-09-11T10:00:00Z' });
  assert.equal(mergeDuplicateWorkoutDays(api, 'u1'), 0);
  assert.equal(rows(db).length, 2);
  db.close();
});

test('another account is never touched', () => {
  const { db, api } = open();
  seed(db, 'm1', '2026-09-10T08:00:00Z', 'mine a');
  seed(db, 'm2', '2026-09-10T09:00:00Z', 'mine b');
  db.prepare(
    `INSERT INTO workouts (id, user_id, performed_at, raw_text, created_at, updated_at)
     VALUES ('t1', 'u2', ?, 'theirs a', '2026-09-10T08:00:00Z', '2026-09-10T08:00:00Z')`,
  ).run(AT);
  db.prepare(
    `INSERT INTO workouts (id, user_id, performed_at, raw_text, created_at, updated_at)
     VALUES ('t2', 'u2', ?, 'theirs b', '2026-09-10T09:00:00Z', '2026-09-10T09:00:00Z')`,
  ).run(AT);

  assert.equal(mergeDuplicateWorkoutDays(api, 'u1'), 1);
  const theirs = db.prepare("SELECT COUNT(*) AS n FROM workouts WHERE user_id = 'u2'").get() as {
    n: number;
  };
  assert.equal(theirs.n, 2);
  db.close();
});

test('running it twice changes nothing the second time', () => {
  const { db, api } = open();
  seed(db, 'w1', '2026-09-10T08:00:00Z', 'bench', { items: 1, setsPer: 2 });
  seed(db, 'w2', '2026-09-10T09:00:00Z', 'squat', { items: 1, setsPer: 2 });
  assert.equal(mergeDuplicateWorkoutDays(api, 'u1'), 2 - 1);
  const text = rows(db)[0]!.raw_text;
  assert.equal(mergeDuplicateWorkoutDays(api, 'u1'), 0);
  assert.equal(rows(db)[0]!.raw_text, text);
  db.close();
});

test('an empty duplicate adds nothing but still goes away', () => {
  const { db, api } = open();
  seed(db, 'w1', '2026-09-10T08:00:00Z', 'bench 100x5');
  seed(db, 'w2', '2026-09-10T09:00:00Z', '   ');
  assert.equal(mergeDuplicateWorkoutDays(api, 'u1'), 1);
  assert.equal(rows(db)[0]!.raw_text, 'bench 100x5');
  db.close();
});

test('an empty survivor takes the duplicate’s text whole', () => {
  const { db, api } = open();
  seed(db, 'w1', '2026-09-10T08:00:00Z', '');
  seed(db, 'w2', '2026-09-10T09:00:00Z', 'bench 100x5');
  mergeDuplicateWorkoutDays(api, 'u1');
  assert.equal(rows(db)[0]!.raw_text, 'bench 100x5');
  db.close();
});
