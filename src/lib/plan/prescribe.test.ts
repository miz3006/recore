import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildPlanRow, repScheme, type PlanRowInput } from './prescribe.ts';

const base: PlanRowInput = {
  name: 'Bench Press',
  modality: 'strength',
  todaySets: null,
  priorTops: [],
  incrementKg: 2.5,
};

test('repScheme repeats the reps per set, joined by ·', () => {
  assert.equal(repScheme(3, 5), '5·5·5');
  assert.equal(repScheme(1, '12'), '12');
  assert.equal(repScheme(0, 8), '8'); // clamps to at least one set
});

test('no history → a name-only row (never extrapolate from nothing)', () => {
  assert.deepEqual(buildPlanRow(base, 2.5), { name: 'Bench Press', value: null });
  assert.deepEqual(buildPlanRow({ ...base, todaySets: [] }, 2.5), { name: 'Bench Press', value: null });
});

test('strength with load → "<weight> × <scheme>"', () => {
  const row = buildPlanRow(
    {
      ...base,
      todaySets: [
        { reps: 8, weight_kg: 100, rir: 2 },
        { reps: 8, weight_kg: 100, rir: 2 },
        { reps: 8, weight_kg: 100, rir: 2 },
      ],
    },
    2.5,
  );
  assert.ok(row.value, 'has a value');
  assert.match(row.value!, /^\d+(\.\d+)? × \d+(·\d+)*$/, 'weight × per-set scheme');
});

test('reps-only (bodyweight) → "sets×reps", no weight', () => {
  const row = buildPlanRow(
    {
      ...base,
      name: 'Pull Up',
      todaySets: [
        { reps: 10, weight_kg: null, rir: 1 },
        { reps: 10, weight_kg: null, rir: 1 },
        { reps: 10, weight_kg: null, rir: 1 },
      ],
    },
    2.5,
  );
  assert.ok(row.value);
  assert.match(row.value!, /^\d+×\d+$/);
});

test('cardio/hold with no reps or load → repeats the last distance/duration', () => {
  const cardioSets = [{ reps: null, weight_kg: null, rir: null }];
  assert.equal(
    buildPlanRow({ ...base, name: 'Row', modality: 'cardio', todaySets: cardioSets, lastDistanceM: 5000 }, null)
      .value,
    '5k',
  );
  assert.equal(
    buildPlanRow({ ...base, name: 'Plank', modality: 'hold', todaySets: cardioSets, lastDurationS: 90 }, null)
      .value,
    '90s',
  );
});
