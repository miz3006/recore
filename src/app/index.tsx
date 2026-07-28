import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomToolbar } from '@/components/bottom-toolbar';
import { ExerciseSheet } from '@/components/exercise-sheet';
import { FixSheet } from '@/components/fix-sheet';
import { InsightHeader } from '@/components/insight-header';
import { NoteSurface } from '@/components/note-surface';
import { PlanStrip } from '@/components/plan-strip';
import { SummaryPill } from '@/components/summary-pill';
import { TopBar } from '@/components/top-bar';
import { useDevBypass } from '@/lib/auth/dev-bypass';
import { useAuth } from '@/lib/auth/provider';
import { isOnboardingDone } from '@/lib/prefs';
import { color, spacing } from '@/lib/theme';

/**
 * `/` is the funnel DISPATCHER as well as Home. Because the account is deferred
 * to the end of the funnel (see `_layout.tsx`), this route is reachable
 * signed-out — so it routes:
 *   · no session, onboarding not done → /onboarding (start the funnel)
 *   · no session, onboarding done     → /paywall (finish the funnel — sign-in
 *                                        is the paywall's forward step)
 *   · session, onboarding not done    → /onboarding (returning acct, fresh
 *                                        device; the flow can be skipped fast)
 *   · session + onboarding done       → Home, the note surface.
 *
 * Home ("Recore Light" frames 01–03): a warm paper canvas — the nav row
 * (wordmark · day pill · settings), a blank page you write your workout into,
 * and a bottom that swaps with focus (accessory bar while composing, a quiet
 * summary pill at rest).
 */
export default function Home() {
  const { session } = useAuth();
  const bypassed = useDevBypass();
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  // Read fresh each render (cheap sync KV) — memoizing would strand the
  // dispatcher on a stale value after onboarding completes or sign-in lands.
  const onboarded = isOnboardingDone();

  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(show, () => setKeyboardOpen(true));
    const h = Keyboard.addListener(hide, () => setKeyboardOpen(false));
    return () => {
      s.remove();
      h.remove();
    };
  }, []);

  const bottomInset = keyboardOpen ? spacing.sm : Math.max(insets.bottom, spacing.md);

  if (!onboarded) return <Redirect href="/onboarding" />;
  // Onboarding is done but there's still no account → the paywall is the gate,
  // and sign-in is its forward step. The app itself needs a Supabase user —
  // except under the dev bypass, which runs on a fixed local id (dev-bypass.ts).
  if (!session && !bypassed) return <Redirect href="/paywall" />;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']}>
        <TopBar />
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* The landmark recedes while typing — mid-workout the note owns the
            screen (CLAUDE.md §8). */}
        <InsightHeader hidden={keyboardOpen} />
        <PlanStrip />
        <NoteSurface />
        {/* The bottom swaps with focus: accessory bar while composing (frame
            03), a settled summary pill at rest (frames 01/02). The toolbar
            stays MOUNTED (just hidden) at rest so a running rest timer keeps
            counting instead of resetting when the keyboard closes. */}
        <View style={keyboardOpen ? undefined : styles.hidden}>
          <BottomToolbar bottomInset={bottomInset} />
        </View>
        {keyboardOpen ? null : <SummaryPill bottomInset={bottomInset} />}
      </KeyboardAvoidingView>

      <ExerciseSheet />
      <FixSheet />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  flex: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
});
