// Relative + .ts extension: this file is BOTH bundled by Metro AND run under
// `node --test`, the same pattern as `onboarding.ts` and `streak.ts`. Every
// import here is type-only for the same reason — `prefs.ts` reaches SQLite and
// a pure mapping table must not.
import type { ObTracker, RecapDay, RecapIntent } from './prefs.ts';

/**
 * v2's ANSWER IDS → THE PREFERENCES THE APP ALREADY READS (28 August 2026).
 *
 * The v2 flow is the primary onboarding from today (owner's ruling; see
 * `docs/onboarding-v2-spec.md` §0), which means its answers stop being sandbox
 * state and start being the answers of record. Two of them do not use the
 * vocabulary the rest of the app has always used, and the translation is
 * exactly the kind of thing that goes wrong silently:
 *
 *  · the tracker answer decides whether the §2.1 CSV import fast path is
 *    offered, and
 *  · the recap answer decides when — and now whether — a notification can
 *    actually arrive.
 *
 * Both live here, pure and tested, rather than inside the commit function where
 * nothing could reach them. `profile-answers.ts` owns the other direction (goal
 * and experience → their v1 mirrors) because it already did.
 */

/**
 * Where they log today → `ObTracker`.
 *
 * `app` IS ITS OWN VALUE and not a coin flip between Strong and Hevy. v1 asked
 * about the two products separately; v2 asks one question ("Hevy or Strong"),
 * so mapping it onto either one would put a name on screen that the person
 * never gave. `prefs.ts` accepts it, `wantsImportFastPath` offers import for
 * it, and `import-start.tsx` says "Hevy or Strong" when that is all it knows.
 *
 * Notes, a spreadsheet and a paper notebook collapse to `notes` — none of them
 * hands the importer a file it can read, which is the only distinction the
 * pref exists to make. `memory` ("I don't log anywhere") is `none`.
 */
export function trackerToPref(answer: string | null): ObTracker | null {
  switch (answer) {
    case 'app':
      return 'app';
    case 'notes':
    case 'excel':
    case 'paper':
      return 'notes';
    case 'memory':
      return 'none';
    default:
      return null;
  }
}

/**
 * The hours the two recap answers name. Written here rather than read from
 * `prefs.RECAP_DEFAULT_HOUR` because this module may not import a value that
 * touches the database — the evening hour is deliberately the same 18, and
 * `recap-schedule.test.ts` is where a future divergence would be argued.
 */
export const RECAP_EVENING_HOUR = 18;
export const RECAP_MORNING_HOUR = 8;

export interface RecapChoice {
  intent: RecapIntent;
  /** Only meaningful when the intent is `yes`. */
  day: RecapDay;
  hour: number;
}

/**
 * "Sunday evening" / "Monday morning" / "No thanks" → what the recap feature
 * has to be set to.
 *
 * THE DAY IS PART OF THE ANSWER, and until this existed it could not be
 * honoured: `lib/recap.ts` scheduled on Sunday for everybody. A flow that asks
 * "when should it land?" and then lands it on the other day is the sort of
 * small lie CLAUDE.md §2 rule 5 is about, so the pref and the scheduler learned
 * the second day rather than the screen losing the option.
 *
 * `null` means the question was never answered — which writes nothing at all,
 * so an unanswered screen leaves whatever the person already had.
 */
export function recapChoiceFor(answer: string | null): RecapChoice | null {
  switch (answer) {
    case 'sunday':
      return { intent: 'yes', day: 'sun', hour: RECAP_EVENING_HOUR };
    case 'monday':
      return { intent: 'yes', day: 'mon', hour: RECAP_MORNING_HOUR };
    case 'never':
      return { intent: 'no', day: 'sun', hour: RECAP_EVENING_HOUR };
    default:
      return null;
  }
}

/**
 * THE SAME QUESTION, READ BACK OFF THE PREFS.
 *
 * `recapChoiceFor` is how the answer becomes settings; this is how the settings
 * become the answer again, so that replaying the flow from Profile opens screen
 * 18 on the choice that is actually in force rather than on the one the last run
 * happened to leave in memory. Round-tripped in `onboarding-v2-map.test.ts`:
 * every option the screen offers has to survive the trip out and back.
 *
 * `null` means nothing was ever answered, which leaves the screen unanswered —
 * the one honest reading of "no intent stored".
 */
export function recapAnswerFor(intent: RecapIntent | null, day: RecapDay): string | null {
  if (intent === 'no') return 'never';
  if (intent !== 'yes') return null;
  return day === 'mon' ? 'monday' : 'sunday';
}
