import { signOut } from '@/lib/auth/sign-in';
import { getDb, setMeta } from '@/lib/db/index';
import { devLog } from '@/lib/log';
import { supabase } from '@/lib/supabase';

/**
 * Delete the account, for real (PLAN D1).
 *
 * Apple requires in-app account deletion wherever an account can be created
 * in-app. Until 28 July this was an Alert promising deletion "within 30 days"
 * and doing nothing at all — a claim the code did not keep, on the same list as
 * the fabricated rating.
 *
 * ORDER MATTERS, and it is the opposite of the intuitive one:
 *
 *  1. THE SERVER FIRST. `delete-account` deletes the row in `auth.users` with
 *     the service-role key; every table cascades off it, so one statement takes
 *     the whole account. If this fails we stop and say so — wiping the phone
 *     first would leave the user with no copy AND a live account.
 *  2. THEN THE DEVICE. Every local table, including the meta KV and the parse
 *     cache, is dropped in one transaction. `ensureLocalUser` already does this
 *     shape of wipe on an account switch; this is the same boundary, closed for
 *     good rather than moved.
 *  3. THEN SIGN OUT, which flips the auth guard and drops the user back at the
 *     paywall with a clean install's state.
 *
 * The caller is expected to have offered the export first — the words are the
 * user's and §20 says they are never held hostage — but this never blocks on
 * that, because a person deleting an account is entitled to be believed.
 */
export type DeleteAccountOutcome = 'deleted' | 'offline' | 'failed';

export async function deleteAccount(): Promise<DeleteAccountOutcome> {
  // 1. The server.
  try {
    const { data, error } = await supabase.functions.invoke<{ deleted?: boolean }>(
      'delete-account',
      { body: {} },
    );
    if (error || !data?.deleted) {
      devLog('account deletion rejected by the server');
      return 'failed';
    }
  } catch (err) {
    // A network failure is not a refusal — say which one it was, so the copy
    // can tell the user to try again on a connection instead of implying we
    // said no (§15: errors say what happened and what to do).
    devLog('account deletion could not reach the server:', err instanceof Error ? err.message : err);
    return 'offline';
  }

  // 2. The device. Same wipe `ensureLocalUser` performs on an account switch.
  try {
    const db = getDb();
    db.withTransactionSync(() => {
      db.execSync(
        'DELETE FROM parse_cache; DELETE FROM corrections; DELETE FROM alias_overrides; DELETE FROM sets; DELETE FROM items; DELETE FROM workouts; DELETE FROM predictions; DELETE FROM plan_days; DELETE FROM exercises; DELETE FROM meta;',
      );
    });
    // The account is gone; the next launch must run the funnel from the top.
    setMeta('user_id', null);
  } catch (err) {
    // The account is already deleted server-side at this point, so this is not
    // recoverable by retrying the whole thing — sign out anyway and let the
    // account-switch wipe catch the rest on the next sign-in.
    devLog('local wipe after deletion failed:', err instanceof Error ? err.message : err);
  }

  // 3. Out.
  try {
    await signOut();
  } catch {
    // The session is worthless now — a failed sign-out is not worth reporting.
  }
  return 'deleted';
}
