import { firstSessionTargets, kg } from '../onboarding-v2/projection.ts';
import type { V2Answers } from '../../state/onboarding-v2.ts';

/**
 * WHAT THE PAYWALL SAYS, AND WHERE EVERY WORD OF IT COMES FROM.
 *
 * `docs/onboarding-v2-spec.md` §2, the line after screen 20: "paywall, leading
 * with the value prop from screen 3 and repeating the number from screen 17".
 * The owner's brief of 28 August 2026 widens that to everything the flow
 * already knows — the name, the goal and the frequency — so the screen sells
 * what the person just described rather than a product in general.
 *
 * Five inputs, and nothing else:
 *
 *   · **Screen 3 — "What gets in the way?"** picks the headline. The person
 *     named their own obstacle out of five; the paywall names the same one
 *     back. `flow.ts` already says this is what screen 3 is for ("Decides
 *     which value prop leads on the reveal and the paywall"), so this file is
 *     that sentence executed rather than a second opinion about it. There are
 *     five whole headlines, not one headline with a hole in it: a sentence
 *     built around "tapping between sets" cannot be the same sentence with
 *     "what weight to use next" dropped into it and still read like English.
 *   · **Screen 7 — the name** addresses the supporting line. Nothing else.
 *   · **Screens 9 and 11 — goal and frequency** are that line's content.
 *   · **The first session's prescribed load** supplies the number. It is
 *     `what you typed + your experience increment`, computed by
 *     `projection.ts`, printed on the reveal, and printed here again
 *     unchanged. The paywall does no arithmetic of its own.
 *
 * ## Which screen "17" is
 *
 * The spec's numbering moved under that sentence and the sentence did not move
 * with it. It was written when the flow was eighteen screens and 17 was the
 * reveal; two insight screens were inserted on 28 August 2026 and 17 is now the
 * commitment. Three things say the reveal is what was meant:
 *
 *   1. `projection.ts` still labels its targets "SCREEN 17'S TARGETS", and
 *      those are the reveal's.
 *   2. The spec's own note two lines below — "unless bodyweight is used for
 *      relative strength on screen 17" — only parses if 17 is the screen with
 *      loads on it.
 *   3. The commitment's number is four WEEKS, which is a pledge the person
 *      made, not a thing they asked for. "Repeat the number" on a paywall
 *      means repeat the payoff.
 *
 * The owner's brief uses the same eighteen-screen numbering throughout — name
 * at 7, goal at 9, frequency at 11, key lifts at 13, the number at 17 — and
 * every one of those lands on the screen this file reads. Flagged in
 * `FINDINGS.md`. If the owner meant the commitment, `leadTarget` below is the
 * one function that changes.
 *
 * ## THE FALLBACK IS THE REAL SCREEN
 *
 * Every function here is written so that `paywallCopy(EMPTY_V2)` is a finished
 * paywall — a headline, a supporting line and a "today" row that all read
 * correctly with no name, no obstacle, no goal, no frequency and no lifts.
 * That is not a degraded mode: it is what a person reaching this screen from
 * Settings, or from a v1 onboarding run, or on the day something upstream
 * breaks, actually sees. The personalised strings are the special case.
 *
 * ## What it may never do
 *
 * No claim about other people, no percentage, no rating, no count of users, no
 * health claim, no urgency. CLAUDE.md §3. Every line here is either a fact
 * about how Recore works or the person's own answer handed back to them, which
 * is the same contract `insights.ts` runs under two screens earlier.
 */

export interface PaywallCopy {
  /** The bold headline. Names the obstacle they picked on screen 3. */
  headline: string;
  /**
   * The quiet line under the headline: who they are and what the app has been
   * set up to do (screens 7, 9 and 11). Always a complete sentence — with no
   * answers at all it states a fact about the product instead.
   */
  support: string;
  /**
   * The body of the timeline's "Today" row — where the concrete number lands.
   * The number goes here rather than in a subline of its own because the
   * reference layout has no subline, and "what unlocks today" is the row that
   * is already asking the question this answers.
   */
  today: string;
  /**
   * The exact figure inside `today` — "82.5 kg × 3" — so the renderer can draw
   * it heavier than the sentence around it. Null when there is no number.
   * A SUBSTRING of `today`, verbatim; the renderer splits on it rather than
   * the copy carrying markup, which is `insights.ts`'s `accent` pattern.
   */
  todayStrong: string | null;
  /** True when `today` carries a real prescribed load rather than the fallback
   * phrasing. Read by the screen's analytics; nothing renders it. */
  hasNumber: boolean;
  /** True when the supporting line addresses them by name. Analytics only. */
  hasName: boolean;
}

/**
 * THE FIVE OBSTACLES, ANSWERED — screen 3's option ids, verbatim from
 * `flow.ts`.
 *
 * Every headline is the same promise in the person's own terms: the thing that
 * gets in the way stops getting in the way. They are deliberately capabilities
 * rather than adjectives — "a session is one line" is checkable, "the best
 * training log" is not.
 *
 * `screen 4` already says a version of each of these back to them
 * (`insights.ts`, `obstacleInsight`). That is on purpose and it is not a
 * duplicate: the insight screen explains the mechanism, and this names what
 * they would be paying to keep. Same subject, different sentence — a paywall
 * that re-runs the explainer reads as filler.
 *
 * ## THE LINE BREAKS ARE THE OPTICAL CENTRING
 *
 * Every headline is two authored lines, and the two are within
 * `MAX_LINE_DELTA` characters of each other (asserted in `copy.test.ts`). That
 * is the whole of optical centring available on this platform and it is also
 * the part that matters: React Native has no `text-wrap: balance`, so a
 * centred headline left to wrap itself produces a long line over a short one,
 * and the BLOCK then reads off-centre however perfectly each line is centred
 * inside it. Balancing the lines centres the shape; `textAlign` only centres
 * the boxes.
 *
 * Hanging the final full stop — the other half of optical centring in print —
 * is deliberately not done: it would need a per-line offset that only applies
 * to the punctuated line, and at 34 pt the error it corrects is under two
 * points. Balance is worth ten of it.
 */
const HEADLINE: Record<string, string> = {
  typing: 'Keep writing a whole\nsession in one line.',
  supersets: 'Keep every session\nthe shape you wrote it.',
  forget: 'Keep last time\non the screen.',
  whatnext: 'Keep the next load\nalready worked out.',
  quit: 'Keep the record going\nlong enough to matter.',
};

/**
 * Nobody picked an obstacle — screen 3 allows zero. It claims nothing about
 * what they wanted, because we were not told.
 */
const HEADLINE_FALLBACK = 'Keep the record\nyou just built.';

/**
 * SCREEN 9's ANSWER, AS THE THING RECORE IS SET UP FOR.
 *
 * The screen's own subline is "This picks the progression model", so naming the
 * goal back is a statement about the app's configuration, not a promise about
 * the person's body. `firstSessionTargets` proves it: the goal is what decides
 * the set count on every load the reveal printed.
 */
const GOAL: Record<string, string> = {
  strength: 'strength',
  hypertrophy: 'muscle',
  both: 'strength and muscle',
  consistency: 'consistency',
  hybrid: 'hybrid training',
};

/**
 * SCREEN 11's ANSWER, spelled out. The screen says "That's how many Recore
 * will plan for", and `flow.ts` records that it "feeds Next-tab clustering and
 * weekly volume" — so this is a fact about what was configured, and the same
 * count `yearInsight` already multiplied by 52 six screens earlier.
 */
const FREQUENCY: Record<string, string> = {
  '2': 'two sessions a week',
  '3': 'three sessions a week',
  '4': 'four sessions a week',
  '5': 'five sessions a week',
  '6': 'six or more sessions a week',
};

/**
 * How long a name may be before the supporting line stops using it.
 *
 * The line has to hold one line on a 393 pt phone at default type (the owner's
 * brief: "the screen must not scroll"), and a name is the only part of it this
 * file cannot bound. Past this it is dropped rather than wrapped — the
 * un-named version of the sentence is complete on its own, which is exactly
 * why it was written first.
 */
const MAX_NAME_CHARS = 14;

/**
 * The name as a paywall may address someone: trimmed, first word only, and
 * only when it is short enough to sit in the line.
 *
 * FIRST WORD, unlike `GreetingScreen`, which prints whatever was typed on a
 * screen that is nothing but the name. Here it shares a sentence with two other
 * answers, and screen 7 asks for a first name in its subline anyway.
 */
function firstName(raw: string): string | null {
  const [word] = raw.trim().split(/\s+/);
  if (!word) return null;
  if (word.length > MAX_NAME_CHARS) return null;
  return word;
}

/**
 * THE SUPPORTING LINE — four shapes, and the last of them needs nothing.
 *
 * It is built outward from the version with no answers in it, so a missing
 * goal, a missing frequency or a missing name each remove a clause rather than
 * leaving a gap where one used to be. There is no branch in here that produces
 * a sentence about a person we know nothing about.
 */
function supportLine(answers: V2Answers, name: string | null): string {
  const goal = GOAL[answers.goal ?? ''] ?? null;
  const frequency = FREQUENCY[answers.frequency ?? ''] ?? null;

  const detail =
    goal && frequency ? `${goal}, ${frequency}` : (goal ?? frequency ?? null);

  if (detail) {
    return name ? `${name}, set up for ${detail}.` : `Set up for ${detail}.`;
  }
  if (name) return `${name}, this is the record you just started.`;
  // Nothing was answered — a fact about the product, addressed to nobody.
  return 'Everything Recore does, from your first line.';
}

/**
 * THE FIRST SESSION'S FIRST LIFT, as the reveal prints it.
 *
 * `firstSessionTargets` is the same call the reveal makes, on the same answers,
 * so the two screens cannot disagree about a load. The lift named is the first
 * one they picked on screen 13, which is the one the reveal leads with too, and
 * the SET COUNT travels with it — the reveal shows "82.5 kg × 3" and the owner's
 * brief asks for that exact figure, not the load on its own.
 *
 * Returns null whenever the flow has no load to quote — no key lifts, or a
 * lift with no weight against it. There is no default number here and there
 * must not be: a load nobody typed is a fabricated personalisation.
 *
 * THE GUARD IS ON `currentKg`, NOT ON THE TARGET, and a test caught the
 * difference. `firstSessionTargets` treats a missing load as 0 and still
 * prescribes `0 + your increment`, so a lift picked on screen 13 and never
 * given a weight comes back as a perfectly finite 2.5 kg. On the reveal that
 * is visible beside a stepper and obviously editable; on a paywall it is a
 * sentence that says "your squat at 2.5 kg" to someone who typed nothing —
 * an invented number in the one place §3 is least forgiving about them.
 */
function leadTarget(answers: V2Answers): { lift: string; figure: string } | null {
  const [first] = firstSessionTargets(answers);
  if (!first) return null;
  if (!Number.isFinite(first.currentKg) || first.currentKg <= 0) return null;
  if (!Number.isFinite(first.targetKg) || first.targetKg <= 0) return null;
  if (!Number.isFinite(first.sets) || first.sets <= 0) return null;
  return {
    lift: first.lift.toLowerCase(),
    figure: `${kg(first.targetKg)} kg × ${first.sets}`,
  };
}

export function paywallCopy(answers: V2Answers): PaywallCopy {
  const lead = answers.obstacles[0];
  const headline = (lead && HEADLINE[lead]) || HEADLINE_FALLBACK;

  const name = firstName(answers.name);
  const support = supportLine(answers, name);

  const target = leadTarget(answers);
  if (!target) {
    return {
      headline,
      support,
      today: 'Your first session, and every one after.',
      todayStrong: null,
      hasNumber: false,
      hasName: name !== null,
    };
  }

  return {
    headline,
    support,
    // The number, repeated exactly as the reveal stated it. Dry beside a
    // value, per recore-design §Tone — no adjective, no exclamation, no claim
    // about what it will do for them. Short on purpose: this row has to hold
    // ONE line at default type or the screen starts scrolling.
    today: `Your ${target.lift} at ${target.figure}.`,
    todayStrong: target.figure,
    hasNumber: true,
    hasName: name !== null,
  };
}

/** The balance budget the headlines are held to. Exported for the test, which
 * is the only thing that reads it. */
export const MAX_LINE_DELTA = 6;

/** Every headline this file can produce, for the test that measures them. */
export const ALL_HEADLINES: readonly string[] = [
  ...Object.values(HEADLINE),
  HEADLINE_FALLBACK,
];
