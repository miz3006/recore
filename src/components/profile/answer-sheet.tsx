import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { GhostRow } from '@/components/onboarding-v2/GhostRow';
import { OptionRow } from '@/components/onboarding-v2/OptionRow';
import { SheetGrabber } from '@/components/sheet-grabber';
import {
  getAnswer,
  headlineFor,
  optionsFor,
  setAnswer,
  sublineFor,
  type AnswerId,
} from '@/lib/profile-answers';
import { color, MAX_FONT_SCALE, radius, spacing, type } from '@/lib/theme';

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
      <SheetGrabber />
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
});
