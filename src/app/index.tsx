import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomToolbar } from '@/components/bottom-toolbar';
import { ExerciseSheet } from '@/components/exercise-sheet';
import { FixSheet } from '@/components/fix-sheet';
import { NoteSurface } from '@/components/note-surface';
import { TopBar } from '@/components/top-bar';
import { isOnboardingDone } from '@/lib/prefs';
import { color, spacing } from '@/lib/theme';

/**
 * Home — the note surface (CLAUDE.md §8). A quiet near-black canvas: top bar,
 * a blank page you write your workout into, and a bottom toolbar that rides
 * above the keyboard. First run goes through onboarding (§10) exactly once.
 */
export default function Home() {
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [onboarded] = useState(() => isOnboardingDone());

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

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']}>
        <TopBar />
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <NoteSurface />
        <BottomToolbar bottomInset={bottomInset} />
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
});
