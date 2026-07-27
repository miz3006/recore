import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { FadeSlideIn, Stagger } from '@/components/motion';
import { AppButton, Eyebrow, Rating } from '@/components/primitives';
import {
  signInWithApple,
  signInWithGoogle,
  SignInCancelledError,
} from '@/lib/auth/sign-in';
import { isSupabaseConfigured } from '@/lib/env';
import { devLog } from '@/lib/log';
import { getName } from '@/lib/prefs';
import { makeStyles, useTheme, MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';

/**
 * Sign in — now the LAST step of the funnel (2026-07-23 redesign), not the
 * front door. The user has personalized their ledger and picked a plan; this
 * screen turns that into a real account so the trial can start and the setup is
 * backed up. Framed as reward, never a toll gate. Providers are the real ones
 * wired today: Apple (primary ink-fill) and Google (bordered secondary). Auth
 * logic (PKCE, busy/error states) is unchanged.
 */
export default function SignIn() {
  const styles = useStyles();
  const t = useTheme();
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
          <View style={styles.ratingWrap}>
            <Rating score={4.9} countLabel="loved by early lifters" align="flex-start" />
          </View>
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
              leading={<Icon name="apple" size={moderateScale(18)} tint={t.canvas} />}
            />
          ) : null}

          <AppButton
            label="Continue with Google"
            variant="secondary"
            onPress={() => void run('google', signInWithGoogle)}
            disabled={busy !== null}
            loading={busy === 'google'}
            leading={<Icon name="google" size={moderateScale(16)} tint={t.ink} />}
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

const useStyles = makeStyles((t) => ({
  root: {
    flex: 1,
    backgroundColor: t.canvas,
    paddingHorizontal: spacing.xxl,
  },
  wordmark: {
    fontSize: type.title3.fontSize,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: t.ink,
    marginTop: spacing.md,
    height: moderateScale(44),
    textAlignVertical: 'center',
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  headline: {
    ...type.display,
    color: t.ink,
  },
  sub: {
    ...type.body,
    color: t.inkMuted,
  },
  ratingWrap: {
    marginTop: spacing.sm,
  },
  bottom: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  buttons: {
    gap: spacing.md,
  },
  caption: {
    ...type.caption,
    color: t.inkFaint,
    marginTop: spacing.xs,
  },
  error: {
    ...type.caption,
    color: t.danger,
  },
  configHint: {
    ...type.caption,
    color: t.inkFaint,
    textAlign: 'center',
  },
}));
