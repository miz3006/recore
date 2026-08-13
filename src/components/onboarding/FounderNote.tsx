import { StyleSheet, Text, View } from 'react-native';

import { FadeSlideIn } from '@/components/motion';
import { color, lineFor, MAX_FONT_SCALE, moderateScale, radius, readingStyle, spacing, type } from '@/lib/theme';

import { contentDelay } from './OnboardingScreen';
import { FOUNDER_NOTE, FOUNDER_SIGNATURE } from './config';
import { INK_CARD, RISE_PX, ENTER_MS } from './tokens';

/**
 * The founder note (owner's spec, 12 Aug 2026 — behind `FOUNDER_NOTE_ENABLED`
 * in the config, on by default). One personal screen in the same template as
 * every other: mascot, headline, a few quiet paragraphs, a signature line, and
 * the CTA.
 *
 * The paragraphs are PLACEHOLDER COPY and marked as such in the config. They
 * are written in the first person and attributed to a named real person, which
 * is exactly the kind of string that must not reach the App Store unreviewed —
 * see the TODO on `FOUNDER_NOTE`.
 *
 * The photo is a plain ink disc with an initial in it until a real portrait is
 * dropped in. It is a placeholder for a picture of a real person, not a stand-in
 * for a testimonial: nothing here claims a rating, a review or a user count.
 */
export function FounderNote() {
  return (
    <View style={styles.wrap}>
      {FOUNDER_NOTE.map((paragraph, i) => (
        <FadeSlideIn
          key={paragraph}
          delay={contentDelay(i)}
          distance={RISE_PX}
          duration={ENTER_MS}>
          <Text style={styles.paragraph} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {paragraph}
          </Text>
        </FadeSlideIn>
      ))}

      <FadeSlideIn
        delay={contentDelay(FOUNDER_NOTE.length)}
        distance={RISE_PX}
        duration={ENTER_MS}>
        <View style={styles.signature}>
          <View style={styles.portrait}>
            <Text style={styles.initial} maxFontSizeMultiplier={1}>
              {FOUNDER_SIGNATURE.name.slice(0, 1)}
            </Text>
          </View>
          <Text style={styles.attribution} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {FOUNDER_SIGNATURE.name} ({FOUNDER_SIGNATURE.role})
          </Text>
        </View>
      </FadeSlideIn>
    </View>
  );
}

const PORTRAIT = moderateScale(36);

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  paragraph: {
    ...type.subhead,
    lineHeight: lineFor(22),
    color: color.textSecondary,
  },
  signature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  portrait: {
    width: PORTRAIT,
    height: PORTRAIT,
    borderRadius: radius.pill,
    backgroundColor: INK_CARD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    ...readingStyle('600'),
    fontSize: moderateScale(15),
    color: color.textMuted,
  },
  attribution: {
    ...type.caption,
    fontWeight: '600',
    color: color.textSecondary,
  },
});
