/**
 * WHO THE WALK-THROUGH IS OWED TO — the rule on its own, away from SQLite.
 *
 * The spotlight tour is stored as two rows in the device-local meta KV, and the
 * bug it shipped with for six weeks was not in the storage, the geometry or the
 * copy: it was in **what the absence of a row was taken to mean**. The gate read
 * `!isTourDone()`, and "this device has no done-flag" is equally true of
 *
 *  1. somebody who has just finished the funnel — the one person it is for;
 *  2. a returning athlete's SECOND PHONE, or their reinstall;
 *  3. anybody switching back to their own account after somebody else used the
 *     phone, because `ensureLocalUser` wipes `meta` on an account change;
 *  4. the same person on the next launch after force-quitting mid-tour, because
 *     the flag was only written when the tour was FINISHED or skipped.
 *
 * Three of those four are wrong, and none of them is visible from the flag —
 * which is exactly why the rule is here, as data-in/data-out, with every one of
 * those four lives written as a test (`tour-gate.test.ts`). `prefs.ts` owns the
 * key names and the reading and writing; this owns the meaning.
 *
 * The fix is to ARM rather than to assume: nothing is owed unless something says
 * so, and the only thing that says so is the funnel reaching its end. That is
 * the same line `app/index.tsx` already routes on — *"signed in with no local
 * onboarding flag is a returning user, not a new one"*.
 */

/** The two rows, exactly as the KV hands them over (`null` = no row). */
export interface TourFlags {
  /** `pref_tour_armed` — somebody finished the funnel and has not been shown it. */
  armed: string | null;
  /** `pref_tour_done` — this account was walked through, kept as the record. */
  done: string | null;
}

/** Nothing owed, nothing shown: a fresh install, and also what an account wipe
 * leaves behind. */
export const NO_TOUR: TourFlags = { armed: null, done: null };

/**
 * Is the walk-through still owed?
 *
 * **Deliberately not `!isDone(f)`.** A person who never made a profile on this
 * device is owed nothing and has no `done` row either, so the two readings agree
 * only for case 1 above and disagree for cases 2–4.
 */
export function tourIsOwed(f: TourFlags): boolean {
  return f.armed === '1';
}

/** Whether this account has been walked through — the record, not the gate. */
export function tourWasShown(f: TourFlags): boolean {
  return f.done === '1';
}

/** The funnel reached its end: somebody just made a profile here. */
export function armed(f: TourFlags): TourFlags {
  return { ...f, armed: '1' };
}

/**
 * The tour went ON SCREEN. Being shown is what "shown once" means — writing this
 * only on finish/skip is case 4, and it replayed the whole thing for anybody who
 * killed the app on step two.
 */
export function spent(f: TourFlags): TourFlags {
  return { armed: null, done: '1' };
}
