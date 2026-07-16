/**
 * Day handling. A workout belongs to a LOCAL calendar day (gyms don't train in
 * UTC): `performed_at` is stored as the UTC instant of local noon on that day,
 * and every day-scoped query works on [local midnight, next local midnight).
 */
export type DayKey = string; // YYYY-MM-DD (local)

export function dayKeyFor(date: Date): DayKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayKey(): DayKey {
  return dayKeyFor(new Date());
}

export function shiftDayKey(key: DayKey, days: number): DayKey {
  const [y, m, d] = key.split('-').map(Number);
  return dayKeyFor(new Date(y!, m! - 1, d! + days));
}

/** UTC ISO range covering the local day — for lexicographic ISO comparison. */
export function dayRangeIso(key: DayKey): [string, string] {
  const [y, m, d] = key.split('-').map(Number);
  const start = new Date(y!, m! - 1, d!, 0, 0, 0, 0);
  const end = new Date(y!, m! - 1, d! + 1, 0, 0, 0, 0);
  return [start.toISOString(), end.toISOString()];
}

/** The stored performed_at instant for a day: local noon, expressed in UTC. */
export function performedAtIso(key: DayKey): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 12, 0, 0, 0).toISOString();
}
