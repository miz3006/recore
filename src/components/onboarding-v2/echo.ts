import type { V2Answers } from '@/state/onboarding-v2';

import { ASSUMED_BAR_KG, incrementKg, KEY_LIFTS, sessionsPerStep } from './flow.ts';

/**
 * WHAT THE LAST ANSWER CHANGED — one quiet line at the top of the next screen.
 *
 * Fitbod carries a "Prior Answer Chip" on five consecutive screens (positions
 * 4–8 of 15) and makes $1M a month on the shortest funnel in the category. v1
 * Recore does the same thing (`235d286`, "answers visibly return"). v2 asked
 * eight questions and, until 28 August 2026, never once showed that it had
 * heard one until the reveal on screen 17.
 *
 * ## Why this is not a chip that repeats the answer
 *
 * Repeating the answer back is a receipt, and a receipt is worth very little —
 * the person knows what they tapped two seconds ago. **This says what the app
 * did with it.** "2 to 5 years" becomes "Steps of 2.5 kg"; "Four" becomes "Four
 * sessions a week to schedule"; "Push / Pull / Legs" becomes "Grouped by push,
 * pull and legs". That is the difference between an app that remembers and an
 * app that is listening, and it is the whole reason this flow asks anything at
 * all: §2's rule is that every screen must change app behaviour, and this is
 * the behaviour, stated.
 *
 * Where an answer genuinely changes nothing yet, there is no echo. Screen 4's
 * attribution changes nothing in-product by design, so it gets none — an echo
 * there would be the app pretending to have used something it filed away.
 *
 * ## What it is not allowed to be
 *
 * Not praise, not encouragement, not a claim about the person. "Great choice"
 * and "You're on your way" are exactly what CLAUDE.md §2 rule 6 bans. Every
 * line below is a statement about the app's own configuration, and every number
 * in one is computed, never asserted.
 */
export function echoFor(id: string, a: V2Answers): string | null {
  switch (id) {
    // → on the obstacle screen. What the tracker answer sets up.
    case 'obstacles':
      if (a.tracker === 'memory') return null;
      return a.tracker ? 'Noted — nothing to migrate by hand' : null;

    // → on attribution. Which frustration leads from here on.
    case 'attribution': {
      if (a.obstacles.length === 0) return null;
      return a.obstacles.length === 1 ? 'One thing to fix' : 'Two things to fix';
    }

    // → on the read. The demo either read or it did not; both are facts.
    case 'reading':
      return a.demoEntries.length > 0
        ? `Read ${a.demoEntries.length === 1 ? 'one line' : `${a.demoEntries.length} lines`}`
        : null;

    // → on experience. The progression model the goal selected.
    case 'experience':
      switch (a.goal) {
        case 'strength':
          return 'Heavier sets, fewer of them';
        case 'hypertrophy':
          return 'More sets, steadier loads';
        case 'both':
          return 'Strength and volume together';
        case 'consistency':
          return 'Turning up is the target';
        case 'hybrid':
          return 'Mixed sessions';
        default:
          return null;
      }

    // → on frequency. The increment, computed, not chosen.
    case 'frequency':
      return a.experience
        ? `Steps of ${trim(incrementKg(a.experience))} kg, every ${plural(
            sessionsPerStep(a.experience),
            'session',
          )}`
        : null;

    // → on the year insight. What there is to schedule.
    case 'year-insight':
      return a.frequency ? `${plural(Number(a.frequency), 'session')} a week to schedule` : null;

    // → on lifts. How the clustering engine will group things.
    case 'lifts':
      switch (a.split) {
        case 'ppl':
          return 'Grouped by push, pull and legs';
        case 'upperlower':
          return 'Grouped by upper and lower';
        case 'fullbody':
          return 'One session, everything in it';
        case 'bro':
          return 'Grouped by muscle';
        case 'flat':
          return 'Scheduled by lift, not by day';
        default:
          return null;
      }

    // → on overload. The lifts, and whether the numbers are loadable.
    case 'overload': {
      if (a.keyLifts.length === 0) return null;
      const named = a.keyLifts
        .map((id) => KEY_LIFTS.find((l) => l.id === id)?.label ?? id)
        .join(', ');
      return a.smallestPlateKg
        ? `${named} · to the nearest ${trim(a.smallestPlateKg * 2)} kg`
        : named;
    }

    // → on building. The commitment, as a fact about the record.
    case 'building':
      return a.committed ? 'Four weeks, every session' : null;

    default:
      return null;
  }
}

/** Loads print the way English writes them: 2.5, not 2,5 — and 5, not 5.0. */
function trim(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function plural(n: number, word: string): string {
  if (!Number.isFinite(n) || n <= 0) return `${word}s`;
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Exported for the test that keeps this honest. */
export const ECHO_BAR_KG = ASSUMED_BAR_KG;
