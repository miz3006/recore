/**
 * THE PLATEAU RULE — one definition of "stuck", for every surface that says it.
 *
 * It lived inside `db/brief.ts#findStalls` until 29 August 2026, which was fine
 * while exactly one screen printed it. Next's `Signals` block moved to
 * Progression that day, and a plateau that Next calls a plateau while
 * Progression does not is the two tabs disagreeing about one lift — the thing
 * `entryNoteKey`, `moveLabel` and `whyFor` all exist to prevent elsewhere.
 * `findStalls` and `buildOverview` both read this now.
 *
 * ## The rule
 *
 * Three consecutive most-recent sessions at the SAME top weight, with reps flat
 * or falling.
 *
 * The rep clause is the part that is about the sport rather than about
 * arithmetic: a lifter who did 5·5·5 at 100 kg, then 6·6·6, then 8·8·8 has not
 * stalled — they are running the rep half of double progression exactly as
 * intended, and calling that a plateau would be the app being wrong out loud.
 * Only a lift that is standing still on BOTH levers is standing still.
 *
 * Three is the engine's own deload condition read one session early
 * (`predict/engine.ts`), which is what makes surfacing it honest: it is not a
 * new opinion about training, it is the app showing its work before it acts.
 *
 * Pure, node-testable, no I/O.
 */

/** Sessions at one weight before the app will call it a plateau. */
export const STALL_SESSIONS = 3;

/** One session's top working set — warm-ups, drops and skipped sets excluded
 * upstream, the same way every aggregate in the app counts (§1.1.5). */
export interface TopSet {
  weight: number | null;
  reps: number | null;
}

/**
 * The weight a lift is stuck at, or null.
 *
 * `newestFirst` is the lift's own sessions, most recent first. Only the newest
 * `STALL_SESSIONS` are read, so callers may pass the whole history — and
 * SHOULD, rather than a windowed slice: a lift whose third-newest session falls
 * outside some screen's eight-week view is still on the same plateau, and a
 * window is a display choice that must not change what is true about a lift.
 */
export function stalledWeight(newestFirst: readonly TopSet[]): number | null {
  if (newestFirst.length < STALL_SESSIONS) return null;

  const window = newestFirst.slice(0, STALL_SESSIONS);
  const weight = window[0]!.weight;
  if (weight == null || weight <= 0) return null;
  if (!window.every((r) => r.weight === weight)) return null;

  // Reps must be flat or falling. `reps[i - 1]` is the NEWER session, so a
  // newer session carrying more reps than an older one is progress, not a
  // stall.
  const reps = window.map((r) => r.reps);
  const improving = reps.some(
    (r, i) => i > 0 && r != null && reps[i - 1] != null && reps[i - 1]! > r,
  );
  if (improving) return null;

  return weight;
}
