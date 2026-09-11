import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';

import { devLog } from '@/lib/log';
import { supabase } from '@/lib/supabase';

/**
 * Sign in with Apple + Google (task §4). No email/password. Sessions land in
 * the Keychain via the secure storage adapter on the supabase client.
 */

// Completes any pending browser session (no-op on native cold paths).
WebBrowser.maybeCompleteAuthSession();

/**
 * WHERE THE BROWSER COMES BACK TO — and it carries a PATH on purpose.
 *
 * `makeRedirectUri()` with no options answers a bare `recore://`, and that is
 * the one form Supabase does not hand back unchanged. Measured against this
 * project on 9 September 2026, `redirect_to=recore://` comes out of
 * `/auth/v1/verify` as **`recore:`** — the empty authority is normalised away —
 * while `recore://auth-callback` is echoed byte for byte. `openAuthSessionAsync`
 * is given the string to watch for, so a redirect that arrives one form and is
 * awaited in another is a browser that never closes.
 *
 * The same probe reads the allow-list itself, and it has moved twice. Re-measured
 * 10 September 2026: `recore://auth-callback`, `exp://127.0.0.1:**` and
 * `exp://localhost:**` all survive; `exp://<lan-ip>:8081/--/auth-callback` and a
 * hostile `https://evil.example.com` both fall back to the project's Site URL.
 * So the loopback entry covers Expo Go in the simulator and nothing else — the
 * LAN address Metro prints by default is exactly the value that fails.
 *
 * `auth-callback` is not a route and does not need to be: on iOS the redirect
 * is caught by `ASWebAuthenticationSession` before the URL ever reaches the
 * router.
 */
const redirectTo = makeRedirectUri({ path: 'auth-callback' }); // recore://auth-callback

/**
 * THE REDIRECTS SUPABASE WILL HONOUR, AND A DEV-ONLY REFUSAL WHEN THIS IS NOT ONE.
 *
 * Supabase answers a redirect it has not allow-listed by sending the browser to
 * the project's **Site URL** instead. That is `http://localhost:3000`, so the
 * sign-in ends on *"Safari cannot open the page because it could not connect to
 * the server"*, several screens after the last thing this code could have
 * complained about — the person has by then chosen a Google account and typed a
 * password, and the app has said nothing wrong. So the check happens BEFORE the
 * browser opens, and it names the value it found.
 *
 * Two shapes pass, both measured against this project on 10 September 2026:
 *
 *  · `recore://**` — a development or release build, where the scheme is the
 *    app's own. This is the ordinary case.
 *  · `exp://127.0.0.1:**` and `exp://localhost:**` — Expo Go, but ONLY when
 *    Metro is bound to loopback (`npx expo start --localhost`, iOS Simulator).
 *    Expo Go is not structurally excluded from OAuth: `openAuthSessionAsync`
 *    hands `exp` to `ASWebAuthenticationSession` and Expo Go registers that
 *    scheme, so the PKCE exchange runs unchanged. It is the LAN address Metro
 *    prints by default — `exp://192.168.x.x:8081` — that no allow-list entry
 *    covers, and a phone on Wi-Fi cannot reach loopback, so a phone needs the
 *    development build.
 *
 * `__DEV__` only: a release build is a standalone app and always the first case.
 * The list is edited in the dashboard and has moved twice already — when this
 * throws on a value that looks right, re-probe `/auth/v1/verify` before editing
 * the rule (see the redirect note above).
 */
const APP_SCHEME = Constants.expoConfig?.scheme;
const APP_SCHEME_PREFIX = `${typeof APP_SCHEME === 'string' ? APP_SCHEME : 'recore'}://`;

/** The loopback hosts the allow-list's `exp://` entries cover. A LAN IP is not one. */
const LOOPBACK_EXP_REDIRECT = /^exp:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//;

function assertRedirectIsAllowListed(): void {
  if (!__DEV__) return;
  if (redirectTo.startsWith(APP_SCHEME_PREFIX)) return;
  if (LOOPBACK_EXP_REDIRECT.test(redirectTo)) return;
  throw new Error(
    `this runtime resolves the OAuth redirect to ${redirectTo}, which the Supabase ` +
      `project does not allow-list — it honours ${APP_SCHEME_PREFIX}** and loopback ` +
      `exp://127.0.0.1:** / exp://localhost:** only, so Google would finish on the ` +
      `project's Site URL and Safari would report a dead server. In Expo Go, restart ` +
      `Metro on loopback (npx expo start --localhost) and run the iOS Simulator; on a ` +
      `phone, use a development build (npm run ios).`,
  );
}

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
  // The redirect this build resolves to, printed where a developer will look
  // for it. `makeRedirectUri()` answers `recore://` in a development or release
  // build and `exp://<lan-ip>:8081/--/` inside Expo Go — two different URLs,
  // and Supabase rejects whichever of them is not in the project's redirect
  // allow-list. That rejection used to surface as four generic words.
  devLog('google sign-in redirectTo:', redirectTo);
  assertRedirectIsAllowListed();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('No OAuth URL returned');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  /**
   * A BROWSER THAT CAME BACK EMPTY IS NOT THE SAME AS A PERSON WHO CHANGED
   * THEIR MIND (4 September 2026).
   *
   * Every non-success type used to become `SignInCancelledError`, which the
   * caller deliberately shows nothing for — cancelling is not a failure. But
   * `dismiss` also lands here when the redirect never reached the app at all:
   * if `redirectTo` is not on the Supabase project's **Redirect URLs** list,
   * Supabase falls back to the project's Site URL, so the browser finishes on
   * whatever that is — a default project still points at `http://localhost:3000`,
   * which on a phone is a "cannot connect to the server" page. The person then
   * closes the browser, and the app said nothing, because closing a browser is
   * what cancelling looks like from in here.
   *
   * `cancel` is the only type iOS reports for an actual tap on Done, so that
   * stays silent. Everything else carries the type, and a developer gets the
   * word that tells them where to look.
   */
  if (result.type === 'cancel') throw new SignInCancelledError();
  if (result.type !== 'success') {
    devLog('google sign-in returned without a redirect:', result.type, '· expected', redirectTo);
    throw new Error(
      `the browser closed without returning to ${redirectTo} — check the Supabase project's Redirect URLs`,
    );
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

  /**
   * SUPABASE REPORTS ITS FAILURES IN THE FRAGMENT, NOT THE QUERY.
   *
   * Measured, same probe as `redirectTo` above: a rejected verification comes
   * back as `recore://auth-callback#error=access_denied&error_code=…`. Reading
   * only `searchParams` saw none of it, so an expired or denied authorization
   * fell through to the "carried no session" line at the bottom of this
   * function — the app blaming the redirect for a reason the redirect had
   * spelled out. Both halves are read now, query first.
   */
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const errorDescription =
    parsed.searchParams.get('error_description') ??
    parsed.searchParams.get('error') ??
    fragment.get('error_description') ??
    fragment.get('error');
  if (errorDescription) throw new Error(errorDescription);

  // PKCE: exchange the one-time code.
  const code = parsed.searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  // Implicit-flow fallback (tokens in the fragment parsed above).
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
