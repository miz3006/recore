import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { tap } from '@/lib/haptics';
import { getName, setName } from '@/lib/prefs';
import {
  color,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  type,
} from '@/lib/theme';

/**
 * WHO THIS IS — Pin Trading's identity block, in Recore's materials.
 *
 * The reference (Pin Trading, `oth_hirl5`) centres an avatar over a name and
 * stops. That restraint is the whole reason it works: a profile head that also
 * carries a level, a badge row and an edit button reads as a dashboard, and the
 * thing a person actually came here to see — their own name — has to compete
 * for it. Two elements, centred, nothing else.
 *
 * ## The avatar is the cap character, not a gradient disc
 *
 * Pin Trading's is a yellow gradient circle with a generic person glyph in it,
 * which is exactly the pattern this app has rejected. Recore already has a
 * likeness: the cap character the onboarding walks in with. Reusing it here
 * means the person who just finished onboarding meets the same drawing on the
 * first screen they open afterwards, which is worth more than any monogram.
 *
 * ## The asset is its own file, because the shared one is not transparent
 *
 * MEASURED, on device: every pose in `assets/new_onboarding/` is an **opaque**
 * RGBA export carrying a baked-in transparency CHECKERBOARD — two neutral greys,
 * ~238 and ~254 — everywhere its background should be. The exporter's checker
 * pattern was flattened into the artwork. The first build of this block dropped
 * `03_name.png` into a tinted disc and the checker read as a woven texture,
 * plainly, at 96 pt; putting it on the bare canvas only made the squares easier
 * to count.
 *
 * `assets/profile/avatar.png` is `01_welcome.png` with that pattern removed and
 * the figure cropped to its own bounds. It is genuinely transparent, so it sits
 * on any ground this screen ever grows. The pattern was identified rather than
 * thresholded: a pixel is background only where BOTH checker tones occur inside
 * a window wider than one checker square, which is true of the checker and false
 * of the character's white skin (a flat ~254 with no dark tone anywhere near it).
 *
 * **The owner called that asset pass on 28 August 2026.** All nineteen poses are
 * cut out now, in `assets/new_onboarding/cutout/`, and the onboarding flow draws
 * from there — so the checkerboard is gone from the 200 pt copies too. This file
 * keeps its own `assets/profile/avatar.png` because that one is also cropped for
 * an avatar rather than to the figure's full bounds; nothing here needs to
 * change, and pointing it at the shared cutout is a one-line swap whenever
 * somebody wants the two to be literally the same file.
 *
 * The walking-in pose won over the locker pose for a small reason that matters
 * at 112 pt: it is one figure. `03_name.png` is a figure AND a locker, which at
 * avatar size is two objects competing inside a shape the eye reads as one.
 *
 * ## No disc
 *
 * The reference fills its circle with a yellow gradient, which is on the list of
 * Pin Trading patterns this app rejects. With a genuinely transparent figure
 * there is nothing for a container to do, and a container drawn in the page's
 * own colour is a container that is not there.
 *
 * ## IT IS A ROW NOW, NOT A COLUMN (9 September 2026)
 *
 * The block was centred: a 112 pt figure over a centred name, the whole thing
 * roughly 200 pt tall before the page said anything. Two things changed and
 * both point the same way.
 *
 * The page took the system's own large title, which is **left-aligned and
 * scrolls up into the bar**. A centred hero under a left-aligned title is two
 * competing axes in the first screenful, and the eye reads the disagreement
 * before it reads either one. Every account header on the phone — Apple ID in
 * Settings, the Fitness profile, Mail's accounts — is a left-aligned row for
 * exactly this reason.
 *
 * And the design system asks the mascot to stand down on a data screen: *"On
 * data screens it is a corner mark of at most 32 pt, or it is absent. It never
 * competes with a number."* This screen is not quite that — it is where a
 * person's own name lives — but it does carry the career record two lines
 * below, so 112 pt of character above it was the character competing. At 72 it
 * is unmistakably the same drawing and it is no longer the loudest thing here.
 *
 * The block gives back roughly 110 pt, which is most of a settings group.
 *
 * ## The line under the name is a FACT or it is absent
 *
 * `sub` prints one dry line — the date the record starts. It is read from the
 * logged days by the caller and is simply not rendered when there are none. No
 * "Member since", no level, no title, nothing derived from an assumption: this
 * screen sits one tab away from a paywall, and an invented identity line is the
 * same fabrication the app deleted from that paywall in July (§3).
 *
 * ## Rename is inline, and it is the app's own name
 *
 * Tapping the name swaps it for a field in place — no sheet, no route, no Save
 * button. It writes `pref_name`, which is the name the whole app already greets
 * people by, so there is one name and not a profile copy of one. An emptied
 * field is a real answer and clears it; the label falls back to the flow's own
 * neutral wording rather than inventing a placeholder identity.
 */

const AVATAR = moderateScale(72);
/** The cap character, walking in — the flow's first frame, background removed. */
const PORTRAIT = require('../../../assets/profile/avatar.png');

export function Identity({ sub }: { sub?: string }) {
  const [name, setNameState] = useState<string | null>(() => getName());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const field = useRef<TextInput>(null);

  useEffect(() => {
    if (editing) field.current?.focus();
  }, [editing]);

  const begin = () => {
    tap();
    setDraft(name ?? '');
    setEditing(true);
  };

  /** Commit on blur AND on submit — the two ways out of a one-line field. */
  const commit = () => {
    const next = draft.trim();
    setName(next);
    setNameState(next ? next : null);
    setEditing(false);
  };

  return (
    <View style={styles.root}>
      <View style={styles.avatar}>
        <Image
          source={PORTRAIT}
          style={styles.portrait}
          contentFit="contain"
          // Decorative: the name below is the identity, and VoiceOver reading
          // "image" before it would put furniture ahead of the fact.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </View>

      <View style={styles.who}>
        {editing ? (
          <TextInput
            ref={field}
            style={[styles.name, styles.field]}
            value={draft}
            onChangeText={setDraft}
            onBlur={commit}
            onSubmitEditing={commit}
            returnKeyType="done"
            placeholder="Your name"
            placeholderTextColor={color.textMuted}
            selectionColor={color.brand}
            cursorColor={color.brand}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={40}
            allowFontScaling
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            accessibilityLabel="Your name"
          />
        ) : (
          <PressableScale
            onPress={begin}
            haptic="none"
            activeScale={0.98}
            accessibilityRole="button"
            accessibilityLabel={name ? `${name}. Rename` : 'Add your name'}
            accessibilityHint="Edits your name here"
            style={styles.namePress}>
            <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {name ?? 'Add your name'}
            </Text>
          </PressableScale>
        )}
        {sub && !editing ? (
          <Text style={styles.sub} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  /** The name column takes the rest of the row, so a long name wraps its own
   * line rather than pushing the figure off the left gutter. */
  who: {
    flex: 1,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portrait: {
    width: AVATAR,
    height: AVATAR,
  },
  namePress: {
    // A name is a 44 pt target even when the word is short. The negative inset
    // buys the target its width back without moving the glyphs off the gutter
    // the rest of the page hangs on.
    minHeight: moderateScale(40),
    justifyContent: 'center',
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
  },
  name: {
    ...type.title2,
    // NO FIXED LINE BOX (10 September 2026). `lineFor()` scales for the DEVICE,
    // not for Dynamic Type, so at the ×1.5 cap the glyphs grow and the box does
    // not — measured on the iOS 26.5 simulator at accessibility-extra-large,
    // where this text lost its ascenders and descenders. The font's own metrics
    // size the line instead, which is what a scaling label wants anyway.
    lineHeight: undefined,
    color: color.textPrimary,
  },
  /** One dry fact, or nothing — see the note above. */
  sub: {
    ...type.subhead,
    // NO FIXED LINE BOX (10 September 2026). `lineFor()` scales for the DEVICE,
    // not for Dynamic Type, so at the ×1.5 cap the glyphs grow and the box does
    // not — measured on the iOS 26.5 simulator at accessibility-extra-large,
    // where this text lost its ascenders and descenders. The font's own metrics
    // size the line instead, which is what a scaling label wants anyway.
    lineHeight: undefined,
    color: color.textSecondary,
    // The pull-up closes the gap a 27 pt line box left under the name. With the
    // box gone the name sits on its own metrics, so the sub only needs a hair
    // less than the default — a full -4 at accessibility sizes drove it into
    // the name's descenders.
    marginTop: -1,
  },
  // The field keeps the name's exact type so the swap moves nothing. The rule
  // under it is the only thing that says "this is editable now".
  field: {
    minHeight: moderateScale(40),
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 0,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
});
