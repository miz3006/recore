import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassGroup, GlassPressable, GlassSurface } from '@/components/glass';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion';
import { track } from '@/lib/analytics';
import { tap } from '@/lib/haptics';
import { estimateVolume, groupThousands } from '@/lib/parse/estimate';
import {
  alpha,
  color,
  HIT,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  shadow,
  spacing,
  type,
} from '@/lib/theme';
import { useV2 } from '@/state/onboarding-v2';

import { ContinueButton } from '../ContinueButton';
import { DemoPage, type DemoRecord } from '../DemoPage';
import { Frame } from '../Frame';
import { v2color, v2metrics } from '../tokens';
import type { ScreenProps } from './types';

/**
 * SCREEN 6 — TRY IT. The aha moment, and since 10 September 2026 it IS the
 * Today page rather than a screen assembled out of Today's parts.
 *
 * §2: "The aha moment. Neither reference app has this because neither can show
 * its magic in three seconds. This one can."
 *
 * ## What this file owns
 *
 * Only what cannot live inside the page — which is the same division Today
 * makes (`app/(tabs)/today/index.tsx`): the chrome above it, the bar that rides
 * on the keyboard, and the answer that leaves with the person. The page itself
 * — title, dateline, record, composer — is `DemoPage`, and the reasoning for
 * every part of it is written there.
 *
 * ## The headline is the page's own title
 *
 * `flow.ts` still carries this screen's headline ("Try it.") and it is not
 * drawn. A screen cannot have two large titles, and on this one the large title
 * has to be **Today**, because being on Today is the entire claim. The
 * instruction survives verbatim as the page's quiet line under the dateline —
 * the slot Today's weekly line occupies, hidden while the keyboard is up for
 * the same reason that one is.
 *
 * ## The bottom belongs to the keyboard
 *
 * Today's own arrangement (owner, 18 August 2026): while somebody is writing,
 * the accessory bar floats over the keyboard and the resting chrome is gone. So
 * this screen does not use the frame's pinned CTA. Continue stands where Today
 * puts Finish with the hide-keyboard round beside it, and the full-width
 * `ContinueButton` comes back the moment the keyboard goes down and the record
 * is there to be read.
 *
 * ## The bar is UIKit's, not ours (measured, 10 September 2026)
 *
 * Today positions its toolbar by hand — a listener, a `bottom: keyboardHeight`,
 * and a clearance constant in the page's padding — and on a page with two cards
 * on it that arrangement puts the line you are writing UNDERNEATH the bar. It
 * is not a padding bug and no constant fixes it: the page is `flexGrow: 1`, so
 * a short page is exactly as tall as its frame and top-aligned, trailing
 * padding moves nothing, and what actually places the composer is UIKit
 * scrolling the first responder into a rect that only knows about the keyboard.
 * A sibling overlay is invisible to that rect. Photographed on the simulator
 * before the change.
 *
 * So the bar is a real `InputAccessoryView`. iOS attaches it to the keyboard,
 * every keyboard frame reported anywhere includes it, and the scroll view
 * insets itself around both with no arithmetic here at all. It is also what the
 * design skill asks for outright — keyboard-tracking UI belongs to the system,
 * never to a listener plus a guessed number. Today should follow; that is a
 * change to Today and not to this screen, so it is not made here.
 */
export function DemoScreen({ def, progress, onAdvance, onBack }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const set = useV2((s) => s.set);
  /** The record as this screen was left, read ONCE. It is also what this
   * screen writes back, so reading it live would hand the page its own output
   * as an initial value on every keystroke. */
  const [stored] = useState(() => useV2.getState().answers.demoText);
  const [record, setRecord] = useState<DemoRecord>({
    text: stored,
    entries: [],
  });
  /**
   * WRITING OR NOT — the only thing this screen needs from the keyboard, now
   * that its height is UIKit's business (see the note above). It decides two
   * things: whether the resting Continue is mounted, and whether the page still
   * shows the line explaining itself.
   */
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  /** What the keyboard is covering — and, because the bar is attached to it
   * rather than floating over it, that number already includes the bar. */
  const [covered, setCovered] = useState(0);
  const [barHeight, setBarHeight] = useState(0);
  const field = useRef<TextInput>(null);
  const attempts = useRef(0);

  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(show, (e) => {
      setKeyboardOpen(true);
      setCovered(e.endCoordinates.height);
    });
    const h = Keyboard.addListener(hide, () => {
      setKeyboardOpen(false);
      setCovered(0);
    });
    return () => {
      s.remove();
      h.remove();
    };
  }, []);

  /**
   * THE ANSWER LEAVES WITH THE PERSON. `demoText` is the record verbatim and
   * `demoEntries` is what the grammar made of it; screen 7 prints the first,
   * the key-lift screen and the projection read the second, and the first real
   * session is seeded from both. Committed lines only — a half-typed line has
   * not been written yet.
   */
  const onRecord = useCallback(
    (next: DemoRecord) => {
      setRecord(next);
      set('demoText', next.text);
      set('demoEntries', next.entries);
    },
    [set],
  );

  const onLineRead = useCallback((readings: number, source: 'typed' | 'example') => {
    attempts.current += 1;
    if (readings > 0) {
      track('onboarding_demo_parsed', {
        flow: 'v2',
        source,
        parsed_locally: true,
        attempts: attempts.current,
        lines: readings,
      });
    } else {
      track('onboarding_demo_failed', {
        flow: 'v2',
        reason: 'no_load_or_reps',
      });
    }
  }, []);

  const advance = useCallback(() => {
    Keyboard.dismiss();
    onAdvance();
  }, [onAdvance]);

  // Something is written. Not "something was READ": a line the small offline
  // grammar missed is a line the real parser may well read, and refusing to let
  // somebody past their own writing would be the app calling it wrong (§3).
  const written = record.text.trim().length > 0;
  const readings = record.entries.length;
  const volume = estimateVolume(record.text);

  return (
    <Frame
      // Not drawn — see the note above. The page's own title is "Today".
      headline=""
      progress={progress}
      onBack={onBack}
      bleed
      testID="v2-screen-demo">
      <DemoPage
        initialText={stored}
        instruction={def.subline ?? ''}
        // What the bar is covering. The page hands it to UIKit as a content
        // inset rather than as padding — see `DemoPage`, which measured why.
        bottomInset={barHeight}
        accessoryViewID={ACCESSORY_ID}
        covered={covered}
        onRecord={onRecord}
        onLineRead={onLineRead}
        inputRef={field}
      />

      {/* THE BAR ON THE KEYBOARD. `InputAccessoryView` renders nothing until the
          field it is paired with is the first responder, so this whole subtree
          is the writing state and needs no flag of its own. */}
      <InputAccessoryView nativeID={ACCESSORY_ID}>
        <View style={[styles.barInner, styles.barWriting]}>
          {/* WHAT THE PAGE HAS READ SO FAR, in the row Today prints its staged
              total in and in the flow's own words for it (screen 7's echo says
              "Read one line"). Silent until there is something to say: zero is
              not a number worth speaking (CLAUDE.md §9).

              It is a label, not a control. Today's is a pill because it opens
              Progress; there is nowhere for this one to go, so it does not
              pretend to be tappable. */}
          {readings > 0 ? (
            <View style={styles.status}>
              <GlassSurface radius={radius.pill} />
              <Text
                style={styles.statusText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {readings === 1 ? 'read one line' : `read ${readings} lines`}
                {volume > 0 ? ` · ${groupThousands(volume)} kg` : ''}
              </Text>
            </View>
          ) : null}

          <GlassGroup style={styles.row}>
            {/* Put the keyboard away without settling anything — the same
                  labelled way down Today's accessory row offers, and the only
                  one this screen has (there is no navigation bar here to carry
                  a Done button). */}
            <GlassPressable
              onPress={() => {
                tap();
                Keyboard.dismiss();
              }}
              haptic="none"
              activeScale={0.92}
              radius={ROUND / 2}
              style={styles.round}
              contentStyle={styles.roundContent}
              accessibilityLabel="Hide keyboard">
              <Icon name="keyboard-hide" size={ACCESSORY_GLYPH} tint={color.textPrimary} />
            </GlassPressable>

            {/* CONTINUE STANDS WHERE FINISH STANDS: last in the row, anchored
                  right, a filled pill at the row's own 44 rather than the app's
                  56 — the compact case the height rule leaves open for a
                  control sitting among 44 pt circles. It is the same shape as
                  Finish because it is the same kind of act: the one committed
                  thing you can do from this page. */}
            <PressableScale
              disabled={!written}
              haptic="none"
              activeScale={0.98}
              accessibilityRole="button"
              accessibilityState={{ disabled: !written }}
              onPress={advance}
              style={[styles.continue, !written && styles.continueDisabled]}
              pressedStyle={written ? styles.continuePressed : undefined}>
              <Text
                style={styles.continueLabel}
                numberOfLines={1}
                maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Continue
              </Text>
            </PressableScale>
          </GlassGroup>
        </View>
      </InputAccessoryView>

      {/* AT REST, THE FLOW'S OWN GRAMMAR COMES BACK: the wide glowing pill every
          other screen advances on, pinned over the page. The two Continues never
          share a moment — this one is unmounted while the keyboard is up — so
          nothing ever swaps under a thumb.

          It measures itself, and the page takes that height as padding, which
          is the resting half of the clearance the accessory view handles for
          the writing half. */}
      {keyboardOpen ? null : (
        <>
          {/* THE PAPER TAKES THE RECORD OVER, it does not cut it — `scroll-edge`
              states the argument and the frame's own footer already obeys it.
              A hairline here would be the lid this page spent the redesign
              removing. It rides on the footer's measured height so the fade
              arrives before the button rather than starting at it. */}
          <LinearGradient
            colors={EDGE_COLOURS}
            style={[styles.edge, { bottom: barHeight }]}
            pointerEvents="none"
          />
          <View
            style={[styles.rest, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
            onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}>
            <ContinueButton enabled={written} onPress={advance} />
          </View>
        </>
      )}
    </Frame>
  );
}

/** The paper's reach up over the record before the pinned button — one fade
 * depth for the whole app (`scroll-edge.tsx`). */
const EDGE_FADE = spacing.xxl;
const EDGE_COLOURS = [alpha(color.canvas, 0), color.canvas] as const;
/** Pairs the field with the bar that hangs off the keyboard above it. */
const ACCESSORY_ID = 'v2-demo-accessory';
/** The round buttons' diameter — a real 44 pt target, never smaller (§14). */
const ROUND = HIT;
const ACCESSORY_GLYPH = moderateScale(20);

const styles = StyleSheet.create({
  // No background and no top border: the shapes FLOAT over the page and the
  // keyboard. A strip here is the lid Today spent August removing.
  barInner: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  /** Inside the accessory view the home indicator is the keyboard's problem,
   * so the bar owes only its own bottom air. */
  barWriting: { paddingBottom: spacing.sm },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: EDGE_FADE,
  },
  /** The resting footer, pinned over the page like the frame's own. */
  rest: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: v2metrics.gutter,
    paddingTop: spacing.md,
  },
  status: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: moderateScale(30),
    justifyContent: 'center',
    paddingHorizontal: spacing.md + 2,
  },
  statusText: {
    ...readingStyle('400'),
    fontSize: moderateScale(11),
    color: color.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  round: { minWidth: ROUND },
  roundContent: {
    height: ROUND,
    minWidth: ROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continue: {
    marginLeft: 'auto',
    height: ROUND,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
    // The primary action on this screen, so it wears the app's one coloured
    // shadow — the same glow the flow's wide CTA carries.
    ...shadow.glow,
  },
  continuePressed: { backgroundColor: color.brandPressed },
  /**
   * ASLEEP IS A GREY FILL, NOT A FADED BLUE — the flow's own treatment
   * (`ContinueButton`, §3: "Cal AI greys the whole pill and keeps the label
   * white; the button stays the same object, it is simply not awake yet").
   *
   * Today's Finish dims itself with opacity instead, and copying that here
   * would have put two different disabled states for the SAME WORD on one
   * screen: this pill while the keyboard is up, the wide pill when it goes
   * down. One label, one intent, one look — so on this screen the accessory
   * Continue follows the funnel rather than the toolbar it borrows its shape
   * from. The glow goes with the colour: a coloured shadow under a grey pill
   * is a button pretending to be awake.
   */
  continueDisabled: {
    backgroundColor: v2color.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  continueLabel: {
    color: color.onInk,
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
  },
});
