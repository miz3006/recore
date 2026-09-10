import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_PLOTTED,
  METRICS,
  buildMetrics,
  buildSeries,
  describeSeries,
  monthDay,
  seriesInUnit,
  sessionsFor,
} from './progression-metrics.ts';
import type { LiftSession } from './progression.ts';

const s = (
  canonical: string,
  day: string,
  over: Partial<LiftSession> = {},
): LiftSession => ({
  key: canonical.toLowerCase(),
  canonical,
  workoutId: `w-${canonical}-${day}`,
  day,
  topWeight: 100,
  topReps: 5,
  e1rm: 116.5,
  volume: 1500,
  ...over,
});

const e1rm = METRICS.find((m) => m.key === 'e1rm')!;
const topWeight = METRICS.find((m) => m.key === 'topWeight')!;

test('sessionsFor returns one lift, inside the window, oldest first', () => {
  const rows = [
    s('Squat', '2026-08-20'),
    s('Bench Press', '2026-08-19'),
    s('Squat', '2026-08-02'),
    s('Squat', '2026-05-02'),
  ];
  const out = sessionsFor(rows, 'squat', '2026-07-01');
  assert.deepEqual(out.map((r) => r.day), ['2026-08-02', '2026-08-20']);
});

test('a session that cannot speak to the metric is skipped, never zero-filled', () => {
  const rows = [
    s('Squat', '2026-08-01', { e1rm: 100 }),
    s('Squat', '2026-08-08', { e1rm: null }), // all sets over the rep cap
    s('Squat', '2026-08-15', { e1rm: 110 }),
  ];
  const out = buildSeries(rows, e1rm);
  assert.deepEqual(out.points.map((p) => p.value), [100, 110]);
  // The skipped session must not appear as a crash to zero and back.
  assert.ok(!out.points.some((p) => p.value === 0));
  assert.equal(out.firstDay, '2026-08-01');
});

test('a bodyweight session has no heaviest set and does not plot as zero', () => {
  const out = buildSeries(
    [s('Pull-up', '2026-08-01', { topWeight: null }), s('Pull-up', '2026-08-08', { topWeight: 0 })],
    topWeight,
  );
  assert.deepEqual(out.points, []);
  assert.equal(out.latest, null);
});

test('one point is a reading, not a move — delta stays null', () => {
  const out = buildSeries([s('Squat', '2026-08-01', { e1rm: 100 })], e1rm);
  assert.equal(out.latest, 100);
  assert.equal(out.first, 100);
  assert.equal(out.delta, null, 'a single session must not report "up 0 kg"');
});

test('delta is latest minus the oldest PLOTTED point, and falls as well as rises', () => {
  const up = buildSeries(
    [s('S', '2026-08-01', { e1rm: 100 }), s('S', '2026-08-08', { e1rm: 107.5 })],
    e1rm,
  );
  assert.equal(up.delta, 7.5);
  const down = buildSeries(
    [s('S', '2026-08-01', { e1rm: 110 }), s('S', '2026-08-08', { e1rm: 105 })],
    e1rm,
  );
  assert.equal(down.delta, -5);
});

test('a dense record is capped to the newest MAX_PLOTTED, and firstDay follows the cap', () => {
  const rows = Array.from({ length: MAX_PLOTTED + 6 }, (_, i) =>
    s('Squat', `2026-08-${String(i + 1).padStart(2, '0')}`, { e1rm: 100 + i }),
  );
  const out = buildSeries(rows, e1rm);
  assert.equal(out.points.length, MAX_PLOTTED);
  // The newest are kept...
  assert.equal(out.latest, 100 + MAX_PLOTTED + 5);
  // ...and the label's "since" day is the oldest DRAWN, not the oldest recorded.
  assert.equal(out.firstDay, out.points[0]!.day);
  assert.notEqual(out.firstDay, rows[0]!.day);
  assert.equal(out.delta, out.latest! - out.points[0]!.value);
});

test('an empty record yields a drawable, honest series rather than nothing', () => {
  const out = buildSeries([], e1rm);
  assert.deepEqual(out.points, []);
  assert.equal(out.latest, null);
  assert.equal(out.delta, null);
  assert.equal(out.firstDay, null);
  // The card still knows what it is, so it can draw its placeholder.
  assert.equal(out.name, 'Estimated 1RM');
  assert.equal(out.unit, 'kg');
  assert.equal(out.kind, 'line');
});

test('planned is null until a structured prescription exists, and is never invented', () => {
  for (const m of buildMetrics([s('Squat', '2026-08-01')])) {
    assert.equal(m.planned, null);
  }
  // It is carried through when a caller has one, and it is not a plotted point.
  const withPlan = buildSeries([s('S', '2026-08-01'), s('S', '2026-08-08')], e1rm, 120);
  assert.equal(withPlan.planned, 120);
  assert.equal(withPlan.points.length, 2, 'the planned value must not join the record');
  assert.equal(withPlan.latest, 116.5, 'the big number reports what was LIFTED');
});

test('the metric set offers no "Reps" card off topReps', () => {
  // topReps is MAX(reps) across counted sets — usually the lightest set's rep
  // count. A card drawing it would change meaning session to session.
  assert.equal(METRICS.some((m) => m.name.toLowerCase().includes('rep')), false);
  assert.deepEqual(METRICS.map((m) => m.key), ['e1rm', 'topWeight']);
});

test('buildMetrics returns the cards in stack order', () => {
  const out = buildMetrics([s('Squat', '2026-08-01')]);
  assert.deepEqual(out.map((m) => m.name), ['Estimated 1RM', 'Heaviest set']);
});

test('the sub-label never shows a leading minus, and says "No data yet" when empty', () => {
  const e = (ys: number[]) =>
    describeSeries(
      buildSeries(
        ys.map((y, i) => s('S', `2026-08-${String(i + 1).padStart(2, '0')}`, { e1rm: y })),
        e1rm,
      ),
    );
  assert.equal(e([]), 'No data yet');
  assert.equal(e([100]), 'One session · 1 Aug');
  assert.equal(e([100, 107.5]), 'up 7.5 kg since 1 Aug');
  assert.equal(e([110, 105]), 'down 5 kg since 1 Aug');
  assert.equal(e([100, 100]), 'same as 1 Aug');
  for (const label of [e([]), e([100]), e([110, 105]), e([100, 100])]) {
    assert.ok(!label.includes('-'), `a leading minus reached the screen: ${label}`);
    assert.ok(!label.includes('−'), `a leading minus reached the screen: ${label}`);
  }
});

test('a lift that cannot speak to a metric says so rather than drawing a zero', () => {
  // A pull-up carries no external load: "Heaviest set" has nothing to report.
  const series = buildSeries(
    [s('Pull-up', '2026-08-01', { topWeight: null }), s('Pull-up', '2026-08-08', { topWeight: null })],
    topWeight,
  );
  assert.equal(describeSeries(series), 'No data yet');
  assert.equal(series.latest, null);
});

test('the sub-label counts from the oldest DRAWN day, not the oldest recorded', () => {
  const rows = Array.from({ length: MAX_PLOTTED + 3 }, (_, i) =>
    s('S', `2026-08-${String(i + 1).padStart(2, '0')}`, { e1rm: 100 + i }),
  );
  const label = describeSeries(buildSeries(rows, e1rm));
  assert.ok(label.endsWith(monthDay(rows[3]!.day)), `${label} does not count from the first drawn day`);
});

test('a pound reader gets the whole series in pounds, sub-label included', () => {
  const series = seriesInUnit(
    buildSeries([s('Bench', '2026-08-01', { e1rm: 100 }), s('Bench', '2026-08-08', { e1rm: 140 })], e1rm),
    'lb',
  );
  assert.equal(series.unit, 'lb');
  assert.equal(series.latest, 309);
  assert.equal(series.first, 220);
  assert.deepEqual(
    series.points.map((p) => p.value),
    [220, 309],
  );
  // The sub-label reads the converted delta off the converted unit, so nothing
  // in `describeSeries` had to learn about pounds.
  assert.equal(describeSeries(series), 'up 88 lb since 1 Aug');
});

test('a kilogram reader gets the series back untouched', () => {
  const built = buildSeries([s('Bench', '2026-08-01', { e1rm: 116.5 })], e1rm);
  assert.equal(seriesInUnit(built, 'kg'), built);
});

test('only a load is converted — a future rep metric must not be multiplied', () => {
  const reps = { key: 'topWeight', name: 'Top reps', unit: '', kind: 'line',
    valueOf: (v: LiftSession) => v.topReps } as const;
  const series = seriesInUnit(buildSeries([s('Pull-up', '2026-08-01', { topReps: 12 })], reps), 'lb');
  assert.equal(series.unit, '');
  assert.equal(series.latest, 12);
});
