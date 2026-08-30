import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Enter } from '@/lib/motion/index';
import { MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';
import { useV2 } from '@/state/onboarding-v2';

import { Check } from '../Check';
import { ContinueButton } from '../ContinueButton';
import { v2color, v2metrics } from '../tokens';

/**
 * THE END OF A DEVELOPMENT RUN, and of nothing else (28 August 2026).
 *
 * This is NOT screen 19. The screen list is fixed at eighteen and this is not
 * one of them — it is the sandbox's own exit. **A real run never reaches it:**
 * since v2 became the primary onboarding, screen 20's Continue commits and goes
 * straight to the dispatcher, which is where the paywall and sign-in have
 * always been. A screen between the last answer and the offer is a tap that
 * sells nothing.
 *
 * It states plainly that nothing was saved, because a flow that just spent
 * three minutes collecting answers and then discards them owes the person that
 * sentence.
 */
export function DoneScreen({ onExit }: { onExit: () => void }) {
  const insets = useSafeAreaInsets();
  const answers = useV2((s) => s.answers);

  return (
    <View
      style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.md }]}
      testID="v2-screen-done">
      <View style={styles.body}>
        <Enter index={0} from={0}>
          <View style={styles.disc}>
            <Check size={moderateScale(34)} color={v2color.onBlue} strokeWidth={3} />
          </View>
        </Enter>
        <Enter index={1}>
          <Text style={styles.headline} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            End of the sandbox run.
          </Text>
        </Enter>
        <Enter index={2}>
          <Text style={styles.body2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {answers.name ? `${answers.name}, this ` : 'This '}is where the real run goes to the
            paywall and then to sign-in. This screen opens neither.
          </Text>
        </Enter>
        <Enter index={3}>
          <Text style={styles.note} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Nothing here was saved. Your account, name, split and key lifts are untouched.
          </Text>
        </Enter>
      </View>

      <View style={styles.footer}>
        <ContinueButton label="Back to the app" enabled onPress={onExit} />
      </View>
    </View>
  );
}

const DISC = moderateScale(64);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: v2color.canvas, paddingHorizontal: v2metrics.gutter },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: v2color.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  headline: {
    ...type.largeTitle,
    fontWeight: '800',
    color: v2color.ink,
    textAlign: 'center',
  },
  body2: { ...type.body, color: v2color.inkSecondary, textAlign: 'center' },
  note: { ...type.subhead, color: v2color.inkMuted, textAlign: 'center' },
  footer: { paddingTop: spacing.md },
});
