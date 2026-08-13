import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { FadeSlideIn, Stagger } from '@/components/motion';
import { AppButton, Eyebrow } from '@/components/primitives';
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
 * wired today: Apple (primary ink-fill) and Google (bordered secondary). Auth
 * logic (PKCE, busy/error states) is unchanged.
 *
 * A fabricated `<Rating score={4.9} countLabel="loved by early lifters" />` sat
 * under the subline until 28 July. There are no real reviews (§12.1), so it was
 * deleted here for the same reason it was deleted from the paywall and the
 * onboarding ready screen — PLAN A1 named only those two, and this third call
 * site was found by its own acceptance grep. The space is not refilled.
 */
export default function SignIn() {
  const name = getName();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<null | 'apple' | 'google'>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
    }
  }, []);

  const run = async (which: 'apple' | 'google', fn: () => Promise<void>) => {
    if (busy) return;
    setError(null);
    setBusy(which);
    try {
      await fn(); // on success the session guard swaps this screen for onboarding
    } catch (err) {
      if (!(err instanceof SignInCancelledError)) {
        devLog('sign-in error:', err instanceof Error ? err.message : err);
        setError('Sign-in failed. Try again.');
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
          {appleAvailable ? (
            <AppButton
              label="Sign in with Apple"
              onPress={() => void run('apple', signInWithApple)}
              disabled={busy !== null}
              loading={busy === 'apple'}
              leading={<Icon name="apple" size={moderateScale(18)} tint={color.bg} />}
            />
          ) : null}

          <AppButton
            label="Continue with Google"
            variant="secondary"
            onPress={() => void run('google', signInWithGoogle)}
            disabled={busy !== null}
            loading={busy === 'google'}
            leading={<Icon name="google" size={moderateScale(16)} tint={color.textPrimary} />}
          />
        </View>

        <Text style={styles.caption} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          No passwords. Apple uses Face ID; Google opens in your browser. You can hide your email
          with Apple.
        </Text>

        {error ? (
          <Text style={styles.error} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {error}
          </Text>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
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
  error: {
    ...type.caption,
    color: color.error,
  },
  configHint: {
    ...type.caption,
    color: color.textMuted,
    textAlign: 'center',
  },
});
