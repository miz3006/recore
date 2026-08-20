// Relative + .ts extension: this file is BOTH bundled by Metro AND run under
// `node --test` — the same pattern as onboarding.ts and demo-parse.ts.
import { COMMIT_WEEKS } from './onboarding.ts';

/**
 * EVERY CONDITIONAL LINE OF THE FUNNEL, in one pure file.
 *
 * §5 makes a demand the flow was only half keeping: "every question must affect
 * a later screen, a default, a summary, or a personalised interpretation. Remove
 * a question that does none of these." Two questions were doing none — the
 * current tracker and the obstacles — and they are the two most personal
 * answers in the flow. They are read back here, on the screens that come next.
 *
 * ## Why a module and not a ternary in the renderer
 *
 * Conditional copy is the part of a funnel that silently rots: a variant nobody
 * can reach, a fallback that says something the answer contradicts, an
 * exclamation mark that slips past review. Here every variant is a function of
 * an answer, with no JSX and no React around it, so `onboarding-copy.test.ts`
 * can assert both the branch and the TONE (§12: sentence case, no exclamation
 * marks, no hype) over the whole surface at once.
 *
 * ## The rules the tests hold this file to
 *
 *  · Nothing here states a fact about the person's training. It reads their own
 *    answer back and says what the app will do about it.
 *  · An unanswered question gets the neutral line, never a guess.
 *  · No exclamation marks, no "amazing", no promise of a result.
 */

/** Option ids of the tracker screen (`config.ts`), read back as written. */
const TRACKER_LABELS: Record<string, string> = {
  strong: 'Strong',
  hevy: 'Hevy',
};

/** The neutral opening — what the screen says when the tracker is unanswered. */
export const WHY_WRITTEN_NEUTRAL =
  "You can't add weight to a number you can't remember. A written session turns last week's load into a fact instead of a guess.";

/**
 * The rest of the "what gets written gets stronger" essay. Unchanged by any
 * answer: the second and third paragraphs are the argument itself, and only the
 * first one is about the person reading it.
 */
export const WHY_WRITTEN_REST: readonly string[] = [
  "Most people don't quit logging because of discipline. They quit because of the tapping — exercise, sets, reps, weight, one field at a time.",
  'Recore takes a sentence instead.',
];

/**
 * The essay's first paragraph, addressed to what the person actually uses
 * today. It never claims their tracker is bad — it names the thing about it
 * they already told us stops them.
 */
export function whyWrittenOpening(tracker: string | null | undefined): string {
  const app = tracker ? TRACKER_LABELS[tracker] : undefined;
  if (app) {
    return `You track in ${app} today. The grid is why logging feels like work — exercise, sets, reps, weight, one field at a time.`;
  }
  switch (tracker) {
    case 'notes':
      return 'You already write your training. Recore just reads what you write — and turns it into a record that answers back.';
    case 'sheet':
      return 'A spreadsheet remembers everything and tells you nothing mid-set. Recore reads a sentence instead.';
    case 'none':
      return 'Starting clean is the easy case. One written line per session is the whole habit.';
    default:
      return WHY_WRITTEN_NEUTRAL;
  }
}

/** The whole essay, first paragraph included. */
export function whyWrittenBody(tracker: string | null | undefined): readonly string[] {
  return [whyWrittenOpening(tracker), ...WHY_WRITTEN_REST];
}

/** The recap screen's line when no obstacle was named. */
export const RECAP_NEUTRAL = 'One short read on what moved and what stalled. Nothing daily.';

/**
 * The Sunday recap, argued from the friction the person named three screens in.
 *
 * "I forget to log it" wins over "I never know what to beat" when both are
 * ticked, because forgetting is the one the message itself answers — the other
 * is answered by what is IN it.
 */
export function recapSubtext(obstacles: readonly string[]): string {
  if (obstacles.includes('forget')) {
    return 'You said you forget to log. One Sunday message keeps the record honest — nothing daily.';
  }
  if (obstacles.includes('target')) {
    return 'One short read on the numbers worth beating this week. Nothing daily.';
  }
  return RECAP_NEUTRAL;
}

/**
 * What the projection is a projection OF, in the goal's own vocabulary — one
 * word class on the end of the headline, never a rewrite of it. An unstated
 * goal adds nothing rather than picking a default.
 */
export function projectionSubject(goal: string | null | undefined): string | null {
  switch (goal) {
    case 'strength':
    case 'both':
      return 'load';
    case 'muscle':
      return 'volume';
    case 'sport':
    case 'fitness':
      return 'training';
    default:
      return null;
  }
}

/** "Marko — your next 12 weeks of load". Both halves are optional answers. */
export function projectionHeadline(
  name: string | null | undefined,
  goal: string | null | undefined,
): string {
  const subject = projectionSubject(goal);
  const horizon = `${COMMIT_WEEKS} weeks${subject ? ` of ${subject}` : ''}`;
  const called = name?.trim();
  return called ? `${called} — your next ${horizon}` : `Your next ${horizon}`;
}
