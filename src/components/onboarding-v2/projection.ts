import { ASSUMED_BAR_KG, incrementKg, sessionsPerStep } from './flow.ts';
import type { V2Answers } from '@/state/onboarding-v2';

/**
 * THE ARITHMETIC BEHIND SCREENS 14 AND 17 — all of it, in one place, in code.
 *
 * CLAUDE.md §2 rule 3: "Loads, sets, volume, trial dates, prices, charts, and
 * progression calculations come from code or stored records." Nothing in this
 * file is a model output, a guess, or a claim about what will happen: it is one
 * multiplication applied to a number the person typed, and every screen that
 * shows a result of it also prints the rule out loud ("+2,5 kg glede na to, kar
 * si vpisal").
 *
 * §2, screen 14: the chart "must use his numbers from screen 13, not a generic
 * curve. Cal AI's four explainers are all generic; that is the opening."
 */

export const PROJECTION_WEEKS = 12;

export interface Projection {
  /** The lift the projection is drawn for — the first one they picked. */
  lift: string;
  /** What they typed on screen 13. */
  startKg: number;
  /** The step size their experience answer selected. */
  incrementKg: number;
  /** How many sessions between steps. */
  everyNth: number;
  /** Load per week, week 0 through `PROJECTION_WEEKS`. */
  series: number[];
  /** Where that lands. */
  endKg: number;
}

/**
 * A key lift is trained about once a week in every split this flow offers, so
 * the series is indexed in weeks and a step lands every `everyNth` of them.
 * Stating the assumption is the point — the screen says "every n sessions", so
 * the chart and the sentence describe the same thing.
 */
export function projectionFor(answers: V2Answers): Projection | null {
  const lift = answers.keyLifts[0];
  if (!lift) return null;
  const startKg = answers.liftLoads[lift];
  if (startKg == null || startKg <= 0) return null;

  const step = incrementKg(answers.experience);
  const everyNth = sessionsPerStep(answers.experience);
  const series: number[] = [];
  for (let week = 0; week <= PROJECTION_WEEKS; week += 1) {
    series.push(startKg + step * Math.floor(week / everyNth));
  }
  return {
    lift,
    startKg,
    incrementKg: step,
    everyNth,
    series,
    endKg: series[series.length - 1],
  };
}

export interface SessionTarget {
  lift: string;
  /** What they typed. */
  currentKg: number;
  /** What the first session asks for. */
  targetKg: number;
  addedKg: number;
  sets: number;
  /**
   * True when the target had to move to land on plates they actually own.
   * Screen 17 says so when it happens rather than printing a rounded number as
   * though it were the arithmetic.
   */
  rounded: boolean;
  /** False when the smallest plate is unknown, so nothing was rounded and the
   * screen should say the number may need checking. */
  platesKnown: boolean;
}

/**
 * The nearest load AT OR BELOW a target that can actually be built on a bar,
 * given the smallest plate they own. Plates go on both sides, so the loadable
 * step is twice the smallest plate; anything between two steps is a number you
 * cannot make.
 */
export function loadableKg(targetKg: number, smallestPlateKg: number | null): number {
  if (smallestPlateKg == null || smallestPlateKg <= 0) return targetKg;
  const step = smallestPlateKg * 2;
  const above = targetKg - ASSUMED_BAR_KG;
  if (above <= 0) return targetKg;
  return ASSUMED_BAR_KG + Math.floor(above / step + 1e-9) * step;
}

/**
 * THE NEXT LOADABLE WEIGHT STRICTLY ABOVE A CURRENT ONE.
 *
 * The first draft of this rounded the target down and stopped, which a test
 * immediately caught doing something absurd: a lifter at 80 kg whose smallest
 * plate is 2.5 was prescribed **80 kg** — the ideal 82.5 is unloadable, and
 * rounding down landed back where they started. A progressive-overload app
 * prescribing no progression is worse than one that overshoots.
 *
 * So when the ideal step is not loadable, the prescription goes to the next
 * weight that IS. With 2.5s that means a 5 kg jump instead of 2.5 — bigger than
 * the model wanted, and the truth about that gym. Screen 17 prints the real
 * delta (`addedKg` is recomputed from the final target) so the number under the
 * load never disagrees with it.
 */
export function nextLoadableAbove(currentKg: number, smallestPlateKg: number): number {
  const step = smallestPlateKg * 2;
  return loadableKg(currentKg, smallestPlateKg) + step;
}

/**
 * SCREEN 17'S TARGETS — one per key lift, and every one of them is
 * `what you typed + the increment your experience answer chose`.
 *
 * Set count follows the goal, which is the only thing the goal answer is used
 * for in this flow: strength work is fewer, heavier sets; hypertrophy is more.
 */
export function firstSessionTargets(answers: V2Answers): SessionTarget[] {
  const step = incrementKg(answers.experience);
  const sets = answers.goal === 'strength' ? 3 : answers.goal === 'hypertrophy' ? 4 : 3;
  const plate = answers.smallestPlateKg;
  return answers.keyLifts.map((lift) => {
    const current = answers.liftLoads[lift] ?? 0;
    const ideal = current + step;
    let target = loadableKg(ideal, plate);
    // Never prescribe a load that is not an increase. See `nextLoadableAbove`.
    if (plate != null && target <= current) target = nextLoadableAbove(current, plate);
    return {
      lift,
      currentKg: current,
      targetKg: target,
      addedKg: Math.round((target - current) * 100) / 100,
      sets,
      rounded: plate != null && Math.abs(target - ideal) > 1e-9,
      platesKnown: plate != null,
    };
  });
}

/** A load as English writes it: a decimal point, and no trailing zero on a
 * whole number. 82.5, 80, 1.25. */
export function kg(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}
