import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { DUR } from '@/lib/motion';
import {
  color,
  hairline,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  shadow,
  spacing,
  type,
} from '@/lib/theme';

import { PressableScale } from './motion';
import { Eyebrow } from './primitives';

/**
 * THE CHECK-IN, READ BACK ON TODAY (10 September 2026).
 *
 * `check-in-sheet.tsx` asks "How did it go?" and stores one string: a first
 * line of the chips the athlete armed, then their own words under it
 * (`lib/reflection.ts` — `composeReflection` / `splitReflection`). Until now
 * Today printed that string as two flat lines of `textSecondary`: the tag line
 * at 11.5 pt, the prose at 13 pt, no label, nothing to say which was which.
 * Three things were wrong with it and each is a rule this file already had:
 *
 *  · **The chips lost their shape.** In the sheet "Slept badly" is a pill you
 *    tap; on Today it was a fragment of a sentence with a middle dot in it. The
 *    same answer read as two different kinds of thing one screen apart, which
 *    is the drift `chip-row.tsx` was written to end.
 *  · **The words were dimmed.** §Colour: `textSecondary` and below is for what
 *    the eye may skip. The athlete's own sentence about the session is the one
 *    piece of prose on this page nobody else could have written — it is ink.
 *  · **Nothing named it.** A note under a ledger with no label is either a
 *    comment on the last lift or a comment on the day, and the reader cannot
 *    tell. An eyebrow costs one 11 pt line and settles it.
 *
 * ## The shape
 *
 * ```
 *  │  HOW IT WENT                     ← eyebrow, muted, the section's name
 *  │  Hard                            ← the session's own rating, as a word
 *  │  ⟨Slept badly⟩ ⟨Short on time⟩   ← the chips, as chips
 *  │  Legs felt heavy from the first   ← their words, in ink, at reading size
 *  │  set but the top single moved.
 * ```
 *
 * The RATING leads (10 September 2026), because the eyebrow asks how it went
 * and that one word is the answer — the chips and the prose are what else was
 * true. It is deliberately NOT a fourth chip: in the sheet it is answered on a
 * segmented control and the chips are answered as pills, and a shape that
 * changes between the screen that asks and the screen that reports is the
 * exact drift the chips above were reshaped to end. It is also a WORD and
 * never the stored number — the athlete answered "Hard"; an 8 printed on their
 * own day would be the app showing its filing system.
 *
 * The rule down the left is a **block quote**, in the record's own rail column
 * so it lines up under the check rings, and it is the reason this block needs
 * no card: it says "quoted from you" the way Apple Notes and Mail say it, with
 * one 2 pt line instead of a surface. §Structure is explicit that the record
 * has no cards — Today IS the record — so the alternative was a white card on
 * the one screen that may not have one.
 *
 * The chips are the app's chips (`chip-row.tsx`'s geometry, one step down in
 * height): white pill, hairline, `shadow.card`, ink label. Not `Badge` — that
 * one is the reading voice with tracking, built for `PR` and `×3`, and a
 * sentence fragment set in it reads as a data flag rather than as a word
 * somebody chose.
 *
 * Tapping anywhere re-opens the check-in, so the note is editable from the page
 * that prints it and there is still exactly one place the words are written.
 */
export function CheckInNote({
  rating,
  tags,
  text,
  railWidth,
  railGap,
  reduceMotion,
  onPress,
}: {
  /** How hard the whole session was, as the word the athlete picked
   * (`SESSION_EFFORT_LABEL`). Null when they did not answer. */
  rating: string | null;
  /** The armed chips, already in canonical order (`reflectionTagLine`'s order). */
  tags: readonly string[];
  /** The typed words, with the tag line already split off. May be empty. */
  text: string;
  /** The record's rail column — the quote rule centres in it, under the rings. */
  railWidth: number;
  /** Rail → text, so the block hangs off the same edge as every lift. */
  railGap: number;
  reduceMotion: boolean;
  onPress: () => void;
}) {
  if (rating === null && tags.length === 0 && text.length === 0) return null;

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(DUR.base)}>
      <PressableScale
        onPress={onPress}
        haptic="none"
        // A record row does not dip (see `note-surface.tsx`); the wash answers.
        activeScale={1}
        wash
        washStyle={styles.wash}
        accessibilityRole="button"
        /** One sentence, in the order the eye reads it: what it is, what was
         * chosen, what was written. VoiceOver gets the WHOLE note even when the
         * printed one is clamped. */
        accessibilityLabel={[
          'How it went',
          rating ? `${rating} overall` : '',
          tags.join(', '),
          text,
        ]
          .filter((part) => part.length > 0)
          .join('. ')}
        accessibilityHint="Opens the check-in to edit it"
        style={[styles.row, { gap: railGap }]}>
        <View style={[styles.rail, { width: railWidth }]}>
          <View style={styles.rule} />
        </View>
        <View style={styles.body}>
          <Eyebrow>How it went</Eyebrow>
          {rating ? (
            <Text style={styles.rating} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {rating}
            </Text>
          ) : null}
          {tags.length > 0 ? (
            <View style={styles.tags}>
              {tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {text.length > 0 ? (
            /**
             * CLAMPED AT SIX LINES, and the ellipsis is the honest tell.
             *
             * The stored limit is 1000 characters (`MAX_REFLECTION_CHARS`), and
             * ten lines of it was tried first on the simulator: it read fine on
             * its own and pushed the WRITING LINE off the bottom of the page,
             * which is the one thing this screen may never do — Today's primary
             * action is typing the next line. Six lines holds every note anyone
             * has written in testing in full, keeps the composer on screen, and
             * iOS's own truncation says there is more. The tap shows all of it
             * (the check-in's field), as does VoiceOver, above.
             */
            <Text
              style={styles.text}
              numberOfLines={6}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {text}
            </Text>
          ) : null}
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    // Stretch, so the quote rule is exactly as tall as what it quotes.
    alignItems: 'stretch',
    paddingVertical: spacing.sm,
  },
  rail: {
    alignItems: 'center',
  },
  /**
   * The block quote. `border` is the app's hairline ink (§Spacing: `#D5D5D5`,
   * not the retired `divider`), at 2 pt because a 1 pt vertical line on warm
   * paper is a rendering artefact rather than a mark. It insets a hair top and
   * bottom so it reads as a bracket around the words, not as a divider running
   * into the rows above and below — the record has no dividers.
   */
  rule: {
    width: 2,
    flex: 1,
    marginVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: color.border,
  },
  body: {
    flex: 1,
    gap: spacing.sm - 2,
  },
  /**
   * The rating, in ink at the block's prose size but semibold — the answer to
   * the eyebrow directly above it. Not `type.headline` (17/600): that is an
   * exercise name's weight and size, and one word about the session must not
   * read as loud as the lifts it is about.
   */
  rating: {
    fontSize: moderateScale(16),
    lineHeight: lineFor(21),
    fontWeight: '600',
    letterSpacing: -0.2,
    color: color.textPrimary,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm - 2,
  },
  /**
   * `chip-row.tsx`'s pill, one step smaller: these are answers already given,
   * not four controls waiting to be pressed, and the whole block is the one tap
   * target. Everything else is that file's — surface fill, `border` hairline,
   * `shadow.card` (a white pill on cream is 1.05:1 by tone; without the shadow
   * the row reads as loose text), pill radius, ink label at caption size.
   */
  tag: {
    minHeight: moderateScale(28),
    justifyContent: 'center',
    // 12 pt, measured against the label at 13: at 10 the word sat inside its
    // own capsule with no air and the row read as two buttons rather than as
    // two answers.
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: hairline,
    borderColor: color.border,
    backgroundColor: color.surface,
    ...shadow.card,
  },
  tagLabel: {
    ...type.caption,
    fontWeight: '500',
    color: color.textPrimary,
  },
  /**
   * Their sentence, in ink at reading size — a step under an exercise name
   * (17/600) so it annotates the session rather than competing with the lifts,
   * and a full step above where it used to be printed. 16/23 is the prose
   * measure this page already uses for a line the parser kept as a note.
   */
  text: {
    // The prose carries its own leading, so the block's 6 pt gap reads tighter
    // here than it does between the label, the rating and the chips.
    marginTop: 2,
    fontSize: moderateScale(16),
    lineHeight: lineFor(23),
    letterSpacing: -0.2,
    color: color.textPrimary,
  },
  /** The row's own wash: the paper darkens under the finger, past the text
   * horizontally the way a list-row highlight does. The vertical inset is the
   * row's padding, so two adjacent records never touch. */
  wash: {
    top: spacing.xs / 2,
    bottom: spacing.xs / 2,
    left: -spacing.sm,
    right: -spacing.sm,
  },
});
