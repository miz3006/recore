import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Row, Section } from '@/components/settings-rows';
import { tap } from '@/lib/haptics';
import {
  disableHealthWrite,
  enableHealthWrite,
  forgetHealthWrites,
  healthCounts,
  healthState,
  isHealthSupported,
  sweepHealth,
  type HealthState,
} from '@/lib/health/index';
import { PAPER_FIELD_CSS } from '@/lib/paper-field';
import {
  color,
  lineFor,
  MAX_FONT_SCALE,
  spacing,
  TAB_BAR_CLEARANCE,
  type,
} from '@/lib/theme';
import { useSession } from '@/state/session-store';

/**
 * APPLE HEALTH — one switch, one direction, and it moves real data.
 *
 * ## What this screen used to be, and why it changed (17 September 2026)
 *
 * It was an honest "not connected": there was no HealthKit anywhere in the
 * repository, so a toggle here would have been a switch that stored a flag
 * while nothing moved — "a fabricated feature", forbidden by CLAUDE.md §3
 * "anywhere, including placeholders". The reasoning in that version was right
 * and is worth keeping: health data is the worst category to fake a feature in,
 * because a person who believes their training is going to Health stops
 * checking.
 *
 * The switch is here now because the thing behind it is here now:
 * `@kingstinct/react-native-healthkit`, the `com.apple.developer.healthkit`
 * entitlement and `NSHealthUpdateUsageDescription` (all three from `app.json`,
 * since `ios/` is generated), and `lib/health/` — which holds both the rules
 * (`plan.ts`, pure and unit-tested) and the only HealthKit calls in the app.
 *
 * ## The direction is OUT, and this screen says so three times
 *
 * Finished sessions are written to Health as workouts. Nothing is read. That
 * was the safe half of the old file's own TODO and it stays the whole feature:
 * Recore asks for no read permission, holds none, and the sheet iOS presents
 * when the switch is flipped has only a write section on it.
 *
 * The read half — bodyweight, "so you do not have to type it twice" — is
 * deliberately NOT here. Nothing in the app reads a bodyweight today:
 * `getBodyWeightKg` has no callers, because product-direction §11's editable
 * body context does not exist as a surface yet. A switch that pulls somebody's
 * weight out of Health into a field no screen shows is the fabricated feature
 * this file was written to avoid, pointed the other way round — and asking for
 * Health READ access with nothing to use it for is also the kind of request
 * App Review declines. It becomes possible the day §11's body context ships.
 *
 * ## What the screen is allowed to claim
 *
 * Only what the ledger can prove (`db/health-writes.ts`). "Recore has written
 * N sessions to Health" is a count of rows this device wrote and HealthKit
 * accepted — not a count of what Health currently holds, because a person can
 * delete Recore's data from inside the Health app and this app is never told.
 * The wording stays on the side of what Recore DID, not what Health HAS.
 */
export default function Health() {
  const userId = useSession((s) => s.userId);

  /** Permission, from HealthKit. Null until the first read resolves — the
   * counts render immediately and this arrives a tick later. */
  const [state, setState] = useState<HealthState | null>(null);
  const [counts, setCounts] = useState(() => (userId ? healthCounts(userId) : null));
  const [busy, setBusy] = useState(false);
  /** The last thing that happened, in a sentence, under the switch. */
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (userId) setCounts(healthCounts(userId));
  }, [userId]);

  /**
   * FOCUS IS THE TRIGGER. A sweep can land while this screen is off-stage — a
   * parse finishing, a session finished on Today — and a plain `useEffect`
   * would leave the counts frozen at whatever they were when the screen first
   * mounted. The tab stays mounted behind the navigation, so this is the only
   * hook that runs again when somebody comes back to look.
   */
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      refresh();
      void healthState().then((next) => {
        if (alive) setState(next);
      });
      return () => {
        alive = false;
      };
    }, [refresh]),
  );

  const supported = isHealthSupported();
  const enabled = counts?.enabled ?? false;
  /** The switch is live only once we know Health will take a write. */
  const on = enabled && state === 'granted';

  const toggle = useCallback(
    (next: boolean) => {
      if (!userId || busy) return;
      tap();
      setMessage(null);

      if (!next) {
        disableHealthWrite();
        setMessage('Recore has stopped writing. The sessions already in Health stay there.');
        refresh();
        return;
      }

      setBusy(true);
      void (async () => {
        const result = await enableHealthWrite();
        setState(result);
        if (result !== 'granted') {
          setBusy(false);
          refresh();
          setMessage(
            result === 'denied'
              ? 'Health is not letting Recore add workouts. iOS only asks once, so this one has to be changed in Settings → Health → Data Access & Devices → Recore.'
              : 'Health is not available on this device.',
          );
          return;
        }
        // Granted — carry across whatever is already finished and waiting,
        // right now, so the switch has a visible result.
        const sweep = await sweepHealth(userId);
        setBusy(false);
        refresh();
        setMessage(sweepSentence(sweep.written, sweep.remaining));
      })();
    },
    [busy, refresh, userId],
  );

  const writeNow = useCallback(() => {
    if (!userId || busy) return;
    tap();
    setBusy(true);
    setMessage(null);
    void (async () => {
      const sweep = await sweepHealth(userId);
      setBusy(false);
      refresh();
      setMessage(sweepSentence(sweep.written, sweep.remaining));
    })();
  }, [busy, refresh, userId]);

  /**
   * THE REPAIR, AND IT IS NOT AN UNDO. It forgets what this device wrote so
   * every finished session can go again — for the person who cleared Recore's
   * data from inside the Health app. The Alert says the cost out loud, because
   * for anybody who did NOT clear it the result is a duplicate of every
   * session, and Health has no merge.
   */
  const forget = useCallback(() => {
    if (!userId || busy) return;
    tap();
    Alert.alert(
      'Write every session again?',
      'Recore will forget which sessions it has already written and offer all of them to Health again. If you did not delete Recore’s data from the Health app first, you will get a second copy of every session.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget and rewrite',
          style: 'destructive',
          onPress: () => {
            const dropped = forgetHealthWrites(userId);
            refresh();
            setMessage(
              dropped === 0
                ? 'There was nothing to forget.'
                : `Forgot ${dropped} ${dropped === 1 ? 'session' : 'sessions'}. Turn the switch off and on, or use “Write waiting sessions”, to send them again.`,
            );
          },
        },
      ],
    );
  }, [busy, refresh, userId]);

  const openSettings = useCallback(() => {
    tap();
    void Linking.openURL('app-settings:').catch(() => {});
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'Apple Health', headerLargeTitle: true }} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        {supported ? (
          <>
            <Section
              label="Your sessions in Health"
              footnote={message ?? statusFootnote(state, enabled, counts?.pending ?? 0)}
              footnoteActive={message != null}>
              <Row
                icon="target"
                label="Write sessions to Health"
                sub="Each finished session goes across as a workout — when it started, how long it ran"
                toggle={{ value: on, onChange: toggle, disabled: busy || !userId }}
                accessibilityLabel="Write finished sessions to Apple Health"
              />
              {on ? (
                <Row
                  divider
                  icon="upload"
                  label={busy ? 'Writing…' : 'Write waiting sessions'}
                  value={waitingValue(counts?.pending ?? 0)}
                  disabled={busy || (counts?.pending ?? 0) === 0}
                  chevron={false}
                  onPress={writeNow}
                />
              ) : null}
              {state === 'denied' ? (
                <Row
                  divider
                  icon="gear"
                  label="Open Settings"
                  sub="Health → Data Access & Devices → Recore"
                  external
                  chevron={false}
                  onPress={openSettings}
                />
              ) : null}
            </Section>

            <Section label="What crosses" footnote={writtenFootnote(counts?.written ?? 0)}>
              <View style={styles.block}>
                <Text style={styles.lede} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  A start, an end, and the kind of training.
                </Text>
                <Text style={styles.para} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  Nothing else. Recore does not write a calorie figure, because it cannot measure
                  one — a number it made up would be added to your day’s totals and read as
                  measured by every other app on your phone. It does not write distances for the
                  same reason.
                </Text>
                <Text style={styles.para} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  Your words never leave this app. Not the note, not the reflection, not a lift
                  name — Health receives a workout, not your record.
                </Text>
                <Text style={styles.para} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  A session only crosses once you finish it, and only when its start and end make
                  sense as a session — between ten minutes and six hours. A note typed from memory
                  afterwards is a good note, but it is not a timed workout, so it stays here.
                </Text>
              </View>
            </Section>

            <Section
              label="Nothing comes back"
              footnote="Your record is complete and portable without Health either way: You → Your record → Export my record carries every session, including the words you wrote.">
              <View style={styles.block}>
                <Text style={styles.para} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  Recore reads nothing from Health. It never asks for permission to, so nothing in
                  Health can add a set, change a load, or put a day in your record that you did not
                  train.
                </Text>
                <Text style={styles.para} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  Turning the switch off stops Recore adding anything new. Sessions already in
                  Health stay there — they are yours, and deleting them is done from the Health
                  app.
                </Text>
              </View>
            </Section>

            {counts && counts.written > 0 ? (
              <Section label="If you cleared Recore from Health">
                <Row
                  icon="trash"
                  label="Write every session again"
                  sub="Forgets what Recore has already sent, so all of it can go again"
                  warn
                  chevron={false}
                  disabled={busy}
                  onPress={forget}
                />
              </Section>
            ) : null}
          </>
        ) : (
          <Section label="Not available">
            <View style={styles.block}>
              <Text style={styles.lede} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Apple Health is on iPhone.
              </Text>
              <Text style={styles.para} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                This device has no Health app for Recore to write to. Your record is complete
                without it: You → Your record → Export my record.
              </Text>
            </View>
          </Section>
        )}
      </ScrollView>
    </>
  );
}

/** "3 sessions written. 12 still waiting." — the result of a sweep, counted,
 * never rounded and never congratulated. */
function sweepSentence(written: number, remaining: number): string {
  if (written === 0 && remaining === 0) return 'Nothing was waiting.';
  const first =
    written === 0
      ? 'Nothing went across this time.'
      : `${written} ${written === 1 ? 'session' : 'sessions'} written to Health.`;
  if (remaining === 0) return first;
  return `${first} ${remaining} still waiting — tap again to carry on.`;
}

function waitingValue(pending: number): string {
  if (pending === 0) return 'None waiting';
  return `${pending} waiting`;
}

/** The quiet line under the switch when nothing has just happened. */
function statusFootnote(
  state: HealthState | null,
  enabled: boolean,
  pending: number,
): string | undefined {
  if (state == null) return undefined;
  if (state === 'unavailable') return 'Health is not available on this device.';
  if (enabled && state === 'denied') {
    return 'Health is not letting Recore add workouts. Change it in Settings → Health → Data Access & Devices → Recore.';
  }
  if (!enabled) return 'Off. Recore is not writing anything to Health.';
  if (pending > 0) return `${pending} finished ${pending === 1 ? 'session is' : 'sessions are'} waiting to go across.`;
  // What Recore DID, not what Health HAS — see the header.
  return 'Every finished session has been written.';
}

/** What the ledger can honestly say — see the header on why this is phrased as
 * what Recore wrote and not as what Health holds. */
function writtenFootnote(written: number): string {
  if (written === 0) return 'Recore has not written anything to Health from this iPhone yet.';
  return `Recore has written ${written} ${written === 1 ? 'session' : 'sessions'} to Health from this iPhone.`;
}

const styles = StyleSheet.create({
  /**
   * THE CANVAS IS THE SCROLL VIEW'S OWN BACKGROUND, and that is the whole
   * reason this screen can have both a paper canvas and a collapsing title.
   * `(tabs)/next/_layout.tsx` has the measurement.
   */
  scroll: {
    flex: 1,
    experimental_backgroundImage: PAPER_FIELD_CSS,
  },
  /** ONE GUTTER, `spacing.lg` — the system's large title hangs off its own
   * inset, and content further in would give the page two left edges. */
  body: {
    paddingHorizontal: spacing.lg,
    // The top is UIKit's now (`contentInsetAdjustmentBehavior`), but the bottom
    // is not: content scrolls BEHIND the glass tab bar so the bar has something
    // to refract, and the last line clears it by hand.
    paddingBottom: spacing.huge + TAB_BAR_CLEARANCE,
  },
  block: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  lede: {
    ...type.headline,
    color: color.textPrimary,
  },
  para: {
    ...type.subhead,
    lineHeight: lineFor(21),
    color: color.textSecondary,
  },
});
