import { devLog } from '@/lib/log';
import { supabase } from '@/lib/supabase';

/**
 * THE DEVELOPMENT DOOR PAST SIGN-IN (owner ask, 4 September 2026).
 *
 * ## Why this file exists, and why it is not a fourth `SIMPASS`
 *
 * Three markers reading `// SIMPASS` were found in this repository on 4
 * September — a redirect that pinned the dispatcher to one tab, a guard pinned
 * open, and a fabricated user id standing in for a session. All three did the
 * same thing: they made the app *behave* as though somebody were signed in
 * while no session existed. The third one was the expensive one. Because the
 * id was not attached to any `auth.users` row, the sync loop was refused on
 * every pass, `parse-workout` could only ever answer no, and `ensureLocalUser`
 * saw the id flip on every cold start and **deleted the whole local database**.
 * None of that was visible as a bug. It looked like a bad network.
 *
 * The lesson is not "never add a bypass". It is that **a bypass must produce a
 * real session, not an imitation of one.** Everything behind the sign-in screen
 * — RLS, the edge functions, the sync loop, the local database's scoping —
 * keys off a JWT. Hand it a genuine one and every path works exactly as it
 * does in production. Hand it a placeholder and each of those systems fails in
 * its own quiet way.
 *
 * So this signs in for real. It just does not need Apple or Google to do it.
 *
 * ## Three properties that keep it out of a release
 *
 *  1. **`__DEV__` and nothing else.** Not an env var, not a preference, not a
 *     remote flag — any of which can be switched on in a shipped binary. Metro
 *     replaces `__DEV__` with `false` in a production bundle and the minifier
 *     deletes the branch, so this function's body cannot execute in an app
 *     anyone installs. `signInAsDeveloper` returns early even so, because a
 *     guard you can read at the top of the function is worth more than one you
 *     have to trust the bundler for.
 *  2. **It is visible.** The sign-in screen draws a labelled row for it, under
 *     a rule, saying what it is. A door nobody can see is how the last three
 *     survived as long as they did.
 *  3. **It writes no product state.** No preference, no funnel event, no
 *     entitlement. It obtains a session; everything downstream then runs the
 *     ordinary way, including the claim of whatever the funnel wrote.
 *
 * ## How it gets a session without a provider
 *
 * It signs in with a password, against an account that must already exist. The
 * credential comes from the developer's own untracked `.env`; there is none in
 * this file and none compiled into any bundle.
 *
 * ## What changed on 10 September 2026, and why (S3)
 *
 * This file used to hold the credential as two literals — `dev@recore.invalid`
 * and its password — with a comment saying "do not point it at production".
 * There is only one Supabase project, `.env` and `.env.example` both named it,
 * and so it WAS production. The `__DEV__` guard below protects the app bundle
 * and nothing else: the credential itself worked against the public
 * `/auth/v1/token` endpoint from any shell, in a public repository.
 *
 * Two things follow from that, and both are done here:
 *
 *  · **The literals are gone.** The address and password are read from
 *    `EXPO_PUBLIC_DEV_EMAIL` / `EXPO_PUBLIC_DEV_PASSWORD`, absent by default.
 *    With neither set this function throws a sentence explaining what to add,
 *    which is the correct behaviour for a door nobody has been given a key to.
 *  · **The `signUp` fallback is gone.** It created the account for whoever
 *    asked first — so the credential did not merely open a door, it built one.
 *    The door can now open an account that exists and can never create one.
 *
 * `EXPO_PUBLIC_` is required for the value to reach the client bundle at all
 * (Expo strips everything else), and it means exactly what it says: whatever
 * you put here ends up readable in any build you produce with it set. Set it
 * only in a local `.env`, only against a development project, and never for a
 * build you hand to anyone.
 */

/** The development account, from the developer's own `.env`. Empty by default. */
const DEV_EMAIL = (process.env.EXPO_PUBLIC_DEV_EMAIL ?? '').trim();
const DEV_SECRET = (process.env.EXPO_PUBLIC_DEV_PASSWORD ?? '').trim();

/**
 * Sign in as the development account. The account must already exist —
 * creating one is not this function's job any more (S3).
 *
 * Throws with a readable reason on any failure — the caller shows it, and in a
 * development build that sentence is the whole point of the function.
 */
export async function signInAsDeveloper(): Promise<void> {
  if (!__DEV__) throw new Error('the development sign-in is not available in this build');

  if (!DEV_EMAIL || !DEV_SECRET) {
    throw new Error(
      'no development account configured — set EXPO_PUBLIC_DEV_EMAIL and EXPO_PUBLIC_DEV_PASSWORD in your local .env, against a development project, and restart Metro',
    );
  }

  const existing = await supabase.auth.signInWithPassword({
    email: DEV_EMAIL,
    password: DEV_SECRET,
  });
  if (existing.error) {
    // Including "no such account". Creating it here is what made a hardcoded
    // credential in a public repository into an open door.
    throw existing.error;
  }

  devLog('signed in as the development account');
}
