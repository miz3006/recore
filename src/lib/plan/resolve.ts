/**
 * Pure "what do I train today" resolver for the weekly split (pre-plan) —
 * ZERO I/O, runs under `node --test`. Same discipline as predict/split.ts: the
 * decision lives in a pure, tested function; the DB layer (db/plan.ts) only
 * feeds it rows and stamps the result.
 *
 * ONE ordered cycle of day-templates, read two ways:
 *
 *  - ROTATION (the source of truth): "do the next one when you train." The
 *    cursor is the position of the day you LAST finished; today is the next
 *    position in the cycle, wrapping. It only advances on Finish, so a missed
 *    calendar day SLIDES the cycle instead of skipping a workout.
 *  - WEEKDAY (an optional overlay): each day pins to weekdays via weekday_mask
 *    (bit i, 0 = Mon … 6 = Sun). Today is whichever day owns today's weekday,
 *    or null (a rest day). The calendar decides; the cursor is ignored.
 *
 * The owner picked rotation-as-truth + optional weekday overlay (2026-07-22).
 */
export type ScheduleMode = 'rotation' | 'weekday';

export interface PlanDayLite {
  id: string;
  position: number;
  /** Weekdays this day trains: bit i set = weekday i (0 = Mon … 6 = Sun).
   * null in rotation-only days. */
  weekdayMask: number | null;
}

/** Monday-first weekday index (0 = Mon … 6 = Sun) for a JS Date — matches the
 * app's Monday-first calendar. JS getDay() is Sunday-first, so rotate by 6. */
export function weekdayMonFirst(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** Does a weekday_mask include weekday i (0 = Mon … 6 = Sun)? */
export function maskHasWeekday(mask: number | null | undefined, weekday: number): boolean {
  if (mask == null) return false;
  return (mask & (1 << weekday)) !== 0;
}

/** Toggle weekday i (0 = Mon … 6 = Sun) in a mask — the weekday-grid tap. */
export function toggleWeekday(mask: number, weekday: number): number {
  return mask ^ (1 << weekday);
}

/**
 * The day-template the athlete is due for today, or null (no split, or a rest
 * day in weekday mode). `days` need not be pre-sorted. `cursorPosition` is the
 * position last finished (rotation only); null = start of the cycle.
 * `todayWeekday` is Monday-first (see weekdayMonFirst).
 */
export function resolveToday(
  days: PlanDayLite[],
  mode: ScheduleMode,
  todayWeekday: number,
  cursorPosition: number | null,
): PlanDayLite | null {
  if (days.length === 0) return null;
  const sorted = [...days].sort((a, b) => a.position - b.position);

  if (mode === 'weekday') {
    return sorted.find((d) => maskHasWeekday(d.weekdayMask, todayWeekday)) ?? null;
  }

  // Rotation: the first day STRICTLY after the cursor, wrapping to the start.
  // "Strictly greater" (not index-based) survives a deleted cursor day and any
  // gaps in position numbers.
  if (cursorPosition == null) return sorted[0]!;
  return sorted.find((d) => d.position > cursorPosition) ?? sorted[0]!;
}
