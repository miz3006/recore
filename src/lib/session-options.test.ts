import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  EMPTY_OPTION_ID,
  REPEAT_OPTION_ID,
  defaultOption,
  sessionOptions,
  type SessionOptionsInput,
} from './session-options.ts';

const PPL: SessionOptionsInput = {
  types: [
    { id: 'push', label: 'Push', detail: '5 movements' },
    { id: 'pull', label: 'Pull' },
    { id: 'legs', label: 'Legs' },
  ],
  dueTypeId: 'pull',
  last: { label: 'Push', detail: 'Tuesday · 18 sets' },
};

test('the options are the detected types, then repeat last, then empty', () => {
  const options = sessionOptions(PPL);
  assert.deepEqual(
    options.map((o) => o.id),
    ['push', 'pull', 'legs', REPEAT_OPTION_ID, EMPTY_OPTION_ID],
  );
  assert.deepEqual(
    options.map((o) => o.kind),
    ['type', 'type', 'type', 'repeat', 'empty'],
  );
  assert.equal(options.find((o) => o.id === 'push')!.detail, '5 movements');
});

test('exactly the due type is marked, and only ever one option is', () => {
  const options = sessionOptions(PPL);
  assert.deepEqual(
    options.filter((o) => o.due).map((o) => o.id),
    ['pull'],
  );
});

test('a due id that matches nothing marks nothing', () => {
  const options = sessionOptions({ ...PPL, dueTypeId: 'upper' });
  assert.equal(options.some((o) => o.due), false);
  // …and the sheet still opens on something.
  assert.equal(defaultOption(options)!.id, 'push');
});

test('a rest day in weekday mode has no due type and still offers everything', () => {
  const options = sessionOptions({ ...PPL, dueTypeId: null });
  assert.equal(options.length, 5);
  assert.equal(options.some((o) => o.due), false);
});

test('no history means nothing to repeat', () => {
  const options = sessionOptions({ ...PPL, last: null });
  assert.equal(options.some((o) => o.kind === 'repeat'), false);
  assert.equal(options[options.length - 1]!.id, EMPTY_OPTION_ID);
});

test('no split at all still offers repeat and empty', () => {
  const options = sessionOptions({ types: [], dueTypeId: null, last: { label: 'Friday' } });
  assert.deepEqual(
    options.map((o) => o.id),
    [REPEAT_OPTION_ID, EMPTY_OPTION_ID],
  );
  assert.equal(options[0]!.detail, 'Friday');
});

test('a blank account is offered the empty session and nothing else', () => {
  const options = sessionOptions({ types: [], dueTypeId: null, last: null });
  assert.deepEqual(
    options.map((o) => o.id),
    [EMPTY_OPTION_ID],
  );
  assert.equal(defaultOption(options)!.kind, 'empty');
});

test('malformed types never reach the sheet', () => {
  const options = sessionOptions({
    types: [
      { id: '  ', label: 'Nameless' },
      { id: 'push', label: '   ' },
      { id: 'pull', label: 'Pull' },
      { id: 'pull', label: 'Pull again' },
    ],
    dueTypeId: 'pull',
    last: null,
  });
  assert.deepEqual(
    options.map((o) => o.id),
    ['pull', EMPTY_OPTION_ID],
  );
  assert.equal(options[0]!.label, 'Pull');
});

test('the sheet opens on the due type when there is one', () => {
  assert.equal(defaultOption(sessionOptions(PPL))!.id, 'pull');
  assert.equal(defaultOption([]), null);
});

test('repeating is never marked as the thing you owe', () => {
  const options = sessionOptions({ types: [], dueTypeId: REPEAT_OPTION_ID, last: { label: 'Push' } });
  assert.equal(options.find((o) => o.kind === 'repeat')!.due, false);
});
