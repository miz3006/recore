import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { DUR } from '@/lib/motion';
import { clearSettled, useNetState } from '@/lib/net-state';
import { color, MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';

import { Icon } from './icon';

/**
 * WHAT TODAY SAYS WHEN THE PHONE CANNOT REACH THE SERVICE (owner, 17 September
 * 2026: *"ce oseba dela offline … da se bo zapis shranil brez problema takoj ko
 * pride do signala in da ne skrbi nic da kr naprej vpisuje"*).
 *
 * Gyms are underground. The app has always worked down there — SQLite is the
 * source of truth and the dirty flags hold the queue (CLAUDE.md §3) — and it
 * has never once SAID so. A person who notices their lines are not being read
 * has no way to tell "this phone has no signal and is keeping everything" from
 * "this is broken and I am losing my session", and the second guess is the one
 * people make. This line is the app answering the question before it is asked.
 *
 * ## Where it stands, and why it is not a banner
 *
 * Directly under Today's dateline, on the page, above the record — one line of
 * the sentence the title started ("Today · Tuesday, 17 September · no
 * connection"). It is not a toast, not a modal, not a strip pinned over the
 * content:
 *
 * - **It costs the record nothing.** §Structure gives this page three layers
 *   and the record has no cards; a filled banner here would be a fourth thing
 *   floating over a page whose whole argument is that the writing is the
 *   loudest object on it.
 * - **It scrolls away like the dateline does.** What the athlete is doing is
 *   WRITING, and the state that matters mid-line is on the line itself — the
 *   amber ring and the three still dots (`gutter-value.tsx`'s `WaitingMark`).
 *   This says the sentence once, where the page introduces itself.
 * - **It only exists while it is true.** Online and with nothing queued, it
 *   renders `null` — no placeholder, no reserved height, no "connected" badge.
 *   An app that reports the ordinary state is an app that makes it a subject.
 *
 * ## The colour
 *
 * `warning` #8A5613, the palette's own amber, whose definition in `color.ts`
 * names this exact job ("offline/allowance banners"). It is deliberately NOT
 * `error` red — nothing has failed, and nothing is at risk — and deliberately
 * not `attention`, which is reserved for facts about TRAINING (a plateau, a
 * backoff) and may not be spent on the app's own plumbing. It measures 5.59:1
 * on the canvas, the best-contrasting accent in the palette.
 *
 * Colour is never the only carrier (§Colour): the words say it too, and the
 * VoiceOver label says it in full.
 *
 * ## The second beat
 *
 * Coming back is not "the radio returned" — it is THE QUEUE HAVING DRAINED,
 * which is what was actually promised, and only the sync loop knows it
 * (`reportSynced`). So the line holds its slot for one quiet confirmation and
 * then leaves. No celebration, no check-mark animation, no haptic: this is the
 * app reporting, and a record does not congratulate itself for doing its job
 * (CLAUDE.md §2.6).
 */

/** How long the "back online" confirmation stands before it withdraws. Long
 * enough to be read on a glance up from the bar, short enough that it is gone
 * before it becomes furniture. */
const SETTLED_MS = 3200;

export function OfflineLine() {
  const { offline, settledAt } = useNetState();
  const reduceMotion = useReducedMotion();

  /**
   * THE CONFIRMATION IS NOT LOCAL STATE, and that is not a style preference.
   *
   * The obvious build holds a `showSettled` boolean and flips it in an effect,
   * which means the stamp lives in two places and the render that reconciles
   * them is a cascading one. There is only one fact here — `net-state` is
   * holding a stamp that nobody has shown yet — so this component owns no copy
   * of it. It draws while the stamp exists and spends it on a timer;
   * `clearSettled` is what makes the line leave, and because the stamp is
   * handed out once per offline stretch, a day of tab-switching cannot replay
   * the same confirmation.
   */
  useEffect(() => {
    if (settledAt === null) return;
    const t = setTimeout(clearSettled, SETTLED_MS);
    return () => clearTimeout(t);
  }, [settledAt]);

  const settled = !offline && settledAt !== null;
  if (!offline && !settled) return null;

  return (
    <Animated.View
      // Keyed on the state so the swap plays as an arrival rather than as text
      // changing under the eye — two different sentences, one slot.
      key={settled ? 'settled' : 'offline'}
      entering={reduceMotion ? undefined : FadeIn.duration(DUR.base)}
      style={styles.row}
      accessible
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={
        settled
          ? 'Back online. Everything you wrote is saved to your account.'
          : 'No connection. Everything you write is saved on this phone, and syncs itself as soon as you are back online. Keep writing.'
      }>
      {/* A box on the first line's own line height, so the glyph sits on that
          line's optical centre whether the sentence runs to one line or three.
          A glyph aligned to the top of a wrapping paragraph drifts. */}
      <View style={styles.glyphBox}>
        <Icon
          name={settled ? 'synced' : 'no-signal'}
          size={GLYPH}
          tint={settled ? color.textSecondary : color.warning}
        />
      </View>
      <View style={styles.body}>
        <Text style={styles.head} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {settled ? (
            <>
              <Text style={styles.headSettled}>Back online</Text>
              <Text style={styles.tail}> · everything is saved</Text>
            </>
          ) : (
            <>
              <Text style={styles.headOffline}>No connection</Text>
              <Text style={styles.tail}> · saved on this phone</Text>
            </>
          )}
        </Text>
        {settled ? null : (
          <Text style={styles.sub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Keep writing — it syncs itself the moment you&rsquo;re back.
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

/** The glyph sits at the head of a subhead line, so it is sized to one — a
 * symbol that outgrows its sentence reads as an alert badge. */
const GLYPH = moderateScale(15);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    // The dateline above it is one block with the title; this hangs under that
    // block rather than joining it, and the record's own air opens below.
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  glyphBox: {
    height: moderateScale(21), // the head line's box
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  head: {
    ...type.subhead,
  },
  /** The state, in the colour whose token names this job. Weighted, because it
   * is the one word on the page that is not about training and has to be found
   * without being loud. */
  headOffline: {
    ...type.subhead,
    fontWeight: '600',
    color: color.warning,
  },
  /** The settled beat speaks in ink, not in a second colour: nothing needs
   * marking any more, which is the whole message. */
  headSettled: {
    ...type.subhead,
    fontWeight: '600',
    color: color.textSecondary,
  },
  /** What is TRUE about the record — information, so `textSecondary` and never
   * muted (§Colour: muted is for what the eye may skip). */
  tail: {
    ...type.subhead,
    color: color.textSecondary,
  },
  sub: {
    ...type.caption,
    color: color.textSecondary,
  },
});
