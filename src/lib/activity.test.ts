import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildActivityGrid,
  cursorOf,
  GRID_WEEKS,
  mondayOf,
  monthGrid,
  monthsDescending,
} from './activity.ts';

// Tue 28 Jul 2026. Its Monday is 27 Jul.
const TODAY = '2026-07-28';

test('mondayOf snaps to the Monday of that week, and is a no-op on a Monday', () => {
  assert.equal(mondayOf('2026-07-28'), '2026-07-27'); // Tuesday
  assert.equal(mondayOf('2026-07-27'), '2026-07-27'); // Monday
  assert.equal(mondayOf('2026-08-02'), '2026-07-27'); // Sunday belongs back
});

test('the grid is weeks × 7 and ends in the week containing today', () => {
  const grid = buildActivityGrid([], TODAY);
  assert.equal(grid.length, GRID_WEEKS);
  for (const week of grid) assert.equal(week.days.length, 7);
  assert.equal(grid[grid.length - 1]!.days[0]!.key, '2026-07-27');
  assert.equal(grid[grid.length - 1]!.days[6]!.key, '2026-08-02');
});

test('a trained day fills its own dot and nothing else', () => {
  const grid = buildActivityGrid(['2026-07-27', '2026-07-29'], TODAY);
  const last = grid[grid.length - 1]!;
  assert.deepEqual(
    last.days.map((d) => d.trained),
    [true, false, true, false, false, false, false],
  );
});

test('days after today are future, not missed — the week is only half lived', () => {
  const last = buildActivityGrid([], TODAY)[GRID_WEEKS - 1]!;
  // Mon 27th and Tue 28th have happened; Wed 29th onward have not.
  assert.deepEqual(
    last.days.map((d) => d.future),
    [false, false, true, true, true, true, true],
  );
  // Nothing before this week is ever future.
  for (const week of buildActivityGrid([], TODAY).slice(0, -1)) {
    assert.ok(week.days.every((d) => !d.future));
  }
});

test('a month label appears once, on the week that opens the month', () => {
  const labels = buildActivityGrid([], TODAY).map((w) => w.monthLabel);
  const named = labels.filter(Boolean);
  // 30 weeks back from late July reaches early January — one label per month,
  // never two in a row, and never the same month twice.
  assert.deepEqual(named, [...new Set(named)], 'no month is labelled twice');
  assert.ok(named.length >= 6 && named.length <= 9, `got ${named.length} labels`);
  assert.equal(labels[labels.length - 1], '', 'the last week does not open July');
});

test('the set and the iterable forms agree', () => {
  const days = ['2026-07-27', '2026-06-01'];
  assert.deepEqual(buildActivityGrid(new Set(days), TODAY), buildActivityGrid(days, TODAY));
});

test('a day outside the window is simply not drawn', () => {
  const grid = buildActivityGrid(['2019-01-01'], TODAY);
  assert.ok(grid.every((w) => w.days.every((d) => !d.trained)));
});

test('monthGrid pads to whole Monday-first weeks', () => {
  // 1 Jul 2026 is a Wednesday → two leading nulls.
  const july = monthGrid(cursorOf('2026-07-15'));
  assert.equal(july.length % 7, 0);
  assert.deepEqual(july.slice(0, 3), [null, null, '2026-07-01']);
  assert.equal(july.filter(Boolean).length, 31);
  // Feb 2026 has 28 days and starts on a Sunday → six leading nulls.
  const feb = monthGrid(cursorOf('2026-02-10'));
  assert.equal(feb.filter(Boolean).length, 28);
  assert.deepEqual(feb.slice(0, 7), [null, null, null, null, null, null, '2026-02-01']);
});

test('monthGrid handles a leap February', () => {
  assert.equal(monthGrid(cursorOf('2028-02-01')).filter(Boolean).length, 29);
});

test('monthsDescending runs newest first and is inclusive at both ends', () => {
  const months = monthsDescending('2026-03-14', '2026-07-28');
  assert.equal(months.length, 5);
  assert.deepEqual(months[0], { year: 2026, month: 6 }); // July
  assert.deepEqual(months[4], { year: 2026, month: 2 }); // March
});

test('monthsDescending crosses a year boundary and never returns nothing', () => {
  const months = monthsDescending('2025-11-30', '2026-02-01');
  assert.deepEqual(
    months.map((m) => `${m.year}-${m.month}`),
    ['2026-1', '2026-0', '2025-11', '2025-10'],
  );
  assert.equal(monthsDescending('2026-07-01', '2026-07-28').length, 1, 'one month is one month');
  // A first-day stamped after today (a clock skew, or an imported future date)
  // collapses to the current month rather than returning an empty history.
  assert.deepEqual(monthsDescending('2027-01-01', '2026-07-28'), [{ year: 2026, month: 6 }]);
});

test('the window is honoured across a year boundary', () => {
  const grid = buildActivityGrid(['2025-12-29'], '2026-01-06', 4);
  assert.equal(grid.length, 4);
  assert.equal(grid[grid.length - 1]!.days[0]!.key, '2026-01-05');
  // 29 Dec 2025 is a Monday, one week before 5 Jan.
  assert.equal(grid[grid.length - 2]!.days[0]!.trained, true);
});
