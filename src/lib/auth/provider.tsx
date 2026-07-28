import { type Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { DEV_LOCAL_USER_ID, useDevBypass } from '@/lib/auth/dev-bypass';
import { ensureLocalUser } from '@/lib/db/index';
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

  // Wire the data layer to the signed-in user.
  // With the dev bypass on there is no account, but the SQLite mirror is still
  // scoped per user — so it gets a fixed local id. Sync stays off below: there
  // is nowhere for those rows to belong.
  const devBypass = useDevBypass();
  const bypassed = devBypass && state.session === null;
  const userId = state.session?.user.id ?? (bypassed ? DEV_LOCAL_USER_ID : null);
  useEffect(() => {
    if (userId) {
      ensureLocalUser(userId);
      hydrate(userId);
      if (!bypassed) startSync(userId);
    } else {
      stopSync();
      reset();
    }
  }, [userId, bypassed, hydrate, reset]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
