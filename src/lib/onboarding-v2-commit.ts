import { KEY_LIFTS, LAST_STEP } from '@/components/onboarding-v2/flow';
import { markOnboardingCompleted, markRecapToggled, setObStepCount } from '@/lib/funnel';
import { defaultLanguage, defaultWeightUnit } from '@/lib/locale';
import { recapChoiceFor } from '@/lib/onboarding-v2-map';
import {
  getWeightUnit,
  isRecapEnabled,
  markOnboardingDone,
  setName,
  setObLanguage,
  setObSource,
  setRecapDay,
  setRecapEnabled,
  setRecapHour,
  setRecapIntent,
  setSmallestPlateKg,
  setWeightUnit,
} from '@/lib/prefs';
import {
  setAnswer,
  setKeyLifts,
  setLiftLoad,
  setObstacles,
  optionsFor,
  type AnswerId,
} from '@/lib/profile-answers';
import { isSandboxRun, v2Answers, type V2Answers } from '@/state/onboarding-v2';

/**
 * THE ONE PLACE THE v2 FLOW WRITES TO THE APP (28 August 2026).
 *
 * v2 became the primary onboarding on the owner's word today, and `profile-
 * answers.ts` has predicted this function since the day it was written: "when
 * v2 graduates from sandbox to the real flow, its DONE screen calls the setters
 * below once, which is the single commit point a flow should have."
 *
 * ## Why one function and not eighteen screens
 *
 * The flow's screens write to `state/onboarding-v2.ts` and to nothing else.
 * That is what makes Back harmless, what makes a mis-tap on screen 6
 * recoverable on screen 7, and what keeps a half-finished run from leaving the
 * app half-configured. A single commit at the end means the app changes exactly
 * once, when the person has actually finished — and it means the list of
 * everything onboarding decides is READABLE, in one screenful, here.
 *
 * ## What it deliberately does not do
 *
 * No account, no trial, no paywall, no RevenueCat. The dispatcher (`app/
 * index.tsx`) owns what happens next, exactly as it did for the v1 flow: it
 * sees `onboarding_done` and sends a person with no session to the paywall.
 *
 * ## Every write is guarded
 *
 * An unanswered screen writes NOTHING rather than a default. The funnel has to
 * be able to tell "did not say" from "said the first option", and a person who
 * re-runs onboarding and skips a question must not have a previous answer
 * silently replaced by a guess.
 */
export function commitV2Onboarding(answers: V2Answers = v2Answers()): void {
  // Belt and braces. The route does not call this on a dev run, and if it ever
  // did, §0's promise would be broken by one line in a file nobody was reading.
  if (isSandboxRun()) return;

  const name = answers.name.trim();
  if (name) setName(name);

  // The five single-choice answers of record. `profile-answers` also writes the
  // v1 mirrors (`pref_goal`, `pref_experience`, `pref_ob_tracker`) that the
  // prediction engine, the import fast path, the paywall copy and Profile
  // already read, so nothing downstream has to learn a second vocabulary.
  writeChoice('tracker', answers.tracker);
  writeChoice('goal', answers.goal);
  writeChoice('experience', answers.experience);
  writeChoice('frequency', answers.frequency);
  writeChoice('split', answers.split);

  // What gets in the way. It decides which value proposition leads on the
  // reveal and the paywall, and until today it was the one product-shaping
  // answer that lived nowhere but the run that produced it — so Profile could
  // not show it and nobody could change their mind about it.
  if (answers.obstacles.length > 0) setObstacles(answers.obstacles);

  if (answers.keyLifts.length > 0) setKeyLifts(answers.keyLifts);
  for (const [lift, kg] of Object.entries(answers.liftLoads)) {
    // Only the lifts they kept, and only loads that are real numbers: the
    // stepper leaves a value behind for a lift that was picked and then
    // dropped, and that is not an answer about their training.
    if (!answers.keyLifts.includes(lift)) continue;
    if (!KEY_LIFTS.some((l) => l.id === lift)) continue;
    if (Number.isFinite(kg) && kg > 0) setLiftLoad(lift, kg);
  }

  // The smallest plate in their gym — `lib/plates.ts` rounds every prescription
  // with it. Skipped is a real answer and leaves the pref alone.
  if (answers.smallestPlateKg != null) setSmallestPlateKg(answers.smallestPlateKg);

  // Where they found Recore. "Other" IS written — in v2 it is a row somebody
  // tapped, not the absence of an answer, and the funnel's denominator needs to
  // tell those apart.
  const source = answers.attribution?.trim();
  if (source) setObSource(source);

  writeRecap(answers);

  setObLanguage(defaultLanguage());
  // The v2 flow never asks about units — it writes and shows kilograms. The
  // locale's default is written only when nothing is stored, so a unit somebody
  // set in You before re-running the flow survives it.
  if (!getWeightUnit()) setWeightUnit(defaultWeightUnit());

  setObStepCount(LAST_STEP);
  markOnboardingDone();
  markOnboardingCompleted(); // the denominator of every step's drop-off (E7)
}

/** Write an answer only if it is still one the flow offers. A renamed option id
 * reads as unanswered, which is what `profile-answers.getAnswer` would say. */
function writeChoice(id: AnswerId, value: string | null): void {
  if (!value) return;
  if (!optionsFor(id).some((o) => o.id === value)) return;
  setAnswer(id, value);
}

/**
 * The recap answer, which is the only one that can promise something the OS has
 * to deliver.
 *
 * The intent is stored whatever they said. The feature is turned ON only when
 * iOS actually granted permission on screen 20 — an "On" that can never fire
 * would be a lie (§2 rule 5), and the screen already told them so in words. The
 * DAY and the HOUR are stored because the question asks for them; `lib/recap.ts`
 * schedules on both since today.
 */
function writeRecap(answers: V2Answers): void {
  const choice = recapChoiceFor(answers.recap);
  if (!choice) return;

  setRecapIntent(choice.intent);
  if (choice.intent !== 'yes') return;

  setRecapDay(choice.day);
  setRecapHour(choice.hour);
  if (answers.notificationsGranted === true && !isRecapEnabled()) {
    setRecapEnabled(true);
    markRecapToggled(true); // §13: recap enabled
  }
}
