import { formatChargeDate } from '../../lib/billing/trial.ts';

import type { IconName } from '../icon.tsx';

/**
 * THE TRIAL TIMELINE, AS DATA — the spine of the plan screen.
 *
 * `docs/onboarding-v2-spec.md` §2: "trial timeline (today unlocked → day 5
 * reminder → day 7 charged)". Cal AI runs the identical three rows at
 * `6480417616/pay_8ixcs`, and so do the four nearest screens the library
 * returns for it — Daily Hanzi, Essembl, Quran Widgets, Coursology, in four
 * unrelated categories. It is the convergent shape, not one app's taste.
 *
 * ## Every day number is the store's, not ours
 *
 * `trialDays` comes from the introductory offer App Store Connect actually
 * serves (`store.ts`, `StorePlan.trialDays`). CLAUDE.md §2 rule 5: no trial
 * clock ships until the store integration keeps that promise. So a product
 * configured with five days draws a five-day timeline, and a product with no
 * introductory offer at all draws the two-row version that promises no trial
 * and says what it does charge. The spec's "day 5 → day 7" is what a
 * seven-day offer produces, not a constant.
 *
 * The reminder lands two days before the end, which is where the spec puts it
 * and where `src/app/paywall.tsx` already puts it. One rule, one place.
 */

export interface TrialStep {
  icon: IconName;
  title: string;
  body: string;
  /**
   * A substring of `body` the renderer draws heavier — the person's own
   * prescribed load, and the only thing on this screen that is theirs and a
   * number at the same time. Markup stays out of the copy: the renderer splits
   * on the string, which is `insights.ts`'s `accent` pattern.
   */
  strong?: string | null;
  /** The last node draws no rail below it. */
  last?: boolean;
}

/** The "Today" row's body and the figure inside it (`copy.ts`). Passed as one
 * object so a caller cannot supply a highlight that belongs to another
 * sentence. */
export interface TodayCopy {
  body: string;
  strong: string | null;
}

/** Day the in-app reminder fires. Never before day 1, whatever the offer. */
export function reminderDay(trialDays: number): number {
  return Math.max(1, trialDays - 2);
}

/**
 * The three rows.
 *
 * @param trialDays  Whole free days the store offers. 0 → the honest two-row
 *                   version, which describes a straight subscription.
 * @param today      What unlocks today, in the person's own numbers
 *                   (`copy.ts` — the value the spec asks to be repeated here),
 *                   with the figure to draw heavier.
 * @param priceLabel Apple's own localized price string, or null while the
 *                   offer is still in flight. A null prints no amount; it never
 *                   prints a placeholder one.
 * @param nowMs      Injected so the charge date is testable and so the screen
 *                   and its test cannot disagree about "today".
 */
export function trialTimeline(
  trialDays: number,
  today: TodayCopy,
  priceLabel: string | null,
  nowMs: number = Date.now(),
): TrialStep[] {
  const first: TrialStep = {
    icon: 'unlock',
    title: 'Today — everything unlocks',
    body: today.body,
    strong: today.strong,
  };

  if (trialDays <= 0) {
    return [
      first,
      {
        icon: 'card',
        title: priceLabel ? `${priceLabel} today` : 'Billing starts today',
        // ONE LINE AT DEFAULT TYPE, like every body on this screen. "any time
        // in the App Store" left with the second line it was costing: the
        // assurance row above the button says exactly that, and says it in the
        // case — no trial — where this row is the one that renders.
        body: 'Renews until you cancel.',
        last: true,
      },
    ];
  }

  const charge = formatChargeDate(nowMs + trialDays * 86_400_000);

  return [
    first,
    {
      icon: 'bell',
      title: `Day ${reminderDay(trialDays)} — reminder`,
      // THERE IS NO MAIL SERVER AND NO PUSH REQUIREMENT HERE. What actually
      // happens is `trial-reminder-sheet.tsx`: the first time the app opens
      // inside the window it shows the date, the amount and how to cancel. So
      // this row stays true for someone who denied notifications, which a
      // "we'll send you a reminder" row would not.
      body: 'The date and the amount, in the app.',
    },
    {
      icon: 'card',
      // THE AMOUNT IS THE TITLE, not the body. It used to sit at the head of
      // the body with the date and the escape behind it, and the three together
      // ran to a second line at default type on a 393 pt phone — the one thing
      // this screen cannot afford (owner: "the screen must not scroll"). In the
      // title it is also where the eye already is: every other row names its
      // event there. With no price from the store the title says what happens
      // instead, and never a placeholder amount.
      title: priceLabel ? `Day ${trialDays} — ${priceLabel}` : `Day ${trialDays} — billing starts`,
      // "Your record stays yours either way" lived here and now lives only in
      // the fine print, which says the same thing more precisely ("stays
      // exportable whether you subscribe or not"). Said twice it cost this row
      // a third line and pushed the legal block off the screen.
      body: `On ${charge}, unless you cancel first.`,
      last: true,
    },
  ];
}
