import { recapAnswerFor } from '@/lib/onboarding-v2-map';
import { getName, getRecapDay, getRecapIntent, getSmallestPlateKg } from '@/lib/prefs';
import {
  getAnswer,
  getKeyLifts,
  getLiftLoads,
  getObstacles,
  type AnswerId,
} from '@/lib/profile-answers';
import { isSandboxRun, useV2 } from '@/state/onboarding-v2';

/**
 * THE RECORD, BACK INTO THE FLOW (29 August 2026).
 *
 * `onboarding-v2-commit.ts` runs one way: the flow finishes and its answers
 * become the answers of record. This is the return leg, and without it the two
 * stores drift the moment somebody edits anything in Profile.
 *
 * ## The two things that were actually broken
 *
 * **"Run setup again" replayed the wrong answers.** The row promises "your
 * answers already ticked", and what it ticked was whatever the v2 store had
 * persisted at the end of the last run — not what Profile says today. Change
 * your goal in Profile in September, replay the flow in October, and screen 9
 * opens on the answer you replaced. Worse, finishing that replay committed the
 * stale answer straight back over the edit. A settings screen whose edits can be
 * silently undone by a button on the same screen is not a settings screen.
 *
 * **The paywall quoted the old answers.** `paywall-v2/plan.tsx` builds its copy
 * from `useV2` — the store, not the record — and that paywall is reachable from
 * Profile's own subscription row. So the page could open naming a goal the
 * person had already changed two rows above.
 *
 * One projection fixes both, because both read the same store. Every Profile
 * edit calls this, and so does the replay, so the store is never further behind
 * the record than one write.
 *
 * ## Only what the record actually knows
 *
 * An answer the record has never held writes NOTHING, and the store keeps what
 * it had. That matters for installs that onboarded before the record learned
 * about the tracker and the obstacles: those two answers exist only in the
 * store for them, and overwriting them with "unanswered" would destroy the one
 * copy in existence. It is the same rule the commit keeps in the other
 * direction — a skipped question never replaces a real answer with a guess.
 *
 * ## Never during a dev run
 *
 * §0's sandbox promise cuts both ways. A dev run must not read the person's real
 * answers into the screens it is showing, or the "clean run" the You tab's
 * development rows offer would open half-filled.
 */
export function seedV2FromRecord(): void {
  if (isSandboxRun()) return;

  const { set } = useV2.getState();

  const name = getName();
  if (name) set('name', name);

  const SINGLE: readonly AnswerId[] = ['tracker', 'goal', 'experience', 'frequency', 'split'];
  for (const id of SINGLE) {
    const value = getAnswer(id);
    if (value) set(id, value);
  }

  const obstacles = getObstacles();
  if (obstacles.length > 0) set('obstacles', obstacles);

  const lifts = getKeyLifts();
  if (lifts.length > 0) {
    set('keyLifts', lifts);
    // Merged, not replaced: a lift the record carries no load for keeps whatever
    // the store had, and the stepper still opens on a number rather than on the
    // fallback seed.
    set('liftLoads', { ...useV2.getState().answers.liftLoads, ...getLiftLoads() });
  }

  const plate = getSmallestPlateKg();
  if (plate != null) set('smallestPlateKg', plate);

  const recap = recapAnswerFor(getRecapIntent(), getRecapDay());
  if (recap) set('recap', recap);
}
