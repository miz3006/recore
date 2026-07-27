import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccessoryBar } from '@/components/accessory-bar';
import { Composer } from '@/components/composer';
import { ExerciseSheet } from '@/components/exercise-sheet';
import { FixSheet } from '@/components/fix-sheet';
import { SessionSummary } from '@/components/session-summary';
import { TodayHeader } from '@/components/today-header';
import { markFinishedOnce } from '@/lib/prefs';
import { makeStyles, spacing } from '@/lib/theme';
import { useSession } from '@/state/session-store';

/**
 * Today — the default tab and 85% of the time spent in Recore (CLAUDE.md §5.1,
 * §8.1, PLAN.md 1.15–1.20).
 *
 * Three parts and a summary: the header, the composer, the glass accessory bar
 * that rides above the keyboard, and — once Finish is pressed — the session
 * summary rising into place under the last card.
 *
 * The composition is deliberately thin. Everything that matters happens one
 * level down: this file decides *where* things are, and nothing about what they
 * say.
 */
/** iOS 26's floating tab bar, above the home indicator. See `bottomInset`. */
const TAB_BAR_CLEARANCE = 56;

export default function Today() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  const selectedDay = useSession((s) => s.selectedDay);

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

  // Changing day closes a summary that belonged to a different session.
  useEffect(() => setFinished(false), [selectedDay]);

  /**
   * Where the accessory bar sits.
   *
   * With the keyboard up it rides directly on top of it. With the keyboard down
   * it has to clear the **floating** tab bar, and that clearance has to be added
   * by hand: `SafeAreaProvider` lives at the app root, so `useSafeAreaInsets()`
   * reports the window's insets (the home indicator) rather than the tab
   * content view's — the bar UIKit floats over this screen is invisible to it.
   * Without this the whole strip renders underneath the tab bar and Finish
   * cannot be pressed at all.
   */
  const bottomInset = keyboardOpen
    ? spacing.sm
    : Math.max(insets.bottom, spacing.md) + TAB_BAR_CLEARANCE;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']}>
        <TodayHeader />
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Composer />

        {finished ? (
          <View style={styles.summary}>
            <SessionSummary onDone={() => setFinished(false)} />
          </View>
        ) : null}

        <AccessoryBar
          bottomInset={bottomInset}
          onFinish={() => {
            Keyboard.dismiss();
            markFinishedOnce();
            setFinished(true);
          }}
        />
      </KeyboardAvoidingView>

      <ExerciseSheet />
      <FixSheet />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: {
    flex: 1,
    backgroundColor: t.canvas,
  },
  flex: {
    flex: 1,
  },
  summary: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
}));
