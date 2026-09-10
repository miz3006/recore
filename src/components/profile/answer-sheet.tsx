import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { GhostRow } from '@/components/onboarding-v2/GhostRow';
import { OptionRow } from '@/components/onboarding-v2/OptionRow';
import {
  getAnswer,
  headlineFor,
  optionsFor,
  setAnswer,
  sublineFor,
  type AnswerId,
} from '@/lib/profile-answers';
import { color, MAX_FONT_SCALE, spacing, type } from '@/lib/theme';

/**
 * THE SAME PICKER THE ONBOARDING USED, reached from a Profile row.
 *
 * It renders `flow.ts`'s own options through `OptionRow` and `GhostRow` — the
 * literal components the flow draws — so a person changing their split six weeks
 * later sees the screen they answered it on, with the same wording, the same
 * order, the same opt-out demotion and the same selection spring. Rebuilding a
 * settings-flavoured copy would have been less code to import and would have
 * drifted from the flow within a release.
 *
 * ## The isolation rule this crosses, deliberately
 *
 * `docs/onboarding-v2-spec.md` §0 and `onboarding-v2/tokens.ts` both say nothing
 * outside v2 may read v2's components, so that deleting either onboarding
 * directory leaves the other standing. This file reads two of them, because
 * "opens the same picker the onboarding used" is the requirement and forking the
 * row would defeat it. **What is owed:** `OptionRow` and `GhostRow` are no
 * longer onboarding components — they are the app's choice-row vocabulary, and
 * they should be promoted out of `onboarding-v2/` to a shared home. That is a
 * mechanical move across ~22 call sites and is deliberately not bundled into a
 * Profile rebuild.
 *
 * ## Tapping an option closes the sheet
 *
 * The flow itself does NOT advance on the tap — `QuestionScreen` explains why:
 * the Continue button waking up is the reward for answering, and auto-advancing
 * throws that away. A settings picker is the opposite object. There is no reward
 * to stage and no next screen; the person came to change one value, and every
 * iOS picker sheet in existence closes when they do. The close is delayed by one
 * beat so the selection spring is actually seen landing on the row that was
 * touched, rather than the sheet leaving mid-animation.
 */

/** Long enough for the row's fill to arrive, short enough not to read as a wait. */
const CLOSE_DELAY = 200;

export function AnswerSheet({
  id,
  visible,
  onClose,
  onChange,
}: {
  /** Null while nothing is being edited — the sheet stays mounted and closed. */
  id: AnswerId | null;
  onClose: () => void;
  visible: boolean;
  /** The row above needs to re-read its label. */
  onChange: () => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-read on open, never on mount: the answer can have changed from another
  // surface between two openings of the same sheet.
  useEffect(() => {
    if (visible && id) setChosen(getAnswer(id));
  }, [id, visible]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!id) return null;

  const options = optionsFor(id);
  const listed = options.filter((o) => !o.optOut);
  const optOuts = options.filter((o) => o.optOut);
  const subline = sublineFor(id);

  const pick = (value: string) => {
    setAnswer(id, value);
    setChosen(value);
    onChange();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(onClose, CLOSE_DELAY);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetStyle={styles.sheet}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <Text style={styles.headline} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {headlineFor(id)}
        </Text>
        {subline ? (
          <Text style={styles.subline} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {subline}
          </Text>
        ) : null}

        <View style={styles.options}>
          {listed.map((option) => (
            <OptionRow
              key={option.id}
              label={option.label}
              icon={option.icon}
              sub={option.sub}
              selected={chosen === option.id}
              onPress={() => pick(option.id)}
            />
          ))}
          {optOuts.map((option) => (
            <GhostRow
              key={option.id}
              label={option.label}
              sub={option.sub}
              selected={chosen === option.id}
              onPress={() => pick(option.id)}
            />
          ))}
        </View>
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
});
