import { type Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { releaseEntitlement, resolveEntitlement } from '@/lib/billing/state';
import { ensureLocalUser } from '@/lib/db/index';
import { markFirstOpen } from '@/lib/funnel';
import { seedOnboardingDemo } from '@/lib/onboarding-seed';
import { startSync, stopSync } from '@/lib/sync/index';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/state/session-store';

/**
 * Session guard state (task §4). Restores the persisted session from the
 * Keychain on launch, tracks auth changes, and — on sign-in — scopes the local
 * database to the account (wiping another user's cached data if the account
 * changed), hydrates the store from SQLite, and starts background sync.
 */
interface AuthState {
  session: Session | null;
  /** True until the persisted session has been restored (splash stays up). */
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/** The id SQLite is scoped to before an account exists — see `userId` below. */
const LOCAL_USER_ID = 'sim-verify-user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });
  const hydrate = useSession((s) => s.hydrate);
  const reset = useSession((s) => s.reset);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setState({ session: data.session, loading: false });
      })
      .catch(() => {
        if (mounted) setState({ session: null, loading: false });
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setState({ session, loading: false });
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  /**
   * WHO THE LOCAL DATABASE BELONGS TO — and it is not always an account.
   *
   * The funnel writes before an account exists: onboarding answers, the demo
   * line that becomes the first session (`onboarding-seed.ts`), a plan. Sign-in
   * is the LAST step (`app/sign-in.tsx`), so SQLite has to be scoped to
   * somebody from the first screen. That is what the local id is for, and it is
   * local-first working as designed (CLAUDE.md §3).
   *
   * **What it is not is an account**, and until 4 September 2026 this line did
   * not distinguish the two: it carried a `// SIMPASS` marker — the third of
   * three left by a simulator-verification pass, the other two of which were
   * found and removed on 4 September — and every consumer below treated its
   * fabricated id as a signed-in user. See `syncing` below for what that cost.
   */
  const userId = state.session?.user.id ?? LOCAL_USER_ID;
  /**
   * THE SYNC LOOP NEEDS AN ACCOUNT, not a user id.
   *
   * Supabase is the backup target and every table behind it is RLS-scoped to
   * `auth.uid()`. Started under the local id, the loop pushed rows for a user
   * that exists in no `auth.users` table, with the anon key and no JWT, and was
   * refused on every pass — then re-queued itself and did it again. The parser
   * failed in the same breath and for the same reason: `parse-workout` runs an
   * explicit `getUser()` check behind `verify_jwt` (`supabase/config.toml`), so
   * signed out it can only ever answer no.
   *
   * On a device that reads as an unbroken column of `sync pass failed
   * (offline?)` and `parse failed, will retry on sync` — the app reporting a
   * network problem it does not have, for work it was never allowed to do.
   * Nothing was lost: the dirty flags kept every row queued and the first pass
   * after sign-in pushes all of it. But it was noise standing exactly where a
   * real fault would have shown, which is the reason it is worth fixing rather
   * than muting.
   */
  const signedIn = state.session != null;
  useEffect(() => {
    /**
     * NOTHING TOUCHES THE DATABASE'S SCOPE UNTIL WE KNOW WHO IS SIGNED IN.
     *
     * `getSession()` reads the Keychain asynchronously, so on a cold start the
     * first render always has `session: null` — and with the `SIMPASS` fallback
     * standing in for it, this effect ran with the LOCAL id, handed it to
     * `ensureLocalUser`, and that saw a change of user and **wiped a signed-in
     * athlete's entire local record. On every launch.** Then the session landed
     * a tick later and it wiped again, scoping back.
     *
     * `loading` is exactly the flag for this and was already being tracked for
     * the splash; it simply was not read here. Waiting for it costs a few
     * milliseconds of a screen that is already showing a splash, and it is the
     * difference between a scope decision made on a fact and one made on a
     * placeholder.
     */
    if (state.loading) return;

    if (userId) {
      // Signing in ADOPTS what the funnel wrote instead of deleting it
      // (owner, 4 September 2026). Two real accounts on one device still wipe:
      // `claimFrom` names the pre-account scope and nothing else can match it.
      ensureLocalUser(userId, LOCAL_USER_ID);
      // The line they wrote on the demo screen becomes their first session —
      // between scoping the database and hydrating the store, so Today opens on
      // it instead of on an empty page (`lib/onboarding-seed.ts`).
      seedOnboardingDemo(userId);
      hydrate(userId);
      // ONCE PER SESSION, here and nowhere else (product-direction §2). An
      // entitlement check that runs mid-set or on a write would be a network
      // call standing in front of a keystroke, which CLAUDE.md §2 invariant 1
      // forbids outright. It also ATTACHES THE STORE TO THIS ACCOUNT (§2: the
      // trial attaches to an account), which is why it takes the user id.
      //
      // Fire-and-forget on purpose: it resolves the cached decision
      // synchronously inside, so nothing on screen waits for the network half.
      void resolveEntitlement(userId);
      markFirstOpen();
      // Local-first writes go on regardless; only the PUSH waits for an
      // account to push to.
      if (signedIn) startSync(userId);
      else stopSync();
    } else {
      stopSync();
      // Detach the store customer too — otherwise the next account signed in on
      // this device inherits the previous one's entitlement.
      void releaseEntitlement();
      reset();
    }
  }, [state.loading, userId, signedIn, hydrate, reset]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
