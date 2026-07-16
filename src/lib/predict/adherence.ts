import { dayKeyFor, todayKey } from '@/lib/db/dates';
import {
  getPredictionForOpen,
  setPredictionOutcome,
  type PredictionOutcome,
} from '@/lib/db/predictions';

/**
 * Adherence settlement (CLAUDE.md §7.2 Gap 3, §3): after today's session is
 * parsed, record what happened to the ghost that was on offer —
 *
 *   followed  the note ends up exactly the prescription (however they got
 *             there: Start or typing it out themselves),
 *   edited    they accepted the ghost, then changed something,
 *   ignored   they trained without touching it.
 *
 * Re-settled on every parse of the day, so the value converges on the note's
 * final state. Ghost-accept-rate and followed-rate are THE two numbers that
 * prove the predictor is a moat — and a rising `ignored` count is itself a
 * signal to back off.
 */
const normalize = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join('\n')
    .toLowerCase();

export function outcomeOf(
  rawText: string,
  ghostText: string,
  accepted: boolean,
): PredictionOutcome {
  if (normalize(rawText) === normalize(ghostText)) return 'followed';
  return accepted ? 'edited' : 'ignored';
}

/** Settle the shown prediction against today's note. No prediction on offer
 * or the workout isn't today's → nothing to settle. */
export function settlePredictionOutcome(
  userId: string,
  workoutPerformedAtIso: string,
  rawText: string,
): void {
  const today = todayKey();
  if (dayKeyFor(new Date(workoutPerformedAtIso)) !== today) return;

  const prediction = getPredictionForOpen(userId, today);
  if (!prediction) return;

  setPredictionOutcome(
    prediction.id,
    outcomeOf(rawText, prediction.ghost_text, prediction.accepted_at !== null),
  );
}
