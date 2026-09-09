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
 * The project has email signups enabled with `mailer_autoconfirm` on
 * (`/auth/v1/settings`), so a `signUp` returns a session in the same response —
 * there is no confirmation link to click. The account below is created the
 * first time this is used and signed into every time after. It is an ordinary
 * user of the project: the same RLS, the same tables, its own training data.
 *
 * **It is a shared, hardcoded credential and that is deliberate**, because the
 * alternative is a per-developer secret in a file somebody eventually commits.
 * It grants access to nothing but this development project's own dev account.
 * Do not point it at production, and do not put a real person's address here.
 */

/** The development account. Not a person, and not reachable by email. */
const DEV_EMAIL = 'dev@recore.invalid';
/** A dev-project credential, kept here rather than in a developer's shell so
 * every machine opens the same account. It protects nothing real. */
const DEV_PASSWORD = 'recore-development-only';

/**
 * Sign in as the development account, creating it on first use.
 *
 * Throws with a readable reason on any failure — the caller shows it, and in a
 * development build that sentence is the whole point of the function.
 */
export async function signInAsDeveloper(): Promise<void> {
  if (!__DEV__) throw new Error('the development sign-in is not available in this build');

  const existing = await supabase.auth.signInWithPassword({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
  });
  if (!existing.error) {
    devLog('signed in as the development account');
    return;
  }

  // First use on this project: the account does not exist yet. Any other
  // failure is real and is reported rather than papered over with a signup.
  if (existing.error.code !== 'invalid_credentials') throw existing.error;

  devLog('development account not found — creating it');
  const created = await supabase.auth.signUp({ email: DEV_EMAIL, password: DEV_PASSWORD });
  if (created.error) throw created.error;

  // With `mailer_autoconfirm` on, the session arrives with the signup. Without
  // it, Supabase is waiting on a confirmation link that will never be opened —
  // say so, because the alternative is a button that silently does nothing.
  if (!created.data.session) {
    throw new Error(
      'the account was created but no session came back — the project requires email confirmation, so turn on "Confirm email" → off, or enable anonymous sign-ins',
    );
  }
  devLog('development account created and signed in');
}
