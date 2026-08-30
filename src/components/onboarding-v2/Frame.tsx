import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { tap } from '@/lib/haptics';
import { Enter, SpringBar } from '@/lib/motion/index';
import { MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';

import { ContinueButton } from './ContinueButton';
import { v2color, v2metrics } from './tokens';

/**
 * THE FRAME EVERY v2 SCREEN SITS IN.
 *
 * Back circle → progress rail → headline → subline → content → pinned CTA, in
 * that order, on every screen that has them. Measured off Cal AI's own screens
 * at 393 pt (`research/calai/04_acquisition.png` and friends): 24 pt gutter,
 * 40 pt back circle, a 4 pt rail on the same centre line, 68 pt rows 12 apart,
 * and a CTA pinned over a hairline with the list fading out beneath it.
 *
 * ## Why the chrome is here and not in a layout
 *
 * The rail's value is a function of the step, and the CTA's enabled state is a
 * function of the answer — both belong to the screen. Putting the frame in the
 * route layout would mean lifting both back up through context to get them
 * down again. One component, one set of props, and no screen draws its own
 * back button.
 *
 * ## What it does NOT do
 *
 * It does not animate itself in or out. The screen-to-screen push is the
 * navigator's (see `src/app/onboarding-v2/_layout.tsx`); the frame's job is to
 * be identical on both sides of it so the only thing that appears to move is
 * the content. The rail is the exception, and it rides the same spring as the
 * push on purpose (§3).
 */
export function Frame({
  headline,
  subline,
  /** 0…1, or null on a screen with no rail (screen 1). */
  progress,
  onBack,
  /** Omit to hide the CTA entirely — screens 8 and 16 advance themselves. */
  cta,
  /** Content below the headline block. */
  children,
  /** Rendered between the headline block and `children` — the character's
   * band on the screens that have one. */
  above,
  /** One quiet line above the headline saying what the LAST answer changed
   * (`echo.ts`). Null on screens where nothing changed yet. */
  echo,
  /** A text link under the CTA. Screen 1's "I already have an account". */
  footerLink,
  /** Screens that own their own scrolling (a text field with a keyboard) opt
   * out of the frame's ScrollView. */
  scroll = true,
  /** Lift the whole frame — content AND the pinned CTA — above the keyboard.
   * The frame does this rather than the screen, because the CTA lives here and
   * a screen cannot move a button it does not own. */
  avoidKeyboard = false,
  /** Centre the headline block — the statement screens (6, 8, 14, 16, 17). */
  centred = false,
  testID,
}: {
  headline: string;
  subline?: string;
  progress: number | null;
  onBack?: () => void;
  cta?: { label?: string; enabled: boolean; onPress: () => void; hint?: string };
  children?: ReactNode;
  above?: ReactNode;
  echo?: string | null;
  footerLink?: { label: string; onPress: () => void };
  scroll?: boolean;
  avoidKeyboard?: boolean;
  centred?: boolean;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();

  const body = (
    <>
      {above}
      {echo ? (
        <Enter index={0} from={8}>
          <View style={styles.echoRow}>
            <View style={styles.echoDot} />
            <Text style={styles.echo} maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={2}>
              {echo}
            </Text>
          </View>
        </Enter>
      ) : null}
      {/* AN EMPTY HEADLINE DRAWS NOTHING, not an empty line. The insight
          screens own their own centred statement and pass `headline=""`; before
          this guard that still rendered a `largeTitle` Text, which is ~40 pt of
          blank line height, and `content`'s 32 pt gap sat under it — 72 pt of
          dead space above a screen whose whole job is to be centred. */}
      {headline ? (
        <Enter index={echo ? 1 : 0}>
          <Text
            style={[styles.headline, centred && styles.centredText]}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {headline}
          </Text>
        </Enter>
      ) : null}
      {subline ? (
        <Enter index={echo ? 2 : 1}>
          <Text
            style={[styles.subline, centred && styles.centredText]}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {subline}
          </Text>
        </Enter>
      ) : null}
      {/* The gap belongs to the headline block. With no block there is nothing
          to be spaced away from, so the content starts at the top. */}
      <View style={headline || subline ? styles.content : styles.contentBare}>{children}</View>
    </>
  );

  const inner = (
    <>
      <View style={styles.header}>
        {onBack ? (
          <Pressable
            onPress={() => {
              tap();
              onBack();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.back}
            testID="v2-back">
            <Icon name="chevron-back" size={moderateScale(20)} tint={v2color.ink} />
          </Pressable>
        ) : (
          // SPACE, NOT A DISC. The spacer used to reuse `back`, surface fill and
          // all, so screen 1 — which has nothing to go back to — opened on an
          // empty white circle in the corner. It holds the rail's start position
          // and paints nothing.
          <View style={styles.backSpacer} />
        )}
        {progress === null ? (
          <View style={styles.railSlot} />
        ) : (
          <View style={styles.railSlot}>
            <SpringBar
              progress={progress}
              height={v2metrics.railHeight}
              trackColor={v2color.track}
              fillColor={v2color.blue}
              accessibilityLabel="Progress"
            />
          </View>
        )}
      </View>

      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.scrollBody]}>{body}</View>
      )}

      {cta || footerLink ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: (avoidKeyboard ? spacing.md : insets.bottom) + spacing.md },
          ]}>
          {cta ? (
            <ContinueButton
              label={cta.label}
              enabled={cta.enabled}
              onPress={cta.onPress}
              accessibilityHint={cta.hint}
            />
          ) : null}
          {footerLink ? (
            <Pressable
              onPress={() => {
                tap();
                footerLink.onPress();
              }}
              hitSlop={10}
              accessibilityRole="link"
              style={styles.footerLink}>
              <Text style={styles.footerLinkLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {footerLink.label}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID={testID}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top}>
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: v2color.canvas },
  flex: { flex: 1 },
  header: {
    height: v2metrics.backButton,
    marginTop: spacing.sm,
    marginHorizontal: v2metrics.gutter,
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: {
    width: v2metrics.backButton,
    height: v2metrics.backButton,
    borderRadius: v2metrics.backButton / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: v2color.surface,
  },
  backSpacer: { width: v2metrics.backButton, height: v2metrics.backButton },
  railSlot: { flex: 1, marginLeft: v2metrics.railGap, justifyContent: 'center' },
  scrollBody: {
    paddingHorizontal: v2metrics.gutter,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  /**
   * ONE HEADLINE VOICE FOR THE WHOLE FLOW.
   *
   * `type.largeTitle` is the existing scale's 34 pt and stays exactly that; the
   * only override is the weight, because Cal AI's questions are unmistakably
   * heavier than its body and that contrast is most of what makes a question
   * screen read as a question. Sizes are not touched — §0 froze the type scale.
   */
  /**
   * The echo sits ABOVE the headline and reads as a caption on it, not as a
   * badge: no fill, no pill, no colour beyond the one dot. It is the app
   * reporting its own state, and the record's voice for that is dry.
   */
  echoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  echoDot: {
    width: moderateScale(5),
    height: moderateScale(5),
    borderRadius: moderateScale(2.5),
    backgroundColor: v2color.blue,
  },
  echo: { ...type.subhead, color: v2color.inkSecondary, flex: 1 },
  headline: { ...type.largeTitle, fontWeight: '800', color: v2color.ink },
  subline: { ...type.body, color: v2color.inkSecondary, marginTop: spacing.md },
  centredText: { textAlign: 'center' },
  content: { marginTop: v2metrics.headlineGap },
  contentBare: { flex: 1 },
  footer: {
    paddingHorizontal: v2metrics.gutter,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: v2color.border,
    backgroundColor: v2color.canvas,
    ...Platform.select({ ios: {}, default: {} }),
  },
  footerLink: { alignSelf: 'center', paddingVertical: spacing.md, marginTop: spacing.xs },
  footerLinkLabel: { ...type.subhead, color: v2color.blue, fontWeight: '600' },
});
