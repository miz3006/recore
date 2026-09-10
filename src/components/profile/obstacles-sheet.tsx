import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { OptionRow } from '@/components/onboarding-v2/OptionRow';
import { AppButton } from '@/components/primitives';
import {
  getObstacles,
  MAX_OBSTACLES,
  obstacleOptions,
  obstaclesHeadline,
  obstaclesSubline,
  setObstacles,
} from '@/lib/profile-answers';
import { color, MAX_FONT_SCALE, spacing, type } from '@/lib/theme';

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
  // NO `borderRadius` HERE — the sheet owns its corner (9 September 2026).
  //
  // These five were the only sheets in the app that set one, and setting it was
  // silently cancelling `bottom-sheet.tsx`'s concentric corner: on an iPhone 17
  // Pro every other sheet draws 54 (the display's 62 less the 8 pt the card
  // floats inside it) and these drew 24, which is why the You sheets read as a
  // different, tighter card than the rest of the app.
  sheet: {
    backgroundColor: color.surface,
    // THE FOOT IS EXACTLY WHAT THE INDICATOR OWES, AND NOTHING MORE.
    //
    // `bottom-sheet.tsx` already adds `insets.bottom − 8` inside the card (the
    // card floats 8 pt off the screen edge, so those two come to the 34 the
    // indicator actually needs). This used to add 16 on top of that, which put
    // the last option 50 pt above the floor — and against a 54 pt corner that
    // reads as a void at the bottom of the card rather than as breathing room.
    // At `spacing.sm` the sum is exactly `insets.bottom`, and the content sits
    // 34 pt off the floor against 36 pt below the grabber: the card is even at
    // both ends, which is what it never was.
    paddingBottom: spacing.sm,
    // ONE CAP FOR ALL FIVE (9 September 2026). Three said 82% and two said
    // 88%, and nothing anywhere said why — the sheets are the same object
    // asking different questions. 88 is the pair that already needed the room;
    // it is a CEILING, so the short sheets are unchanged by taking it.
    maxHeight: '88%',
  },
  content: {
    paddingHorizontal: spacing.xl,
    // THE QUESTION CLEARS THE CORNER (9 September 2026). The card's corner is
    // concentric with the display now — 54 pt on an iPhone 17 Pro, not the 24
    // these sheets used to draw — and against a curve that size a headline
    // 12 pt under the grabber reads as jammed into the top of the card. The
    // bottom already pays 42 (16 of its own plus the 26 the indicator owes),
    // so the head was the asymmetric end, not the foot.
    paddingTop: spacing.xl,
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
