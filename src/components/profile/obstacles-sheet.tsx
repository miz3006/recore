import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { OptionRow } from '@/components/onboarding-v2/OptionRow';
import { AppButton } from '@/components/primitives';
import { SheetGrabber } from '@/components/sheet-grabber';
import {
  getObstacles,
  MAX_OBSTACLES,
  obstacleOptions,
  obstaclesHeadline,
  obstaclesSubline,
  setObstacles,
} from '@/lib/profile-answers';
import { color, MAX_FONT_SCALE, radius, spacing, type } from '@/lib/theme';

/**
 * "WHAT GETS IN THE WAY?", AFTER ONBOARDING — the flow's screen 3, as a sheet.
 *
 * It is the second "About you" answer that is not a single choice, so it follows
 * `LiftsSheet` rather than `AnswerSheet`: a person is mid-edit until they say
 * otherwise, and the sheet closes on Done rather than on the tap. Everything
 * else is the flow's own — `OptionRow` in multi mode, the screen's headline and
 * subline read from `flow.ts`, and its own cap.
 *
 * ## Why this answer is editable at all
 *
 * It is not a survey question. It decides which value proposition leads on the
 * reveal and on the paywall, and the paywall is reachable from the subscription
 * row on this very screen. An answer that steers what a person is shown, six
 * months after they gave it, has to be changeable — the frustration that brought
 * somebody to Recore is rarely the one they still have.
 *
 * ## Oldest out at the cap
 *
 * The flow's own rule (`state/onboarding-v2.ts`): at two picked, a third tap
 * drops the first rather than doing nothing. A tap that lands nowhere reads as
 * a broken control, and the screen this replaces never had one.
 *
 * ## Writes land immediately
 *
 * No draft, no Cancel — the same write-through contract as every other settings
 * sheet in the app. Done only dismisses.
 */
export function ObstaclesSheet({
  visible,
  onClose,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  /** The row above needs to re-read its label. */
  onChange: () => void;
}) {
  const [chosen, setChosen] = useState<string[]>([]);

  // Re-read on every open: the answer can have changed from another surface
  // between two openings of the same sheet.
  useEffect(() => {
    if (visible) setChosen(getObstacles());
  }, [visible]);

  const toggle = (id: string) => {
    const next = chosen.includes(id)
      ? chosen.filter((v) => v !== id)
      : [...chosen, id].slice(-MAX_OBSTACLES);
    setChosen(next);
    setObstacles(next);
    onChange();
  };

  const subline = obstaclesSubline();

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetStyle={styles.sheet}>
      <SheetGrabber />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <Text
          style={styles.headline}
          accessibilityRole="header"
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {obstaclesHeadline()}
        </Text>
        {subline ? (
          <Text style={styles.subline} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {subline}
          </Text>
        ) : null}

        <View style={styles.options}>
          {obstacleOptions().map((option) => (
            <OptionRow
              key={option.id}
              label={option.label}
              icon={option.icon}
              sub={option.sub}
              selected={chosen.includes(option.id)}
              multi
              onPress={() => toggle(option.id)}
            />
          ))}
        </View>

        <AppButton label="Done" variant="secondary" compact onPress={onClose} style={styles.done} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    // The sheet owns the home-indicator gap already (`bottom-sheet.tsx`), so
    // this is plain padding and never `insets.bottom`.
    paddingBottom: spacing.lg,
    maxHeight: '82%',
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  headline: {
    ...type.title2,
    color: color.textPrimary,
  },
  subline: {
    ...type.subhead,
    color: color.textSecondary,
    marginTop: spacing.xs,
  },
  options: {
    marginTop: spacing.xl,
  },
  done: {
    marginTop: spacing.xl,
  },
});
