import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { markFirstWorkoutFinished } from '@/lib/funnel';
import { tap, tapMedium } from '@/lib/haptics';
import { refreshRecapNotification } from '@/lib/recap';
import { estimateVolume, groupThousands } from '@/lib/parse/estimate';
import { formatDistanceTotal } from '@/lib/parse/summarize';
import { hasFinishedOnce, markFinishedOnce } from '@/lib/prefs';
import { maybeAskForReview } from '@/lib/review';
import {
  color,
  HIT,
  ink,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  shadow,
  spacing,
  type,
} from '@/lib/theme';
import { startDictation, voiceAvailable, type DictationHandle } from '@/lib/voice';
import { useCurrentNote, useSession } from '@/state/session-store';

import { GlassGroup, GlassPressable } from './glass';
import { Icon } from './icon';
import { FadeSwap, PressableScale } from './motion';
import { revealReceipt } from './note-focus';
import { ACCESSORY_GLYPH, RestBar, RestRing, useRestEngine } from './rest-controls';

/**
 * The ACCESSORY BAR — rebuilt 28 July on the owner's reference: FLOATING GLASS
 * shapes over the keyboard instead of a bordered strip attached to it.
 *
 * The shape is two rows and no bar:
 *
 *   [ 4 staged · 3 240 kg ]                          ← a glass pill, the number
 *   ( timer ) ( mic ) ( hide kb )            [ Finish ]
 *
 * …and while a rest is running, the top row is the rest instead:
 *
 *   [ 2:41  rest                        +30 s   Skip ]
 *   ( ◔ )    ( mic ) ( hide kb )             [ Finish ]
 *
 * The material is `glass.tsx` — the system's Liquid Glass where it exists, the
 * app's warm paper everywhere else, and **no tint either way** for the same
 * reason §4 sets none on the tab bar: glass recolours itself against what is
 * behind it, and a fixed hex goes illegible over some content.
 *
 * ## THE ROW IS ONE INSTRUMENT NOW (9 September 2026)
 *
 * Two upgrades landed with the iOS 26 pass, and both are things only the real
 * material can do:
 *
 * **The three rounds are `GlassPressable`, so they take the interactive lens** —
 * the glass bends and tracks the thumb across each shape instead of only
 * dipping. These buttons sit over the system keyboard, which is the busiest
 * ground in the app, and a control that reacts like the keys beside it stops
 * reading as a foreign overlay.
 *
 * **The row is a `GlassGroup`, so the shapes MERGE.** Within
 * `GLASS_MERGE_DISTANCE` the timer, the mic and the hide-keyboard button stop
 * being three circles and become one piece of glass that stretches between them
 * — which is the truth about them: they are the three things that help you
 * write. The group replaced a raw `GlassContainer`, which had no fallback of its
 * own and would have kept containing glass for a user who had turned
 * transparency down.
 *
 * The merge is also why **the three circles are now a fixed 44 pt each and
 * always will be**: they are one object, and an object does not change shape
 * because a clock started. That was the old timer chip's actual defect, and
 * `rest-controls.tsx` has the whole story.
 *
 * Finish is deliberately outside both effects: it is solid brand with the app's
 * one coloured shadow, it is the committed action, and it may not soften into
 * the row it is meant to stand apart from.
 *
 * ## THE ROW IS MONOCHROME, AND COLOUR MEANS "SOMETHING IS HAPPENING"
 * ## (owner, 10 September 2026 — "make them look more like native iOS icons")
 *
 * From 20 August the three glyphs each took their own hue from `icon.tsx`'s
 * glyph→colour map — timer orange, mic teal, hide-keyboard slate — on the design
 * skill's §Structure rule, *"accessory buttons are coloured glyphs in white
 * circles"*. **At rest they are all ink now.** Three reasons, and the first is
 * the owner's:
 *
 * 1. **No iOS bar is three colours.** Notes' markup bar, Mail's format bar,
 *    Safari's toolbar: system accessory glyphs are one ink, and the tint is
 *    reserved for the thing that is currently ON. A row of three hues is the
 *    single loudest tell that a control was drawn by somebody other than Apple,
 *    and it sits directly above the system keyboard, where the comparison is
 *    literally one row away.
 * 2. **It contradicted the merge.** The `GlassGroup` above exists to say *these
 *    three are one instrument*. Three hues say *these three are three families*.
 *    One of the two had to go, and the merge is the true statement.
 * 3. **The repository had already decided this once.** `settings-rows.tsx`
 *    overrode the same map to monochrome ink for the same reason (owner,
 *    12 Aug): *"eleven different hues down the left edge read as eleven
 *    categories that do not exist."* Three hues across three buttons that share
 *    one job is the same sentence with smaller numbers.
 *
 * This is a SURFACE override, exactly as that one is: `GLYPH_TINT` is untouched
 * and every other call site keeps its colour, because the map is keyed by the
 * glyph and a tint is a property of the glyph, not of this row.
 *
 * **What colour now means here is state**, which is what it means on an iOS
 * bar: the rest ring runs brand blue while it is counting, the timer glyph goes
 * brand with it, and the mic inverts to solid ink while it listens. Nothing is
 * tinted for being itself. Planned green and red are still not in this set and
 * may never be added to it.
 *
 * ## The glyphs are SF SYMBOLS (owner, 20 Aug 2026)
 *
 * All three draw from Apple's own set on iOS (`timer`, `mic` / `mic.fill`,
 * `keyboard.chevron.compact.down`), with the Ionicons/MCI outlines kept as the
 * fallback everywhere else — one switch inside `icon.tsx`, no call site here
 * knows the difference. The reason is the same one that makes SF Pro the app's
 * face: **the platform's own set already carries the optical sizing, weight
 * matching and alignment a third-party outline can only approximate**, and
 * these three sit at `ACCESSORY_GLYPH` on glass over the system keyboard, where
 * a stroke half a point off reads as a foreign control. The mic is the one that
 * changes
 * state — it fills while it is listening, the same outline→filled contract the
 * ledger's note glyph already uses.
 *
 * **The circles stay white and the record stays ink**: no fill is tinted, no
 * number beside them changes, and the streak is still a reading in the top bar
 * and never a flame (§5.1, §5.7 — this is the app reporting, and a record does
 * not wink).
 *
 * THE STATUS PILL is the live count and tonnage ("4 staged · 3 240 kg"; parsed
 * volume once the background parse lands, an instant text estimate before
 * that), tapping through to Progress. The teaching tail ("— they count when you
 * finish") explains the record contract only until the first session is
 * finished, then retires for good.
 *
 * **It yields its row to a running rest** (10 Sep 2026). Only one of the two can
 * have that slot and rest is the one that is time-critical: the tonnage is a
 * number you can read at any moment of the session, and the rest is a number
 * that is only true for the next two minutes. They cross with `FadeSwap`, which
 * is the app's "a value updating once", so the exchange is legible rather than
 * a flicker.
 *
 * THE REST TIMER is `rest-controls.tsx` — a ring that never changes the row's
 * geometry, a bar with the reading and `+30 s` / `Skip`, and a rest that starts
 * itself when a set lands in the note. That file carries the reasoning.
 *
 * THE MIC dictates: on-device speech (never a cloud API) streams interim text
 * straight into the note, so the parse pipeline just works. While recording,
 * the button inverts to a solid ink fill.
 *
 * THE HIDE-KEYBOARD BUTTON puts the keyboard away without settling anything.
 * The note dismisses on an interactive scroll drag already, but that is a
 * gesture you have to know about, and the only LABELLED way down was Finish —
 * which ends the session. Reading back what you just wrote is not the same as
 * being done, and the bar should not make someone claim the second to get the
 * first. It can never be a dead control: the bar only exists while the keyboard
 * is up (§1.1 invariant 6).
 *
 * THE PLAN BUTTON IS GONE (owner, 20 Aug 2026). The labelled round that wrote
 * the next prescribed line into the note is removed from the bar. It was the
 * last of the plan on Today: the 18 Aug ruling took the read-only PLANNED strip
 * off this page and left the prescription reachable "on demand, over the
 * keyboard" — and on demand turned out to mean a fourth control standing in the
 * accessory row all session, wide enough to carry a word, for a line most days
 * never have. What the athlete is doing while that bar is up is WRITING; the
 * bar should hold the three things that help them write (time, voice, a way
 * down) and nothing that tells them what to write.
 *
 * The prescription is not lost — it is where §8 put it, in Next's brief — and
 * `checkGhostLine` (the store action this called) is untouched, because
 * `ghost-prediction.tsx` still writes a planned line through it.
 *
 * FINISH keeps its words. It is the one committed action on this screen and
 * §15 says a button says exactly what happens, so it stays a labelled ink pill
 * rather than becoming a glyph like the reference's round icons.
 */
export function BottomToolbar({
  bottomInset = 0,
  /**
   * Whether the athlete is writing RIGHT NOW — the keyboard being up.
   *
   * The toolbar stays mounted at rest (hidden) so a running rest keeps counting
   * when the keyboard closes, which means "mounted" is not the same as "in
   * use". The automatic rest needs the difference: a background parse landing
   * on a page nobody is looking at may not start a clock.
   */
  active = false,
}: {
  bottomInset?: number;
  active?: boolean;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const note = useCurrentNote();
  const setNote = useSession((s) => s.setNote);
  const parsedSnapshot = useSession((s) => s.parsedSnapshot);
  const parsedVolume = useSession((s) => s.parsedVolume);
  const receipt = useSession((s) => s.receipt);
  const selectedDay = useSession((s) => s.selectedDay);
  const userId = useSession((s) => s.userId);
  const workoutId = useSession((s) => s.workoutId);
  const openCheckIn = useSession((s) => s.openCheckIn);
  const finishSession = useSession((s) => s.finishSession);
  const total = parsedSnapshot === note ? parsedVolume : estimateVolume(note);
  // A run-only session totals in distance, not an empty count (kg still wins
  // when both exist — the mixed-session detail lives in the receipt).
  const distanceM = total === 0 && parsedSnapshot === note ? (receipt?.distanceM ?? 0) : 0;

  // What's STAGED = distinct parsed exercises on this day's note. Nothing is
  // recorded until the user finishes — the status line says so. A cleared
  // note stages nothing, even while the old parse lingers in memory.
  const staged =
    note.trim().length > 0 && receipt ? new Set(receipt.rows.map((r) => r.exercise)).size : 0;
  const canFinish = staged > 0;

  /**
   * The rest timer's one owner — it ticks, it fires the completion haptic, and
   * it starts the rest itself when a set lands in the note.
   *
   * The trigger is the parser's own counted-set total, which is the same number
   * the receipt prints: nothing about the rest is guessed from the raw text,
   * and nothing here writes to the note.
   */
  const rest = useRestEngine({
    totalSets: receipt?.totalSets ?? 0,
    dayKey: selectedDay,
    active,
  });

  const [recording, setRecording] = useState(false);
  // The record-contract tail teaches once; after a first finished session the
  // status line goes bare (a serious lifter doesn't need the caption twice).
  const [taughtDone, setTaughtDone] = useState(() => hasFinishedOnce());
  const dictation = useRef<DictationHandle | null>(null);
  // The note as it was when dictation started — interim results re-render the
  // utterance in place instead of stacking duplicates.
  const baseNote = useRef('');
  const reviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      dictation.current?.stop();
      if (reviewTimer.current) clearTimeout(reviewTimer.current);
    },
    [],
  );

  const handleMic = async () => {
    if (recording) {
      tapMedium();
      dictation.current?.stop();
      return;
    }

    tap();
    if (!voiceAvailable()) {
      Alert.alert(
        'Voice input',
        'Dictation needs the development build (npx expo run:ios) — it is not available in Expo Go.',
      );
      return;
    }

    baseNote.current = note.replace(/\s+$/, '');
    const handle = await startDictation({
      onTranscript: (text, final) => {
        const base = baseNote.current;
        const joined = base.length > 0 ? `${base}\n${text}` : text;
        setNote(joined);
        if (final) baseNote.current = joined; // next utterance starts a new line
      },
      onEnd: () => {
        dictation.current = null;
        setRecording(false);
      },
    });

    if (handle) {
      dictation.current = handle;
      setRecording(true);
    } else {
      Alert.alert('Voice input', 'Microphone or speech permission was not granted.');
    }
  };

  /**
   * Put the keyboard away without committing anything.
   *
   * The note already dismisses on an interactive scroll drag, but that is a
   * gesture you have to know about, and the only labelled way down was FINISH —
   * which settles the session. Wanting to read back what you have written is
   * not the same as being done training, and the app should not make someone
   * declare the second to get the first.
   *
   * Nothing is written here, so it is a light tap, not the committed-action
   * haptic (§5.6). Dictation deliberately keeps running: it never needed the
   * keyboard.
   */
  const handleHideKeyboard = () => {
    tap();
    Keyboard.dismiss();
  };

  // Finish = settle the eye on the ledger: keyboard down, receipt in view.
  // Nothing is written here — the receipt below the note IS the record. The
  // first finish also retires the status-line teaching tail for good.
  const handleFinish = () => {
    if (!canFinish) return;
    tapMedium();
    if (!taughtDone) {
      markFinishedOnce();
      setTaughtDone(true);
    }
    // §13: "first workout finished". A local counter, impossible to backfill —
    // the first hundred installs happen once.
    markFirstWorkoutFinished();
    // The session is settled: the resting pill stops reporting a live set and
    // goes back to the day's totals, and the reflection row appears under the
    // ledger. Writing another line re-opens it (session-store).
    finishSession();
    // A finished session changed this week's numbers — the pending §12.1 recap
    // notice re-computes so Sunday's text stays true. No-op while it is off.
    if (userId) void refreshRecapNotification(userId);
    // THE SESSION IS OVER, SO THE REST IS OVER. A rest is the gap before the
    // next set and Finish says there is no next set — leaving one counting (and
    // a pocket alert pending) would have the app ring after training, about
    // nothing. It matters most for the end-of-session dump, where a whole
    // workout typed at once restarts the rest on every line it parses.
    rest.onFinishSession();
    Keyboard.dismiss();
    revealReceipt(!reduceMotion);

    // The check-in (§8.1): a few words about how it went, plus the effort
    // scale. Opened here and nowhere else on the automatic path — the honest
    // moment to ask is the one where the session just landed. It is optional,
    // it carries a real Skip, and it is reachable again later from the receipt
    // for anyone who answers on the train home. It never blocks the save: the
    // session is already on disk by the time this opens.
    openCheckIn();

    // The App Store review prompt — the ONLY place it is ever requested
    // (`src/lib/review/`). It waits for the receipt to settle first: the system
    // sheet appearing on top of the ledger the user just earned would cover the
    // one thing that made the moment worth rating. `maybeAskForReview` decides
    // for itself and stays silent for almost every finish; nothing here may
    // branch on the answer.
    if (userId) {
      const prToday = receipt?.rows.some((r) => r.signal?.kind === 'pr') ?? false;
      if (reviewTimer.current) clearTimeout(reviewTimer.current);
      reviewTimer.current = setTimeout(() => {
        reviewTimer.current = null;
        // Never over the check-in. The system review sheet would land on
        // top of a question the user is in the middle of answering, and Apple
        // gives us no callback to wait on. Skipping costs nothing — the prompt
        // is silent for almost every finish anyway and this one comes round
        // again next time.
        if (useSession.getState().checkInOpen) return;
        void maybeAskForReview({ userId, workoutId, prToday });
      }, REVIEW_PROMPT_DELAY_MS);
    }
  };

  // The status line names the contract; tonnage rides along (folds the old
  // volume pill in) and the line still routes to /stats.
  const tonnage =
    total > 0
      ? ` · ${groupThousands(total)} kg`
      : distanceM > 0
        ? ` · ${formatDistanceTotal(distanceM)}`
        : '';
  // The teaching tail is training wheels — shown only until the first finish.
  const tail = taughtDone
    ? ''
    : staged === 1
      ? ' — it counts when you finish'
      : ' — they count when you finish';
  const status =
    note.trim().length === 0
      ? null
      : staged === 0
        ? 'nothing staged yet'
        : `${staged} staged${tonnage}${tail}`;

  /** The rest owns row 1 whenever it has something to report. */
  const resting = rest.mode !== 'idle';

  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset }]}>
      {/* ROW 1 — whichever of the two readings is the one that matters now.
          `FadeSwap` keys on which, so the exchange is the app's one sanctioned
          "a value updating once" rather than a pop. */}
      {resting || status ? (
        <FadeSwap swapKey={resting ? 'rest' : 'status'}>
          {resting ? (
            <RestBar engine={rest} />
          ) : (
            <GlassPressable
              onPress={() => router.push('/progress')}
              hitSlop={spacing.xs}
              activeScale={0.98}
              radius={radius.pill}
              style={styles.statusPill}
              contentStyle={styles.statusPillContent}
              accessibilityLabel={`${status}. Open progress`}>
              <Text
                style={styles.statusText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {status}
              </Text>
            </GlassPressable>
          )}
        </FadeSwap>
      ) : null}

      <GlassGroup style={styles.row}>
        <RestRing engine={rest} />

        <GlassPressable
          onPress={() => void handleMic()}
          haptic="none"
          activeScale={0.92}
          radius={ROUND / 2}
          style={styles.round}
          contentStyle={styles.roundContent}
          // Listening = the app has taken the button over: solid ink, no glass.
          solidFill={recording ? color.accent : undefined}
          accessibilityLabel={recording ? 'Stop dictation' : 'Dictate'}>
          {/* Outline at rest, FILLED while it listens — the glyph carries the
              state, not only the ink circle behind it (`note`/`note-on` set
              the pattern). */}
          <Icon
            name={recording ? 'mic-on' : 'mic'}
            size={ACCESSORY_GLYPH}
            tint={recording ? color.onInk : color.textPrimary}
          />
        </GlassPressable>

        {/* The last of the three, and the row no longer has a member that
            comes and goes (the plan button did) — so nothing here ever moves
            under the thumb mid-session. */}
        <GlassPressable
          onPress={handleHideKeyboard}
          haptic="none"
          activeScale={0.92}
          radius={ROUND / 2}
          style={styles.round}
          contentStyle={styles.roundContent}
          accessibilityLabel="Hide keyboard">
          <Icon name="keyboard-hide" size={ACCESSORY_GLYPH} tint={color.textPrimary} />
        </GlassPressable>

        <PressableScale
          disabled={!canFinish}
          haptic="none"
          activeScale={0.98}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canFinish }}
          onPress={handleFinish}
          style={[styles.finish, !canFinish && styles.finishDisabled]}
          pressedStyle={canFinish ? styles.finishPressed : undefined}>
          <Text
            style={styles.finishLabel}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Finish session
          </Text>
        </PressableScale>
      </GlassGroup>
    </View>
  );
}

/** The round buttons' diameter — a real 44 pt target, never smaller (§14). */
const ROUND = HIT;
/** Long enough for the receipt to scroll into view and be read as a receipt,
 * short enough to still belong to the same gesture. */
const REVIEW_PROMPT_DELAY_MS = 1400;
const styles = StyleSheet.create({
  // No bar: the shapes FLOAT over the keyboard. No background, no top border —
  // that strip is what the reference replaced, and glass needs something behind
  // it to refract or it is just a grey rectangle.
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  statusPill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  statusPillContent: {
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
  round: {
    minWidth: ROUND,
  },
  roundContent: {
    height: ROUND,
    minWidth: ROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finish: {
    marginLeft: 'auto',
    height: ROUND,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
    // The primary action on this screen, so it wears the app's one coloured
    // shadow rather than the neutral sheet cast. It stays 44 tall rather than
    // `CTA_HEIGHT` 56 because it sits IN the accessory row: the four circles
    // beside it are 44 pt targets, and a 56 pt pill among them would be a
    // second bar. This is the compact case the height rule leaves open.
    ...shadow.glow,
  },
  finishPressed: {
    backgroundColor: color.brandPressed,
  },
  finishDisabled: {
    opacity: ink.disabled,
  },
  finishLabel: {
    color: color.onInk,
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
  },
});
