// Zero imports on purpose (like billing/trial.ts and predict/engine.ts): this
// file runs under plain `node --test`.

/**
 * WHEN Recore may ask for an App Store review — PURE, zero I/O, unit-tested.
 *
 * The ask itself is the system sheet and nothing else. Apple's review
 * guidelines disallow a custom rating prompt, so there is no Recore UI here at
 * all: the app decides the moment, `SKStoreReviewController` asks the question.
 * That happens to be exactly the voice §15 wants anyway — the app does not
 * congratulate anyone and does not talk about itself.
 *
 * THE ASK IS A SCARCE RESOURCE. iOS shows the sheet at most three times per
 * 365 days per user and silently no-ops after that, with no callback to tell
 * you it happened. A prompt fired at a mediocre moment is not a small waste; it
 * spends one of three chances for the year, and the person most likely to be
 * asked at a bad moment is the one whose parse just came back wrong. So the
 * gate below is deliberately hard to pass, and every condition is a reason to
 * stay silent rather than a reason to ask.
 *
 * The moment is FINISH SESSION (§6): the user wrote their training in their own
 * words, the app read it, and the receipt just settled under the note. That is
 * the one point in the product where the machine has visibly done its job and
 * the user is not mid-task.
 */

/** Three sessions on record. Below that there is no opinion to give. */
export const MIN_SESSIONS = 3;
/** A streak that already survived one rest day (§16.2 counts training days). */
export const MIN_STREAK = 3;
/** Four months between asks. Well inside Apple's own 365-day / 3-ask ceiling. */
export const RE_ASK_DAYS = 120;
/** Never spend more than the platform would honour in a year anyway. */
export const MAX_ASKS = 3;

const DAY_MS = 86_400_000;

export interface ReviewMoment {
  /** Distinct training days on record, including the one just finished. */
  sessionsLogged: number;
  /** Consecutive training days (`src/lib/streak.ts`). */
  streak: number;
  /** A PR landed in the session that just finished. */
  prToday: boolean;
  /** The predictor has a published record and it is mostly right (§8.3). */
  predictorProven: boolean;
  /** The parser needed repairing on THIS session's note (§7.5). */
  correctedThisSession: boolean;
  /** Another sheet is already owed on this open — trial reminder or welcome. */
  otherSheetDue: boolean;
}

export interface ReviewHistory {
  /** How many times the sheet has been requested on this device. */
  askCount: number;
  lastAskedAtMs: number | null;
}

export type ReviewDecision =
  /** Ask. */
  | 'ask'
  /** The three asks are spent. */
  | 'spent'
  /** Asked recently. */
  | 'cooling-down'
  /** A trial sheet is owed on this open — never stack two modals. */
  | 'busy'
  /** The parser was corrected on this very session. The worst moment there is. */
  | 'just-repaired'
  /** Not enough training on record to have an opinion about the app. */
  | 'too-early'
  /** Nothing has visibly gone right yet. A finished session is not, by itself,
   *  evidence that Recore did anything worth rating. */
  | 'nothing-earned';

/**
 * The whole rule, in order of how permanent the objection is.
 *
 * The last clause is the one that matters: finishing a session proves the user
 * trained, not that the app earned anything. What earns the ask is the app
 * being visibly right — a PR it spotted, a prescription it got correct, or a
 * streak it has been carrying — and any ONE of those is enough.
 */
export function reviewDecision(
  moment: ReviewMoment,
  history: ReviewHistory,
  nowMs: number,
): ReviewDecision {
  if (history.askCount >= MAX_ASKS) return 'spent';

  const last = history.lastAskedAtMs;
  if (last != null && Number.isFinite(last) && nowMs - last < RE_ASK_DAYS * DAY_MS) {
    // A clock skewed backwards reads as "asked recently" rather than as a fresh
    // window — the conservative direction, like `trialClock`.
    return 'cooling-down';
  }

  if (moment.otherSheetDue) return 'busy';
  if (moment.correctedThisSession) return 'just-repaired';
  if (moment.sessionsLogged < MIN_SESSIONS) return 'too-early';

  const earned = moment.prToday || moment.predictorProven || moment.streak >= MIN_STREAK;
  return earned ? 'ask' : 'nothing-earned';
}

export function shouldAskForReview(
  moment: ReviewMoment,
  history: ReviewHistory,
  nowMs: number,
): boolean {
  return reviewDecision(moment, history, nowMs) === 'ask';
}
