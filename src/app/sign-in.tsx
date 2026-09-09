import * as AppleAuthentication from 'expo-apple-authentication';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeSlideIn, PressableScale, Stagger } from '@/components/motion';
import { Eyebrow } from '@/components/primitives';
import { ProviderButton } from '@/components/provider-button';
import { signInAsDeveloper } from '@/lib/auth/dev-sign-in';
import {
  signInWithApple,
  signInWithGoogle,
  SignInCancelledError,
} from '@/lib/auth/sign-in';
import { isSupabaseConfigured } from '@/lib/env';
import { devLog } from '@/lib/log';
import { getName } from '@/lib/prefs';
import { color, MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';

/**
 * Sign in — now the LAST step of the funnel (2026-07-23 redesign), not the
 * front door. The user has personalized their ledger and picked a plan; this
 * screen turns that into a real account so the trial can start and the setup is
 * backed up. Framed as reward, never a toll gate. Providers are the real ones
 * wired today: Apple and Google.
 *
 * Both now wear their owners' buttons (`components/provider-button.tsx`, 28
 * August 2026) rather than the app's blue CTA and its tinted companion. The
 * header comment used to claim "Apple (primary ink-fill) and Google (bordered
 * secondary)" while the code rendered two shades of Recore blue; it is true
 * now. Auth logic (PKCE, busy/error states) is unchanged.
 *
 * **Apple and Google are the whole list, and that is a decision, not a gap.**
 * There is no email/password path and none is required: App Store guideline
 * 4.8 asks that an app offering a third-party login (Google) also offer a
 * privacy-equivalent one, and Sign in with Apple IS that option — it does not
 * ask for a second one on top. Every iPhone that can install this app is signed
 * into an Apple ID, so "I have neither account" is close to unreachable in
 * practice. The one real hole is an Apple ID without two-factor, which Sign in
 * with Apple refuses; those people still have Google. If that hole ever needs
 * closing, close it with an email magic link (Supabase already speaks OTP) —
 * never a password, because "No passwords" below is a promise this screen
 * keeps.
 *
 * ## The Apple button is allowed to be absent. It is not allowed to be SILENT.
 *
 * (owner, on a device, 4 September 2026 — *"appla sploh ni kot možnost"*.)
 *
 * `AppleAuthentication.isAvailableAsync()` is a probe of the NATIVE module, and
 * `expo-apple-authentication` resolves through `requireOptionalNativeModule`:
 * when the module is not in the running binary it hands back a stub whose
 * `isAvailableAsync` returns `false` forever. **Expo Go does not carry it**, so
 * inside Expo Go the probe answers no, the button was dropped from the tree,
 * and the screen offered Google alone with nothing said about why — while the
 * caption two lines below went on promising Face ID and a hidden email. That is
 * not "Apple is unavailable", it is a screen that looks broken, and the same
 * silence would hide a genuinely misconfigured build.
 *
 * So availability is a THREE-state now — probing, present, absent — and the
 * absent state prints a line where the button would have been. The reason it
 * gives is the true one for the environment it is in: in development the module
 * is missing from the runtime (Expo Go), and in a release build on an iPhone
 * the only way to reach this branch at all is a device that cannot offer it.
 * `probing` renders nothing rather than a placeholder — the native call answers
 * in a frame or two, and a note that flashes and vanishes is worse than a
 * moment of nothing.
 *
 * NOTHING ABOUT THE AUTH LOGIC MOVED. `lib/auth/sign-in.ts` is untouched; both
 * providers do exactly what they did.
 *
 * A fabricated `<Rating score={4.9} countLabel="loved by early lifters" />` sat
 * under the subline until 28 July. There are no real reviews (§12.1), so it was
 * deleted here for the same reason it was deleted from the paywall and the
 * onboarding ready screen — PLAN A1 named only those two, and this third call
 * site was found by its own acceptance grep. The space is not refilled.
 */
export default function SignIn() {
  const router = useRouter();
  /**
   * WHERE TO GO ONCE THE SESSION LANDS, and only the paywall's DEV·SKIP sets it.
   *
   * This screen sits behind `guard={session === null}` (`app/_layout.tsx`), so
   * signing in removes it and reveals whatever pushed it. That is deliberate
   * for the paywall's CTA — the paywall is still mounted underneath and its
   * `pendingPurchase` effect resumes the purchase on exactly that return. It is
   * wrong for every other entrance, which has nothing to resume and would just
   * put the user back on the screen they came from.
   *
   * So the caller says. Absent the parameter, the old behaviour is unchanged.
   */
  const { next } = useLocalSearchParams<{ next?: string }>();
  const name = getName();
  /**
   * `probing` until the native call answers; `absent` is a REPORTED state, not
   * an empty slot. Anything that is not iOS starts at `absent` and stays there:
   * Sign in with Apple does not exist off the platform, which is a fact about
   * the platform rather than a fault to explain, so the note below is iOS-only.
   */
  const [apple, setApple] = useState<'probing' | 'present' | 'absent'>(
    Platform.OS === 'ios' ? 'probing' : 'absent',
  );
  const [busy, setBusy] = useState<null | 'apple' | 'google' | 'dev'>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => setApple(ok ? 'present' : 'absent'))
      .catch((err) => {
        // A rejected probe is still an answer, and swallowing it whole is how
        // this went unexplained for as long as it did.
        devLog('apple availability probe failed:', err instanceof Error ? err.message : err);
        setApple('absent');
      });
  }, []);

  const run = async (which: 'apple' | 'google' | 'dev', fn: () => Promise<void>) => {
    if (busy) return;
    setError(null);
    setBusy(which);
    try {
      await fn();
      // Hand the decision back to the dispatcher, which is the only thing that
      // can see onboarding, session and entitlement at once. `dismissAll`
      // first, or the funnel it walked through stays underneath and a back
      // swipe from Today lands on the paywall.
      //
      // The development door always goes home: it has no purchase to resume,
      // and getting past this screen is the entire reason it was pressed.
      if (next === 'home' || which === 'dev') {
        if (router.canDismiss()) router.dismissAll();
        router.replace('/');
      }
    } catch (err) {
      if (!(err instanceof SignInCancelledError)) {
        const detail = err instanceof Error ? err.message : String(err);
        devLog('sign-in error:', detail);
        // One sentence for the athlete, the provider's own words for whoever is
        // building it. A redirect the Supabase project has not allow-listed and
        // a missing native module both used to read as the same four words.
        setError(__DEV__ ? `Sign-in failed. ${detail}` : 'Sign-in failed. Try again.');
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <FadeSlideIn>
        <Text style={styles.wordmark} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Recore
        </Text>
      </FadeSlideIn>

      <View style={styles.hero}>
        <Stagger initialDelay={120} step={80} distance={14}>
          <Eyebrow tone="secondary">Last step</Eyebrow>
          <Text style={styles.headline} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {name ? `Save your ledger,\n${name}.` : 'Save your ledger\nfor good.'}
          </Text>
          <Text style={styles.sub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Create your free account to start the trial and back up everything you just set up. It
            syncs to every iPhone — no passwords, no charge today.
          </Text>
        </Stagger>
      </View>

      <View style={styles.bottom}>
        <View style={styles.buttons}>
          {apple === 'present' ? (
            <ProviderButton
              provider="apple"
              label="Sign in with Apple"
              onPress={() => void run('apple', signInWithApple)}
              disabled={busy !== null}
              loading={busy === 'apple'}
            />
          ) : null}

          {/* Where the button would be, once the probe has actually answered.
              `absentNote` returns null for the one case that needs no
              explanation — see the header. */}
          {apple === 'absent' && absentNote() ? (
            <Text style={styles.unavailable} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {absentNote()}
            </Text>
          ) : null}

          <ProviderButton
            provider="google"
            label="Continue with Google"
            onPress={() => void run('google', signInWithGoogle)}
            disabled={busy !== null}
            loading={busy === 'google'}
          />
        </View>

        {/* The promise has to match the buttons. It named Face ID and a hidden
            email while the Apple button was nowhere on the screen. */}
        <Text style={styles.caption} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {apple === 'present'
            ? 'No passwords. Apple uses Face ID; Google opens in your browser. You can hide your email with Apple.'
            : 'No passwords. Google opens in your browser.'}
        </Text>

        {error ? (
          <Text style={styles.error} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {error}
          </Text>
        ) : null}

        {/* THE DEVELOPMENT DOOR. `__DEV__` is a compile-time constant, so this
            whole branch is deleted from a release bundle — see
            `lib/auth/dev-sign-in.ts` for why it signs in FOR REAL rather than
            pretending, and what the three `SIMPASS` markers cost when they
            pretended. Under a rule and labelled, because a door nobody can see
            is how those survived. */}
        {__DEV__ ? (
          <View style={styles.devBlock}>
            <View style={styles.devRule} />
            <PressableScale
              onPress={() => void run('dev', signInAsDeveloper)}
              activeScale={0.98}
              disabled={busy !== null}
              accessibilityRole="button"
              accessibilityLabel="Sign in as the development account"
              style={styles.devRow}>
              <Text style={styles.devLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {busy === 'dev' ? 'Signing in…' : 'Development sign-in'}
              </Text>
            </PressableScale>
            <Text style={styles.devNote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              A real session on the dev account. Not in release builds.
            </Text>
          </View>
        ) : null}

        {!isSupabaseConfigured() ? (
          <Text style={styles.configHint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Supabase is not configured. Copy .env.example to .env and fill in
            EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

/**
 * WHY THERE IS NO APPLE BUTTON, in the words that are true here.
 *
 * The probe reports one fact and one only: the native module did not answer.
 * It cannot say WHY, so neither does this — "missing from this runtime" is
 * what was measured, and "a development build carries it" is the action that
 * follows from it whatever the cause. Naming a specific client would be a
 * guess printed as a diagnosis.
 *
 * Off iOS there is nothing to explain to a user — Sign in with Apple is an
 * Apple-platform API and its absence on Android is not a fault — so the note
 * is developer-only there, and `null` in a release build keeps it off a screen
 * where it would be noise.
 */
function absentNote(): string | null {
  if (Platform.OS !== 'ios') return __DEV__ ? 'Sign in with Apple is iOS only.' : null;
  return __DEV__
    ? 'Sign in with Apple is missing from this runtime — a development build carries it.'
    : 'Sign in with Apple is not available on this device.';
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // The canvas — this was the last full-screen `surface` in the app, and a
    // white page beside a cream one is the seam v6 exists to remove.
    backgroundColor: color.canvas,
    paddingHorizontal: spacing.xxl,
  },
  wordmark: {
    fontSize: type.headline.fontSize,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: color.textPrimary,
    marginTop: spacing.md,
    // A minimum, not a height: at a large text setting a fixed box crops the
    // word inside it.
    minHeight: moderateScale(44),
    textAlignVertical: 'center',
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  headline: {
    ...type.display,
    color: color.textPrimary,
  },
  sub: {
    ...type.body,
    color: color.textSecondary,
  },
  bottom: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  buttons: {
    gap: spacing.md,
  },
  caption: {
    ...type.footnote,
    color: color.textMuted,
    marginTop: spacing.xs,
  },
  /** Sits inside `buttons`, in the gap the Apple button would have filled. It
   * CARRIES INFORMATION — why a control the user expected is not here — so it
   * is secondary ink rather than muted, which the skill reserves for what the
   * eye may skip. Centred, because it stands in for a full-width control. */
  unavailable: {
    ...type.footnote,
    color: color.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  error: {
    ...type.caption,
    color: color.error,
  },
  /** Development only, and it looks it: below everything, behind a rule, in
   * muted ink. It is a tool, not a third way to sign in. */
  devBlock: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  devRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.border,
    marginBottom: spacing.sm,
  },
  devRow: {
    minHeight: moderateScale(44),
    justifyContent: 'center',
  },
  devLabel: {
    ...type.footnote,
    fontWeight: '600',
    color: color.textSecondary,
  },
  devNote: {
    ...type.caption,
    color: color.textMuted,
  },
  configHint: {
    ...type.caption,
    color: color.textMuted,
    textAlign: 'center',
  },
});
