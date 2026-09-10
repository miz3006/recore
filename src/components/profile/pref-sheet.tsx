import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { OptionRow } from '@/components/onboarding-v2/OptionRow';
import {
  getBarWeightKg,
  getObLanguage,
  getRestSeconds,
  getWeightUnit,
  REST_OPTIONS_S,
  setBarWeightKg,
  setObLanguage,
  setRestSeconds,
  setWeightUnit,
  type ObLanguage,
  type WeightUnit,
} from '@/lib/prefs';
import { color, MAX_FONT_SCALE, spacing, type } from '@/lib/theme';
import { useDisplay } from '@/state/display';

/**
 * THE SETTINGS THE FLOW DOES NOT ASK, EDITED THE WAY THE ONES IT DOES ARE
 * (28 August 2026).
 *
 * Profile had two ways to change a value. The onboarding answers opened
 * `AnswerSheet` — the flow's own picker, full width, one tap. Everything else
 * expanded INLINE into a segmented control: a different control, a different
 * gesture, a different size of tap target, on the same list of rows. Two
 * vocabularies on one screen is a thing a person has to learn twice, and the
 * inline one was the weaker of the two — a four-way segmented control sets its
 * width by its longest label, so "Slovenščina" squeezed the other two.
 *
 * So every editable value on Profile now opens a sheet, and this is the sheet
 * for the ones that are NOT onboarding answers: units, the rest timer, the bar,
 * the writing language, and how a set is printed. They are single-choice, they
 * write through on the tap, and they close a beat later — the same contract
 * `AnswerSheet` keeps, so the two are indistinguishable in use.
 *
 * ## Why these and not the flow's questions
 *
 * The v2 flow asks about the person (tracker, obstacles, goal, experience,
 * sessions, split, lifts).
 * It never asks about units, rest length, the bar or the writing language: it
 * writes and shows kilograms, `commitV2Onboarding` takes the language from the
 * locale, and `flow.ts` states a 20 kg Olympic bar as an assumption rather than
 * a question. **They are still real settings with live readers** —
 * `bottom-toolbar` starts the timer from the rest pref, `ghost-prediction`
 * racks a prediction with the bar, `brief-explain` and `empty-note-cards` read
 * the language, `fix-sheet` reads the unit — so they belong on this screen even
 * though no screen of the flow produced them. What they do NOT belong in is
 * "About you", which is the flow's own answers and nothing else.
 *
 * ## One table, one component
 *
 * Each entry owns its own copy, its options and its two accessors, so the row
 * label on Profile (`prefLabel`) and the picker can never print different
 * things for the same stored value. Adding a sixth setting is an entry here and
 * a `Row` there.
 */

export type PrefId = 'unit' | 'rest' | 'bar' | 'language' | 'setreadings';

/** Long enough for the row's fill to arrive, short enough not to read as a
 * wait — the same beat `AnswerSheet` uses, and for the same reason. */
const CLOSE_DELAY = 200;

interface PrefDef {
  title: string;
  subline: string;
  /** Ids are strings at this boundary; each entry converts in `set`. */
  options: readonly { id: string; label: string; sub?: string }[];
  /** The stored value, as an option id. Never null — every one of these has a
   * real default, and a settings row that says "Not set" for a value the app is
   * actively using would be false. */
  get: () => string;
  set: (id: string) => void;
}

/** `1:30`, the way the timer chip on Today already prints it. */
function restLabel(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const PREFS: Readonly<Record<PrefId, PrefDef>> = {
  unit: {
    title: 'Units',
    subline: 'What Recore reads a bare number as, and what it prints back.',
    options: [
      { id: 'kg', label: 'Kilograms', sub: 'kg' },
      { id: 'lb', label: 'Pounds', sub: 'lb' },
    ],
    get: () => getWeightUnit() ?? 'kg',
    set: (id) => setWeightUnit(id as WeightUnit),
  },
  rest: {
    title: 'Rest timer',
    subline: 'How long the timer runs when you start it after a set.',
    options: REST_OPTIONS_S.map((s) => ({ id: String(s), label: restLabel(s) })),
    get: () => String(getRestSeconds()),
    set: (id) => setRestSeconds(Number(id)),
  },
  bar: {
    title: 'Bar weight',
    subline: 'What an empty bar in your gym weighs. Every suggested load is racked with it.',
    options: [
      { id: '20', label: '20 kg', sub: 'The Olympic bar' },
      { id: '15', label: '15 kg', sub: 'The common lighter bar' },
    ],
    get: () => String(getBarWeightKg()),
    set: (id) => setBarWeightKg(Number(id)),
  },
  language: {
    title: 'Writing language',
    subline: 'What Recore expects to find in your notes. It never changes what you wrote.',
    options: [
      { id: 'en', label: 'English' },
      { id: 'slo', label: 'Slovenščina' },
      { id: 'both', label: 'Both' },
    ],
    get: () => getObLanguage() ?? 'en',
    set: (id) => setObLanguage(id as ObLanguage),
  },
  setreadings: {
    title: 'Set readings',
    subline:
      'Recore already follows your iPhone’s text size. This makes the sets larger on their own.',
    options: [
      { id: 'standard', label: 'Standard', sub: 'Aligned columns' },
      { id: 'large', label: 'Larger', sub: 'One spelled-out line per set' },
    ],
    // The live store, not the pref: the ledger behind this sheet has to change
    // on the tap, and the store writes the pref on its way through.
    get: () => (useDisplay.getState().largeSetReadings ? 'large' : 'standard'),
    set: (id) => useDisplay.getState().setLargeSetReadings(id === 'large'),
  },
};

/** What the Profile row prints on the right. One source with the picker, so a
 * row and the sheet it opens cannot disagree. */
export function prefLabel(id: PrefId): string {
  const def = PREFS[id];
  const current = def.get();
  return def.options.find((o) => o.id === current)?.label ?? current;
}

export function PrefSheet({
  id,
  visible,
  onClose,
  onChange,
}: {
  /** Null while nothing is being edited — the sheet stays mounted and closed. */
  id: PrefId | null;
  visible: boolean;
  onClose: () => void;
  /** The row above needs to re-read its label. */
  onChange: () => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-read on open, never on mount: the rest length in particular can have
  // been changed from the timer chip on Today between two openings.
  useEffect(() => {
    if (visible && id) setChosen(PREFS[id].get());
  }, [id, visible]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!id) return null;
  const def = PREFS[id];

  const pick = (value: string) => {
    def.set(value);
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
        <Text
          style={styles.headline}
          accessibilityRole="header"
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {def.title}
        </Text>
        <Text style={styles.subline} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {def.subline}
        </Text>

        <View style={styles.options}>
          {def.options.map((option) => (
            <OptionRow
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
