import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  duplicateGroups,
  mergePlan,
  nameWords,
  pickExercise,
  sameMovement,
  survivorOf,
  type ExerciseCandidate,
  type MergeCandidate,
} from './exercise-identity.ts';

const row = (canonical: string, ...aliases: string[]): ExerciseCandidate => ({ canonical, aliases });

test('spelling does not decide identity', () => {
  assert.deepEqual(nameWords('Push-up'), ['push', 'up']);
  assert.ok(sameMovement('Push-up', 'push ups'));
  assert.ok(sameMovement('PUSH UPS', 'Push Up'));
  assert.ok(sameMovement('Bench Press', 'bench press'));
  assert.ok(sameMovement('Dips', 'Dip'));
  assert.ok(sameMovement('Barbell Row', 'barbell rows'));
  // Word ORDER is not identity either — the same words are the same movement.
  assert.ok(sameMovement('Chest Press Machine', 'Machine Chest Press'));
  // A double s survives the plural rule: "press" must never become "pres".
  assert.deepEqual(nameWords('Bench Press'), ['bench', 'press']);
});

test('and a qualifier is a different movement', () => {
  assert.ok(!sameMovement('Diamond Push-up', 'Push-up'));
  assert.ok(!sameMovement('Incline Bench Press', 'Bench Press'));
  assert.ok(!sameMovement('Sumo Deadlift', 'Deadlift'));
  assert.ok(!sameMovement('Front Squat', 'Squat'));
});

test('the name the parser gave it outranks any learned shorthand', () => {
  const rows = [row('Incline Bench Press', 'incline bench'), row('Bench Press', 'bench', 'bp')];
  assert.equal(pickExercise(rows, 'Bench Press', ['bench']), 1);
  assert.equal(pickExercise(rows, 'Incline Bench Press', ['incline bench']), 0);
  // A row whose ALIAS is the canonical name is still a canonical-level match.
  assert.equal(pickExercise([row('Bench', 'bench press')], 'Bench Press', ['bench']), 0);
});

test('shorthand resolves when it agrees about the movement', () => {
  const rows = [row('Bench Press', 'bench', 'bp', 'flat bench')];
  assert.equal(pickExercise(rows, 'Bench Press', ['bp']), 0);
  // Spelling differences are not disagreement.
  assert.equal(pickExercise([row('Bench press', 'bench')], 'Bench Press', ['bench']), 0);
  assert.equal(pickExercise([row('Dips', 'dipsi')], 'Dip', ['dipsi']), 0);
});

test('and never when it would rename the movement', () => {
  // THE DEFECT: "diamond push ups" carries the alias "push ups", which the
  // plain Push-up row has already learned. Resolving there merges two
  // movements into one history — and learns the alias, so it stays merged.
  const rows = [row('Push-up', 'push ups', 'sklece')];
  assert.equal(pickExercise(rows, 'Diamond Push-up', ['diamond push ups', 'push ups']), null);
  assert.equal(pickExercise(rows, 'Archer Push-up', ['push ups']), null);
  // The same in reverse: a general movement may not land on a specific row.
  assert.equal(pickExercise([row('Diamond Push-up', 'push ups')], 'Push-up', ['push ups']), null);
  // Nothing to go on at all is nothing, not a guess.
  assert.equal(pickExercise([row('Bench Press', 'bench')], 'Squat', ['squat']), null);
  assert.equal(pickExercise([], 'Bench Press', ['bench']), null);
});

const dupe = (id: string, canonical: string, items: number, local: boolean): MergeCandidate => ({
  id,
  canonical,
  items,
  local,
});

test('the duplicate with the most history behind it survives', () => {
  assert.equal(
    survivorOf([dupe('a', 'Bench Press', 3, true), dupe('b', 'Bench Press', 12, false)])!.id,
    'b',
  );
  // A tie goes to the SYNCED row — the other devices already point at it.
  assert.equal(
    survivorOf([dupe('a', 'Bench Press', 5, true), dupe('b', 'Bench Press', 5, false)])!.id,
    'b',
  );
  // And a tie between two of a kind is decided by the id, so every device
  // that runs this reaches the same answer.
  assert.equal(
    survivorOf([dupe('b', 'Bench Press', 0, true), dupe('a', 'Bench Press', 0, true)])!.id,
    'a',
  );
  assert.equal(survivorOf([]), null);
});

test('duplicates are grouped by the movement, not by the spelling', () => {
  const groups = duplicateGroups([
    dupe('1', 'Bench Press', 10, false),
    dupe('2', 'Bench press', 2, true),
    dupe('3', 'bench presses', 1, true),
    dupe('4', 'Squat', 7, false),
    dupe('5', 'Front Squat', 3, true),
    dupe('6', 'Dip', 4, false),
    dupe('7', 'Dips', 4, true),
  ]);
  assert.equal(groups.length, 2);
  const [bench, dips] = groups.sort((a, b) => (a[0]!.canonical < b[0]!.canonical ? -1 : 1));
  assert.deepEqual(
    bench!.map((r) => r.id),
    ['1', '2', '3'],
  );
  assert.deepEqual(
    dips!.map((r) => r.id),
    ['6', '7'],
  );
  // A qualifier is not a duplicate: Squat and Front Squat stay apart.
  assert.ok(!groups.some((g) => g.some((r) => r.canonical === 'Front Squat')));
});

test('a device folds away only the row it invented itself', () => {
  // `local` = the pull did not confirm it. Deleting a row the account really
  // has would be undone by the very next pull, once per sync pass, for ever.
  const plan = mergePlan([
    dupe('remote', 'Bench Press', 12, false),
    dupe('mine', 'Bench press', 3, true),
  ]);
  assert.equal(plan.length, 1);
  assert.equal(plan[0]!.keep.id, 'remote');
  assert.deepEqual(plan[0]!.losers.map((l) => l.id), ['mine']);
});

test('and the account keeps the row even when the local copy has more history', () => {
  // The other devices already point at the confirmed row; item counts on THIS
  // device do not get to overrule that.
  const plan = mergePlan([
    dupe('remote', 'Squat', 1, false),
    dupe('mine', 'Squat', 40, true),
  ]);
  assert.equal(plan[0]!.keep.id, 'remote');
});

test('two rows the account itself holds are left to the repair script', () => {
  // Both confirmed: a device that deleted one would pull it straight back.
  assert.deepEqual(mergePlan([dupe('a', 'Dip', 4, false), dupe('b', 'Dips', 4, false)]), []);
  // …while two the device invented are merged among themselves.
  const plan = mergePlan([dupe('a', 'Dip', 4, true), dupe('b', 'Dips', 1, true)]);
  assert.equal(plan[0]!.keep.id, 'a');
  assert.deepEqual(plan[0]!.losers.map((l) => l.id), ['b']);
});

test('a movement with one row is never touched', () => {
  assert.deepEqual(mergePlan([dupe('a', 'Bench Press', 3, true)]), []);
  assert.deepEqual(mergePlan([]), []);
});
