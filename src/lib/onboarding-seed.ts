import { todayKey } from '@/lib/db/dates';
import { getMeta, setMeta } from '@/lib/db/index';
import { getWorkoutForDay, saveRawText } from '@/lib/db/workouts';
import { devLog } from '@/lib/log';
import { useOnboardingAnswers } from '@/state/onboarding';

import { parseDemoEntry } from './demo-parse';

/**
 * THE FIRST SESSION IS THE ONE THEY ALREADY WROTE (conversion pass, 20 Aug
 * 2026).
 *
 * A person who typed `deadlift 140kg 5,5,5` on the demo screen has written a
 * real line about real training. Before this, that line was shown back to them
 * once and then thrown away, and the app they had just paid for opened on an
 * empty page. Now it is carried into the record at signup: their own words, as
 * `raw_text`, on the day they signed up.
 *
 * ## It is their raw text, not our reading
 *
 * What lands in the database is the LINE, verbatim — never the demo grammar's
 * interpretation of it (`lib/demo-parse.ts`). `raw_text` is the source of truth
 * (CLAUDE.md §3) and the real parser reads it on the next pass like any other
 * line, so nothing the offline grammar guessed can ever become a stored
 * reading. `saveRawText` marks it `needs_parse`, which is exactly what a typed
 * line does.
 *
 * ## Three refusals
 *
 *  · **Nothing the app made up.** `source === 'example'` means the canned line
 *    typed itself for them; that is a demonstration, not their training.
 *  · **Never twice.** A marker in the meta KV, so a re-launch, a re-sign-in or
 *    a restore cannot write the same session again.
 *  · **Never over their own writing.** If today's note already has words in it,
 *    the seed stands down and marks itself done. The record belongs to the
 *    person, and a line they wrote in the app outranks one they wrote in a demo.
 */

/** Marks the install as seeded, and names the workout it produced. */
const SEEDED_KEY = 'ob_demo_seeded';

/**
 * The `origin: onboarding_demo` flag, per workout.
 *
 * A meta row rather than a column on `workouts`: the origin of a session is not
 * part of the record's shape, it changes nothing any reader computes, and a
 * schema migration for a boolean that one function writes and one function
 * reads would be the more expensive of the two by far. Meta is account-scoped,
 * exported and deleted with everything else (§12).
 */
const originKey = (workoutId: string) => `ob_demo_origin:${workoutId}`;

export function isOnboardingDemoWorkout(workoutId: string): boolean {
  return getMeta(originKey(workoutId)) === 'onboarding_demo';
}

/**
 * Write the demo line into the record for a freshly attached account. Safe to
 * call on every sign-in; it does nothing after the first.
 *
 * Called from the auth provider AFTER `ensureLocalUser` (which wipes the local
 * database when the account changes) and BEFORE the session store hydrates, so
 * Today opens on the entry rather than having to be told about it afterwards.
 */
export function seedOnboardingDemo(userId: string): void {
  try {
    if (getMeta(SEEDED_KEY)) return;

    // The in-memory answers, on purpose: they survive `ensureLocalUser`'s wipe
    // of the meta table, which is what the persisted copy lives in.
    const entry = parseDemoEntry(useOnboardingAnswers.getState().answers.demoEntry);
    if (!entry || entry.source === 'example') return;

    const text = entry.rawText.trim();
    if (!text) return;

    const day = todayKey();
    const existing = getWorkoutForDay(userId, day);
    if (existing && existing.raw_text.trim().length > 0) {
      setMeta(SEEDED_KEY, existing.id);
      return;
    }

    const workoutId = saveRawText(userId, day, text);
    setMeta(originKey(workoutId), 'onboarding_demo');
    setMeta(SEEDED_KEY, workoutId);
    devLog('seeded the onboarding demo line as the first session');
  } catch {
    // A first session is a gift, never a gate: if anything here fails the app
    // opens empty, which is exactly where it opened before this existed.
  }
}
