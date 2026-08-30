import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { screenById } from '@/components/onboarding-v2/flow';
import { GhostRow } from '@/components/onboarding-v2/GhostRow';
import { OptionRow } from '@/components/onboarding-v2/OptionRow';
import { AppButton, Eyebrow } from '@/components/primitives';
import { Segmented } from '@/components/settings-rows';
import { SheetGrabber } from '@/components/sheet-grabber';
import { recapChoiceFor } from '@/lib/onboarding-v2-map';
import {
  getRecapDay,
  getRecapHour,
  isRecapEnabled,
  setRecapDay,
  setRecapHour,
  setRecapIntent,
  type RecapDay,
} from '@/lib/prefs';
import { disableRecap, enableRecap, refreshRecapNotification } from '@/lib/recap';
import { color, MAX_FONT_SCALE, radius, spacing, type } from '@/lib/theme';

/**
 * THE WEEKLY RECAP, EDITED WHERE IT WAS ANSWERED (28 August 2026).
 *
 * The v2 flow's screen 20 asks "when should it land?" and offers Sunday evening,
 * Monday morning or nothing. **Profile could not show the answer.** Its row read
 * `Sundays 18:00` for everybody, hard-coded, because it predated the day being
 * an answer at all — so somebody who chose Monday morning in onboarding, and got
 * a Monday-morning notification, opened this screen and was told it arrives on
 * Sunday. `lib/recap.ts` has scheduled on `getRecapDay()` since the flow became
 * primary; this surface was the last one still asserting the old default, and a
 * settings screen that misreports a live setting is the §2 rule 5 problem in its
 * smallest form.
 *
 * The two day rows are the flow's OWN options, read from `flow.ts` — same
 * wording, same order, same marks — so the picker cannot drift from the screen
 * that asked. `recapChoiceFor` turns the tap into the day and the hour, which is
 * the same function `commitV2Onboarding` uses, so onboarding and Profile can
 * never disagree about what "Sunday evening" means.
 *
 * ## Why it does not close on the tap
 *
 * `AnswerSheet` and `PrefSheet` close a beat after a choice: one value, one tap,
 * done. This one has a second control under it — the hour — and turning it on
 * can take a system permission dialog. Closing out from under either would be
 * wrong, so it closes on Done, the way `LiftsSheet` does.
 *
 * ## The hour is a refinement, not a second question
 *
 * Picking a day writes that day's canonical hour (18:00 / 08:00). The hour
 * control below then moves it, and only the hour — the day stays what was
 * tapped. Re-tapping the day you already have leaves your hour alone, because
 * silently resetting a value somebody deliberately changed is the sort of thing
 * that makes a settings screen feel unsafe.
 *
 * ## "On" is never claimed unless iOS granted it
 *
 * `enableRecap` asks in context and returns whether the feature can actually
 * fire. A false answer leaves the switch off and says why, in the sheet, rather
 * than showing an On that can never deliver anything (§2 rule 5).
 */

/** The hours the recap can land on. Four sensible slots, not a 24-row picker —
 * this is a weekly read, and the exact minute has never mattered. */
const HOUR_SEG: { id: number; label: string }[] = [8, 12, 18, 20].map((h) => ({
  id: h,
  label: `${String(h).padStart(2, '0')}:00`,
}));

/**
 * What the Profile row prints on the right — the day INCLUDED, which is the
 * whole point of this file. Off is off; on is the day and the hour it will
 * actually arrive at.
 */
export function recapRowValue(): string {
  if (!isRecapEnabled()) return 'Off';
  const day = getRecapDay() === 'mon' ? 'Mondays' : 'Sundays';
  return `${day} ${String(getRecapHour()).padStart(2, '0')}:00`;
}

/** The flow's own recap options, split into the two real days and the opt-out. */
const RECAP_OPTIONS = screenById('recap')?.options ?? [];
const DAY_OPTIONS = RECAP_OPTIONS.filter((o) => !o.optOut);

export function RecapSheet({
  visible,
  onClose,
  onChange,
  userId,
}: {
  visible: boolean;
  onClose: () => void;
  /** The row above needs to re-read its value. */
  onChange: () => void;
  /** Null before a session exists — the sheet then says so rather than
   * scheduling a notice for nobody. */
  userId: string | null;
}) {
  const [on, setOn] = useState(false);
  const [day, setDay] = useState<RecapDay>('sun');
  const [hour, setHour] = useState(18);
  const [note, setNote] = useState<string | null>(null);

  // Re-read on every open: the recap can have been enabled from Today's own
  // offer card since the last time this sheet was looked at.
  useEffect(() => {
    if (!visible) return;
    setOn(isRecapEnabled());
    setDay(getRecapDay());
    setHour(getRecapHour());
    setNote(null);
  }, [visible]);

  /** Which row is filled. Off is a real answer and fills the ghost row. */
  const selected = !on ? 'never' : day === 'mon' ? 'monday' : 'sunday';

  const pickDay = async (optionId: string) => {
    if (!userId) return;
    const choice = recapChoiceFor(optionId);
    if (!choice || choice.intent !== 'yes') return;
    setNote(null);

    // Intent is what the person wants, not only what they once said in
    // onboarding — Today's offer card reads it, and it must not re-offer a
    // recap that was just turned on here, or on one that was just turned off.
    setRecapIntent('yes');
    const dayChanged = choice.day !== getRecapDay();
    setRecapDay(choice.day);
    setDay(choice.day);
    if (dayChanged || !on) {
      setRecapHour(choice.hour);
      setHour(choice.hour);
    }

    const ok = await enableRecap(userId); // asks iOS, schedules, or stays off
    setOn(ok);
    if (!ok) {
      setNote('Notifications are off for Recore in iOS Settings. Allow them there, then choose again.');
    }
    onChange();
  };

  const turnOff = async () => {
    setNote(null);
    setRecapIntent('no');
    await disableRecap();
    setOn(false);
    onChange();
  };

  const pickHour = (h: number) => {
    setRecapHour(h);
    setHour(h);
    if (userId) void refreshRecapNotification(userId);
    onChange();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetStyle={styles.sheet}>
      <SheetGrabber />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <Text
          style={styles.headline}
          accessibilityRole="header"
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Weekly recap
        </Text>
        <Text style={styles.subline} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          One short read on your week. When should it land?
        </Text>

        <View style={styles.options}>
          {DAY_OPTIONS.map((option) => (
            <OptionRow
              key={option.id}
              label={option.label}
              icon={option.icon}
              selected={selected === option.id}
              onPress={() => void pickDay(option.id)}
            />
          ))}
          {/* The flow words this "No thanks", which is an answer to a question
              being asked for the first time. Here it is a switch somebody is
              coming back to, and the honest label for that is what it does. */}
          <GhostRow
            label="Don’t send it"
            selected={selected === 'never'}
            onPress={() => void turnOff()}
          />
        </View>

        {on ? (
          <View style={styles.block}>
            <Eyebrow tone="secondary">Time</Eyebrow>
            <View style={styles.hours}>
              <Segmented options={HOUR_SEG} selected={hour} onSelect={pickHour} reading />
            </View>
            {/* WHAT THE ROW ABOVE CANNOT SAY IN TWO WORDS (21 Aug 2026).
                `Sundays 18:00` reads as a standing weekly promise — but
                `lib/recap.ts` schedules ONE dated notification and re-arms it
                when Today mounts or a session is finished, because the body
                carries this week's own count and a repeating trigger would
                deliver a stale number. So the value stays true and the
                mechanism is stated where somebody deciding actually reads it.
                Neutral on purpose: §2 rule 6 rules out making a missed week
                feel like a lapse. */}
            <Text style={styles.note} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              The next one is scheduled each time you open Recore, so it follows the weeks you use
              it.
            </Text>
          </View>
        ) : null}

        {note ? (
          <Text style={[styles.note, styles.noteActive]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {note}
          </Text>
        ) : null}

        <AppButton label="Done" variant="secondary" compact onPress={onClose} style={styles.done} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    paddingBottom: spacing.lg,
    maxHeight: '88%',
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
  block: {
    marginTop: spacing.lg,
  },
  hours: {
    marginTop: spacing.sm,
  },
  note: {
    ...type.footnote,
    color: color.textMuted,
    marginTop: spacing.sm,
  },
  noteActive: {
    color: color.textSecondary,
  },
  done: {
    marginTop: spacing.xl,
  },
});
