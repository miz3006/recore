import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  applyLine,
  buildPlannedSession,
  editSet,
  formatKg,
  isComplete,
  logSet,
  movesOf,
  ownsExercise,
  plannedTotals,
  remainingSets,
  setLineText,
  settleFromNote,
  unlogSet,
  type PlannedSession,
} from './planned-session.ts';

const PUSH = () =>
  buildPlannedSession('type', 'Push', [
    { name: 'Bench Press', sets: 3, reps: 8, weightKg: 80 },
    { name: 'Overhead Press', sets: 2, reps: 10, weightKg: 40 },
  ]);

/** Tap every circle, in order, carrying the note along. */
function logAll(session: PlannedSession, note = ''): { session: PlannedSession; note: string } {
  let acc = { session, note };
  for (const set of session.sets) acc = logSet(acc.session, acc.note, set.id);
  return acc;
}

test('a prefilled session is a checklist of planned sets, one row per set', () => {
  const session = PUSH();
  assert.equal(session.sets.length, 5);
  assert.deepEqual(
    movesOf(session).map((m) => [m.exercise, m.sets.length]),
    [
      ['Bench Press', 3],
      ['Overhead Press', 2],
    ],
  );
  assert.ok(session.sets.every((s) => s.state === 'planned'));
  assert.deepEqual(
    session.sets.slice(0, 3).map((s) => s.index),
    [1, 2, 3],
  );
  assert.equal(remainingSets(session), 5);
  assert.equal(isComplete(session), false);
});

test('planned sets are excluded from every total until they are completed', () => {
  const session = PUSH();
  assert.deepEqual(plannedTotals(session), { sets: 0, volumeKg: 0 });
  // …and the note — the one thing the parser, the week and the streak read —
  // is still untouched, which is WHY they are excluded.
  assert.equal(logSet(session, '', 'nope:1').note, '');
});

test('tapping a circle marks the set done and it counts immediately', () => {
  const start = PUSH();
  const { session, note } = logSet(start, '', start.sets[0]!.id);

  assert.equal(session.sets[0]!.state, 'logged');
  assert.equal(session.sets[1]!.state, 'planned');
  assert.deepEqual(plannedTotals(session), { sets: 1, volumeKg: 640 });
  // It moved into the record with the planned values, as real typed text.
  assert.equal(note, 'Bench Press 80kg×8');
  assert.equal(remainingSets(session), 4);
});

test('a second set rewrites the movement line instead of duplicating it', () => {
  const start = PUSH();
  const one = logSet(start, '', start.sets[0]!.id);
  const two = logSet(one.session, one.note, start.sets[1]!.id);

  assert.equal(two.note, 'Bench Press 80kg×8·8');
  assert.equal(two.note.split('\n').length, 1);
  assert.deepEqual(plannedTotals(two.session), { sets: 2, volumeKg: 1280 });
});

test('a whole session logs to one line per movement, and counts in full', () => {
  const { session, note } = logAll(PUSH());
  assert.deepEqual(note.split('\n'), ['Bench Press 80kg×8·8·8', 'Overhead Press 40kg×10·10']);
  assert.deepEqual(plannedTotals(session), { sets: 5, volumeKg: 80 * 8 * 3 + 40 * 10 * 2 });
  assert.equal(isComplete(session), true);
});

test('logging is idempotent — a double tap cannot log a set twice', () => {
  const start = PUSH();
  const once = logSet(start, '', start.sets[0]!.id);
  const twice = logSet(once.session, once.note, start.sets[0]!.id);
  assert.equal(twice.note, once.note);
  assert.deepEqual(plannedTotals(twice.session), plannedTotals(once.session));
});

test('editing logs what actually happened instead of the plan', () => {
  const start = PUSH();
  const edited = editSet(start, '', start.sets[0]!.id, { weightKg: 82.5, reps: 6 });

  assert.equal(edited.session.sets[0]!.state, 'logged');
  assert.equal(edited.session.sets[0]!.weightKg, 82.5);
  assert.equal(edited.session.sets[0]!.reps, 6);
  assert.deepEqual(plannedTotals(edited.session), { sets: 1, volumeKg: 495 });
  assert.equal(edited.note, 'Bench Press 82.5kg×6');
});

test('editing a LOGGED set keeps it logged', () => {
  const start = PUSH();
  const logged = logSet(start, '', start.sets[0]!.id);
  const edited = editSet(logged.session, logged.note, start.sets[0]!.id, { reps: 5 });

  assert.equal(edited.session.sets[0]!.state, 'logged');
  assert.equal(edited.session.sets[0]!.reps, 5);
  assert.deepEqual(plannedTotals(edited.session), { sets: 1, volumeKg: 400 });
  assert.equal(edited.note, 'Bench Press 80kg×5');
  assert.equal(remainingSets(edited.session), 4);
});

test('sets at different loads are spelled out, never averaged', () => {
  const start = PUSH();
  const one = editSet(start, '', start.sets[0]!.id, { weightKg: 80, reps: 8 });
  const two = editSet(one.session, one.note, start.sets[1]!.id, { weightKg: 85, reps: 6 });
  assert.equal(two.note, 'Bench Press 80kg×8 · 85kg×6');
  assert.deepEqual(plannedTotals(two.session), { sets: 2, volumeKg: 80 * 8 + 85 * 6 });
});

test('unchecking takes the set back out of the record', () => {
  const start = PUSH();
  const one = logSet(start, '', start.sets[0]!.id);
  const two = logSet(one.session, one.note, start.sets[1]!.id);
  const undone = unlogSet(two.session, two.note, start.sets[1]!.id);

  assert.equal(undone.session.sets[1]!.state, 'planned');
  assert.equal(undone.note, 'Bench Press 80kg×8');
  assert.deepEqual(plannedTotals(undone.session), { sets: 1, volumeKg: 640 });

  // Down to nothing, the movement leaves the note altogether.
  const empty = unlogSet(undone.session, undone.note, start.sets[0]!.id);
  assert.equal(empty.note, '');
  assert.deepEqual(plannedTotals(empty.session), { sets: 0, volumeKg: 0 });
});

test('a bodyweight movement writes reps and no load', () => {
  const dips = buildPlannedSession('type', 'Push', [
    { name: 'Dips', sets: 3, reps: 16, weightKg: null },
  ]);
  const { note, session } = logAll(dips);
  assert.equal(note, 'Dips 16·16·16');
  assert.deepEqual(plannedTotals(session), { sets: 3, volumeKg: 0 });
});

test('free text coexists: a line written by hand keeps the movement', () => {
  const start = PUSH();
  const typed = 'bench press 100kg x5';
  const settled = settleFromNote(start, typed);

  assert.equal(ownsExercise(settled, 'Bench Press'), false);
  assert.equal(ownsExercise(settled, 'Overhead Press'), true);

  // Ticking a released row still moves the row — and does not touch the note.
  const after = logSet(settled, typed, start.sets[0]!.id);
  assert.equal(after.note, typed);
  assert.equal(after.session.sets[0]!.state, 'logged');

  // The movement the athlete has not written is still written for them.
  const other = logSet(after.session, after.note, start.sets[3]!.id);
  assert.deepEqual(other.note.split('\n'), [typed, 'Overhead Press 40kg×10']);
});

test('the checklist does not release a movement over its own line', () => {
  const start = PUSH();
  const logged = logSet(start, '', start.sets[0]!.id);
  const settled = settleFromNote(logged.session, logged.note);
  assert.deepEqual(settled.released, []);
  assert.equal(ownsExercise(settled, 'Bench Press'), true);
});

test('a released movement stays released for the session', () => {
  const start = PUSH();
  const released = settleFromNote(start, 'bench press 100kg x5');
  const later = settleFromNote(released, '');
  assert.deepEqual(later.released, ['Bench Press']);
});

test('applyLine replaces its own line, appends when there is none, and can remove', () => {
  assert.equal(applyLine('', null, 'Squat 100kg×5'), 'Squat 100kg×5');
  assert.equal(applyLine('warmup\n', null, 'Squat 100kg×5'), 'warmup\nSquat 100kg×5');
  assert.equal(applyLine('a\nSquat 100kg×5\nb', 'Squat 100kg×5', 'Squat 100kg×5·5'), 'a\nSquat 100kg×5·5\nb');
  // The athlete deleted it — appending is right, silently resurrecting it is not.
  assert.equal(applyLine('a', 'Squat 100kg×5', 'Squat 100kg×5·5'), 'a\nSquat 100kg×5·5');
  assert.equal(applyLine('a\nSquat 100kg×5', 'Squat 100kg×5', ''), 'a');
  assert.equal(applyLine('a', null, ''), 'a');
});

test('the line text is the shorthand the parser already reads', () => {
  const s = (weightKg: number | null, reps: number | null, index: number) => ({
    id: `0:${index}`,
    exercise: 'Squat',
    index,
    weightKg,
    reps,
    state: 'logged' as const,
  });
  assert.equal(setLineText('Squat', [s(100, 5, 1), s(100, 5, 2)]), 'Squat 100kg×5·5');
  assert.equal(setLineText('Squat', [s(null, 12, 1)]), 'Squat 12');
  assert.equal(setLineText('Squat', [s(100, null, 1)]), 'Squat 100kg');
  assert.equal(setLineText('Squat', []), '');
  assert.equal(setLineText('Squat', [{ ...s(100, 5, 1), state: 'planned' }]), '');
});

test('loads are written the way they are racked', () => {
  assert.equal(formatKg(80), '80kg');
  assert.equal(formatKg(82.5), '82.5kg');
  assert.equal(formatKg(100.25), '100.25kg');
});

test('an empty session has nothing to check off and nothing to count', () => {
  const empty = buildPlannedSession('empty', 'Empty session', []);
  assert.deepEqual(empty.sets, []);
  assert.deepEqual(plannedTotals(empty), { sets: 0, volumeKg: 0 });
  assert.equal(isComplete(empty), false);
  assert.equal(logSet(empty, 'freehand', '0:1').note, 'freehand');
});

test('a nameless movement never becomes a row', () => {
  const session = buildPlannedSession('type', 'Push', [
    { name: '   ', sets: 3, reps: 8, weightKg: 80 },
    { name: 'Row', sets: 0, reps: 8, weightKg: 60 },
  ]);
  assert.equal(session.sets.length, 1); // sets clamp to at least one
  assert.equal(session.sets[0]!.exercise, 'Row');
});
