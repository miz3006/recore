import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomToolbar } from '@/components/bottom-toolbar';
import { FixSheet } from '@/components/fix-sheet';
import { InsightHeader } from '@/components/insight-header';
import { NoteSurface } from '@/components/note-surface';
import { PlanStrip } from '@/components/plan-strip';
import { SummaryPill } from '@/components/summary-pill';
import { TopBar } from '@/components/top-bar';
import { color, spacing, TAB_BAR_CLEARANCE } from '@/lib/theme';

/**
 * Today — the default tab and 85% of the time spent in Recore (CLAUDE.md §5.1).
 *
 * "Recore Light" frames 01–03: a warm paper canvas — the nav row (wordmark ·
 * day pill · settings), a blank page you write your workout into, and a bottom
 * that swaps with focus (accessory bar while composing, a quiet summary pill at
 * rest).
 *
 * This used to be `app/index.tsx`, which was Home *and* the funnel dispatcher.
 * The dispatcher stayed behind at `/`; everything below is unchanged except for
 * the tab bar's clearance at the bottom.
 */
export default function Today() {
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

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

  // With the keyboard up the accessory bar rides on top of it and the tab bar
  // is behind the keyboard — the composer owns the screen (§5.2). At rest the
  // pill has to clear the floating bar, which no inset reports (see the token).
  const bottomInset = keyboardOpen
    ? spacing.sm
    : Math.max(insets.bottom, spacing.md) + TAB_BAR_CLEARANCE;

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

      {/* The Lift detail sheet is app-wide (`_layout.tsx`) — Lifts opens the
          same one, and two mounted copies would stack two modals. FixSheet is
          the composer's own, so it stays here. */}
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
