import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  signInWithApple,
  signInWithGoogle,
  SignInCancelledError,
} from '@/lib/auth/sign-in';
import { isSupabaseConfigured } from '@/lib/env';
import { tapMedium } from '@/lib/haptics';
import { devLog } from '@/lib/log';
import { Icon } from '@/components/icon';
import { SignInDemo } from '@/components/sign-in-demo';
import {
  alpha,
  color,
  CONTROL_HEIGHT,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  type,
} from '@/lib/theme';

/**
 * Sign in (task §4): Apple and Google only — no email/password. Quiet,
 * monochrome, no marketing copy. Auth will eventually sit AFTER the 13-screen
 * onboarding + paywall; those are stub routes for now, so this screen is the
 * app's front door.
 */
export default function SignIn() {
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
    tapMedium();
    setError(null);
    setBusy(which);
    try {
      await fn(); // on success the session guard swaps this screen for home
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
      <View style={styles.brand}>
        <Text style={styles.wordmark} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Recore
        </Text>
        <Text style={styles.tagline} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          The workout log you write in.
        </Text>

        {/* The product IS the pitch: the note writes itself, the gutter answers. */}
        <View style={styles.demo}>
          <SignInDemo />
        </View>
      </View>

      <View style={styles.actions}>
        {appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={radius.pill}
            style={styles.appleButton}
            onPress={() => void run('apple', signInWithApple)}
          />
        ) : null}

        <Pressable
          disabled={busy !== null}
          onPress={() => void run('google', signInWithGoogle)}
          style={({ pressed }) => [styles.googleButton, pressed && styles.googlePressed]}>
          <Icon name="google" size={moderateScale(18)} tint={color.textPrimary} />
          <Text style={styles.googleLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Continue with Google
          </Text>
        </Pressable>

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
    justifyContent: 'space-between',
  },
  brand: {
    flex: 1,
    justifyContent: 'center',
  },
  wordmark: {
    ...type.largeTitle,
    color: color.textPrimary,
    letterSpacing: 0.5,
  },
  tagline: {
    ...type.subhead,
    color: color.textSecondary,
    marginTop: spacing.sm,
  },
  demo: {
    marginTop: spacing.huge,
  },
  actions: {
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  appleButton: {
    height: CONTROL_HEIGHT,
  },
  googleButton: {
    height: CONTROL_HEIGHT,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(color.accent, 0.3),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  googlePressed: {
    backgroundColor: color.surfaceHigh,
  },
  googleLabel: {
    color: color.textPrimary,
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
  },
  error: {
    ...type.caption,
    color: color.error, // warnings only (CLAUDE.md §5)
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  configHint: {
    ...type.caption,
    color: color.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
