import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { devLog } from '@/lib/log';
import { supabase } from '@/lib/supabase';

/**
 * Sign in with Apple + Google (task §4). No email/password. Sessions land in
 * the Keychain via the secure storage adapter on the supabase client.
 */

// Completes any pending browser session (no-op on native cold paths).
WebBrowser.maybeCompleteAuthSession();

const redirectTo = makeRedirectUri(); // recore://

export class SignInCancelledError extends Error {
  constructor() {
    super('sign-in cancelled');
    this.name = 'SignInCancelledError';
  }
}

/**
 * Sign in with Apple → exchange the identity token with Supabase.
 *
 * Apple returns fullName/email ONLY on the very first authorization for this
 * app — so they are persisted to `profiles` immediately, before anything else
 * can fail. RLS restricts the upsert to the user's own row.
 */
export async function signInWithApple(): Promise<void> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
      throw new SignInCancelledError();
    }
    throw err;
  }

  if (!credential.identityToken) {
    throw new Error('Apple returned no identity token');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;

  // First sign-in only: persist name + email NOW — Apple never sends them again.
  const displayName = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter(Boolean)
    .join(' ')
    .trim();
  const email = credential.email ?? data.user?.email ?? null;

  if (data.user && (displayName || email)) {
    const profile: { id: string; display_name?: string; email?: string } = { id: data.user.id };
    if (displayName) profile.display_name = displayName;
    if (email) profile.email = email;
    const { error: profileError } = await supabase.from('profiles').upsert(profile);
    if (profileError) devLog('profile upsert failed; will not retry (non-fatal)');
  }
}

/**
 * Google via Supabase OAuth (PKCE): open the provider in an auth session
 * browser, then exchange the returned one-time code for a session. Tokens
 * never ride in the URL.
 */
export async function signInWithGoogle(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('No OAuth URL returned');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    throw new SignInCancelledError();
  }

  await createSessionFromUrl(result.url);

  // Best-effort profile fill from the Google identity (RLS: own row only).
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (user) {
    const displayName =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined);
    const profile: { id: string; display_name?: string; email?: string } = { id: user.id };
    if (displayName) profile.display_name = displayName;
    if (user.email) profile.email = user.email;
    const { error: profileError } = await supabase.from('profiles').upsert(profile);
    if (profileError) devLog('profile upsert failed; will not retry (non-fatal)');
  }
}

async function createSessionFromUrl(url: string): Promise<void> {
  const parsed = new URL(url);

  const errorDescription =
    parsed.searchParams.get('error_description') ?? parsed.searchParams.get('error');
  if (errorDescription) throw new Error(errorDescription);

  // PKCE: exchange the one-time code.
  const code = parsed.searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  // Implicit-flow fallback (tokens in the fragment).
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const accessToken = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return;
  }

  throw new Error('OAuth redirect carried no session');
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Development sign-in (PLAN.md 0.7 dev entrance). `__DEV__` only.
 *
 * Signs into a fixed, disposable email account so a dev build can get past the
 * paywall without a real Apple ID. What you land in is the REAL app: a genuine
 * Supabase user scopes the local database, RLS applies, and the sync loop runs.
 * A fake local session would skip all three and hide precisely the bugs a dev
 * build exists to surface.
 *
 * Fixed credentials rather than an anonymous session on purpose. Anonymous
 * sign-in mints a NEW user id every launch, and `ensureLocalUser` wipes the
 * local database whenever the account changes — so yesterday's test data would
 * vanish every time you opened the app. A stable id keeps it.
 *
 * The password is a constant in source, which is fine and deliberate: the
 * account holds nothing, it exists only on the dev project, and `__DEV__`
 * compiles this whole function out of release bundles. It is not a credential
 * for anything a user owns.
 *
 * §14.4 still holds — this skips the SCREEN, never the entitlement.
 */
const DEV_EMAIL = 'dev@recore.local';
const DEV_PASSWORD = 'recore-dev-2026';

export async function signInForDevelopment(): Promise<void> {
  if (!__DEV__) throw new Error('development sign-in is not available in this build');

  const { error } = await supabase.auth.signInWithPassword({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
  });
  if (!error) return;

  // First run on a fresh project: the account does not exist yet, so make it.
  // Supabase returns a session directly when email confirmation is off, which is
  // the configuration this project uses.
  const { data, error: signUpError } = await supabase.auth.signUp({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
  });
  if (signUpError) throw signUpError;
  if (!data.session) {
    throw new Error(
      'Signed up, but no session came back — email confirmation is on for this project. ' +
        'Turn it off in Authentication → Providers → Email, or confirm dev@recore.local once.',
    );
  }
}
