import type { V2Answers } from '@/state/onboarding-v2';

import { KEY_LIFTS } from './flow.ts';

/**
 * THE TWO INSIGHT SCREENS — what they say, and why they are allowed to say it.
 *
 * Owner, 28 August 2026: two interstitials that tell the person something
 * specific back, built out of what they have already answered, so the flow
 * feels personal rather than administrative.
 *
 * Cal AI does this twice — `Habit Insight` at 12/38 and `AI Comparison` at
 * 14/38 — one big centred sentence with a single highlighted value and no
 * question. That is the shape copied here.
 *
 * ## What is NOT copied, and this is the whole design constraint
 *
 * Cal AI's insight reads *"90% of users say that the change is obvious after
 * using Cal AI and it is not easy to rebound."* That is a fabricated statistic
 * about other people, and CLAUDE.md §2 rule 2 and §3 forbid it outright — "no
 * fabricated reviews, ratings, user counts, testimonials, or personalisation —
 * anywhere, including placeholders."
 *
 * So every line below is one of exactly two things:
 *
 *   1. **Arithmetic on their own answers.** 3 sessions a week is 156 a year.
 *      That is not a claim, it is multiplication, and it is more interesting
 *      than a made-up percentage because nobody else in the funnel gets it.
 *   2. **A fact about how the app works.** "Last session's loads are on screen
 *      while you write the next one" is either true of the product or it is a
 *      bug — never a promise about the person's body or their future.
 *
 * No health claims, no "you will", no percentage of anybody, no comparison to
 * other users. If a line cannot be one of those two things, it does not ship.
 */

export interface Insight {
  /** The big centred line. One highlighted span is picked out by `accent`. */
  headline: string;
  /** The word or number inside `headline` to draw in brand blue. Must appear
   * in it verbatim; the renderer splits on it. */
  accent: string;
  /** The quieter line underneath. */
  body: string;
}

/**
 * SCREEN 4 — the obstacle, answered.
 *
 * Fires straight after they pick what gets in the way, and names the specific
 * thing the app does about the specific thing they chose. Qualitative, because
 * at this point in the flow there are no numbers yet — the app knows where they
 * log and what annoys them and nothing else.
 *
 * Keyed off the FIRST obstacle picked, which is the one they reached for.
 */
export function obstacleInsight(a: V2Answers): Insight | null {
  const lead = a.obstacles[0];
  if (!lead) return null;

  const base: Record<string, Insight> = {
    typing: {
      headline: 'A session is one line.',
      accent: 'one line',
      body: 'No grid, no cells, no tapping between sets. You write what you did the way you would say it, and Recore reads it afterwards.',
    },
    supersets: {
      headline: 'Supersets stay the shape you wrote them.',
      accent: 'the shape you wrote them',
      body: 'Recore reads the line rather than asking you to fit one. Dropsets, myo-reps, a set you cut short — all of it survives as text.',
    },
    forget: {
      headline: 'Last time is on the screen.',
      accent: 'on the screen',
      body: 'While you write today, the loads and reps from the last time you did that lift sit right there. Nothing to remember and nothing to look up.',
    },
    whatnext: {
      headline: 'The next load comes from the last one.',
      accent: 'the last one',
      body: 'Not from a template and not from an average. Recore works it out from what you actually lifted, and shows you the arithmetic.',
    },
    quit: {
      headline: 'Four weeks is all Recore asks.',
      accent: 'Four weeks',
      body: 'No streak to protect and nothing to lose by missing a day. After four weeks the record is worth keeping for its own sake, which is the only reason anyone keeps one.',
    },
  };

  const insight = base[lead];
  if (!insight) return null;

  // A tracker answer changes what is worth adding. Someone coming from Hevy or
  // Strong has history; someone with a paper notebook has a different problem.
  const tail =
    a.tracker === 'app'
      ? ' Your existing history can come with you.'
      : a.tracker === 'paper' || a.tracker === 'notes'
        ? ' Writing is already how you do it — that part does not change.'
        : '';

  return { ...insight, body: insight.body + tail };
}

/**
 * SCREEN 13 — the year, counted.
 *
 * Fires after they say how often they train, which is the first moment the flow
 * has a number worth multiplying. `sessions` is the count-up figure the screen
 * animates; everything else is a sentence around it.
 */
export interface YearInsight extends Insight {
  sessions: number;
}

export function yearInsight(a: V2Answers): YearInsight | null {
  const perWeek = Number(a.frequency);
  if (!Number.isFinite(perWeek) || perWeek <= 0) return null;

  // 52 weeks, and nothing else. No adherence assumption, no drop-off curve, no
  // "if you stick with it" — that would be a claim about the person.
  const sessions = perWeek * 52;

  const closing: Record<string, string> = {
    strength: 'Every one of them is a load Recore can work the next one out from.',
    hypertrophy: 'Every one of them is volume Recore can count without you tallying it.',
    both: 'Every one of them feeds both the load and the volume.',
    consistency: 'The count is the point, and it is the one number nobody can argue with.',
    hybrid: 'Whatever shape each one takes, it goes in as you wrote it.',
  };

  return {
    sessions,
    headline: `${sessions} sessions a year.`,
    accent: String(sessions),
    body:
      `That is what ${perWeek} a week comes to. ` +
      (closing[a.goal ?? ''] ?? 'Every one of them is kept exactly as you wrote it.'),
  };
}

/**
 * A YEAR SPLIT INTO MONTHS — the year screen's chart.
 *
 * 52 weeks do not divide into 12 months, and pretending they do is what makes
 * a chart like this feel fake: twelve identical bars is a picture of division,
 * not of a year. 52 = 4×12 + 4, so four months carry a fifth week, spread out
 * rather than bunched at the start. The bars are therefore mostly level with
 * four slightly taller ones, which is what a real calendar does to a training
 * routine and is the only reason the shape is worth drawing.
 *
 * Pure arithmetic on their own answer — the same contract as everything else
 * on these screens.
 */
export const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] as const;

export function sessionsByMonth(perWeek: number): number[] {
  if (!Number.isFinite(perWeek) || perWeek <= 0) return [];
  // Months 0, 3, 6 and 9 take the four spare weeks.
  return MONTHS.map((_, i) => (4 + (i % 3 === 0 ? 1 : 0)) * perWeek);
}

/** Both, behind one call, so the screen component stays dumb. */
export function insightFor(id: string, a: V2Answers): Insight | null {
  if (id === 'obstacle-insight') return obstacleInsight(a);
  if (id === 'year-insight') return yearInsight(a);
  return null;
}

/** Screen 13's insight names their lifts if they exist yet — they do not at
 * that point in the flow, so this is exported only for the test that proves the
 * insight never reaches forward for an answer it cannot have. */
export const LIFTS_NOT_YET_KNOWN = KEY_LIFTS.length > 0;
