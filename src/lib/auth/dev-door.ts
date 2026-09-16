/**
 * WHETHER THE DEVELOPMENT DOOR EXISTS AT ALL — the policy, split out of
 * `dev-sign-in.ts` (16 September 2026) so it can be read, reasoned about, and
 * TESTED without pulling the Supabase client and React Native in behind it.
 *
 * ## Why the split, when `__DEV__` was already the gate
 *
 * The owner's rule is that the development sign-in must not be in production,
 * and the old arrangement satisfied it by construction: Metro replaces
 * `__DEV__` with `false` in a release bundle and the minifier deletes the
 * branch. That is still the first and hardest gate, and nothing here weakens
 * it. What it could not do is be *checked* — `dev-sign-in.ts` imports
 * `@/lib/supabase`, so no `node --test` file can import it, so the one rule
 * that must never quietly stop holding had no test behind it.
 *
 * This module imports nothing. `dev-door.test.ts` asserts the gate directly.
 *
 * ## The second gate: the door has to have a key
 *
 * `__DEV__` alone decided whether the sign-in screen DREW the row, while the
 * credential decided whether pressing it could work. Those were two different
 * questions with one answer, so every development build without
 * `EXPO_PUBLIC_DEV_EMAIL` / `EXPO_PUBLIC_DEV_PASSWORD` set — which is every
 * checkout of this repository until somebody fills in their own `.env` — drew
 * a labelled control under the Apple and Google buttons whose entire behaviour
 * was to fail with an error message. It was the only broken control on the
 * screen and it was on the screen by default.
 *
 * So the row is drawn only when the door can actually open: a development
 * build AND a configured account. Two gates, and the screen is clean when
 * either is shut.
 *
 * ## Why the reads are inside the functions
 *
 * Metro inlines `process.env.EXPO_PUBLIC_*` at bundle time wherever it is
 * spelled, so reading at call time costs nothing and is still a build-time
 * constant in the app. In a test it is the difference between being able to
 * set the environment and not.
 */

/**
 * True only in a development bundle.
 *
 * `typeof` first, because this module is imported by a plain `node --test`
 * file where the global does not exist. Metro substitutes the literal `false`
 * in a release bundle, which folds the whole expression away — the guard is
 * still deleted from the shipped binary, not merely evaluated in it.
 */
function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

/**
 * The development account, or `null` when the door is shut.
 *
 * Shut means either: this is not a development build, or the developer has not
 * put an account in their own untracked `.env`. There are no literals here and
 * there never will be again — see `dev-sign-in.ts` for what the two that used
 * to be here cost.
 */
export function devDoorCredentials(): { email: string; password: string } | null {
  if (!isDevBuild()) return null;

  const email = (process.env.EXPO_PUBLIC_DEV_EMAIL ?? '').trim();
  const password = (process.env.EXPO_PUBLIC_DEV_PASSWORD ?? '').trim();
  if (!email || !password) return null;

  return { email, password };
}

/**
 * Whether the sign-in screen may draw the development row at all.
 *
 * The screen asks this and nothing else. A `false` here means the block is not
 * in the tree — not disabled, not dimmed, not present.
 */
export function isDevSignInAvailable(): boolean {
  return devDoorCredentials() !== null;
}
