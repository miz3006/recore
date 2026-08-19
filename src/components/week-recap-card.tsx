import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { getMeta, setMeta } from '@/lib/db/index';
import { getAllTimePRs } from '@/lib/db/insights';
import { getStatsSummary, mondayOf } from '@/lib/db/stats';
import { todayKey } from '@/lib/db/dates';
import { tap } from '@/lib/haptics';
import { groupThousands } from '@/lib/parse/estimate';
import { getRecapIntent, isRecapEnabled } from '@/lib/prefs';
import { enableRecap } from '@/lib/recap';
import { color, fonts, MAX_FONT_SCALE, moderateScale, radius, spacing, type } from '@/lib/theme';
import { useSession } from '@/state/session-store';

import { MonoTag, PrLabel } from './gutter-value';
import { Icon } from './icon';

/**
 * The weekly recap (§12.1), in the card vocabulary: it greets the FIRST empty
 * open of a new week with last week's tonnage, sessions, the week-over-week
 * delta as an archival muted figure (never a celebration colour), and any
 * all-time PRs set that week wearing the neutral outlined label. One Share,
 * one Done — then it's gone until next Monday. Silence when last week didn't
 * train.
 *
 * It is also where the §12.1 notification is OFFERED, exactly as onboarding
 * promised ("We'll ask for permission once your first recap is ready — not
 * before"): a person who answered yes sees one quiet action here; tapping it
 * asks the OS in context and turns the Sunday notice on. Everyone keeps full
 * control in You → Weekly recap.
 */
const seenKey = (weekStart: string) => `recap_seen:${weekStart}`;

export function WeekRecapCard() {
  const userId = useSession((s) => s.userId);
  const selectedDay = useSession((s) => s.selectedDay);
  const reduceMotion = useReducedMotion();
  const cardRef = useRef<View>(null);
  const [dismissed, setDismissed] = useState(false);
  const [branding, setBranding] = useState(false);
  // The §12.1 notification offer: only for someone who said yes in onboarding
  // and hasn't turned it on yet. A denial hides it for good — control stays
  // in You, and this card never asks twice.
  const [notifState, setNotifState] = useState<'offer' | 'on' | 'hidden'>(() =>
    isRecapEnabled() ? 'hidden' : getRecapIntent() === 'yes' ? 'offer' : 'hidden',
  );

  const handleEnableNotif = async () => {
    tap();
    if (!userId) return;
    const on = await enableRecap(userId);
    setNotifState(on ? 'on' : 'hidden');
  };

  const recap = useMemo(() => {
    if (!userId) return null;
    // Today only — browsing an old empty day is history, not a Monday ritual.
    if (selectedDay !== todayKey()) return null;
    const thisMonday = mondayOf(todayKey());
    if (getMeta(seenKey(thisMonday)) === '1') return null;

    const summary = getStatsSummary(userId);
    const lastWeek = summary.weeks[summary.weeks.length - 2];
    const weekBefore = summary.weeks[summary.weeks.length - 3];
    if (!lastWeek || lastWeek.sessions === 0) return null;

    const delta =
      weekBefore && weekBefore.volume > 0 && lastWeek.volume > 0
        ? Math.round(((lastWeek.volume - weekBefore.volume) / weekBefore.volume) * 100)
        : null;

    // All-time bests whose date fell inside last week — the PRs that stuck.
    const prs = getAllTimePRs(userId, 1000).filter(
      (pr) => pr.day >= lastWeek.weekStart && pr.day < thisMonday,
    );

    return { thisMonday, lastWeek, delta, prs };
  }, [userId, selectedDay]);

  if (!recap || dismissed) return null;

  const dismiss = () => {
    tap();
    setMeta(seenKey(recap.thisMonday), '1');
    setDismissed(true);
  };

  const handleShare = async () => {
    tap();
    setBranding(true);
    await new Promise((r) => setTimeout(r, 80));
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      // view-shot returns file:// on Android but a bare path on iOS.
      const url = uri.startsWith('file://') ? uri : `file://${uri}`;
      await Sharing.shareAsync(url, { mimeType: 'image/png', UTI: 'public.png' });
    } catch {
      // sharing is a bonus, never an error surface
    } finally {
      setBranding(false);
    }
  };

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(260)}>
      <View ref={cardRef} collapsable={false} style={styles.card}>
        <View style={styles.header}>
          <MonoTag label="LAST WEEK" />
          {!branding ? (
            <Pressable
              onPress={() => void handleShare()}
              hitSlop={spacing.sm}
              style={({ pressed }) => pressed && styles.sharePressed}>
              <Icon name="share" size={moderateScale(15)} tint={color.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.value} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {recap.lastWeek.volume > 0 ? (
            <>
              {groupThousands(recap.lastWeek.volume)}
              <Text style={styles.unit}> kg</Text>
            </>
          ) : (
            <>
              {String(recap.lastWeek.sessions)}
              <Text style={styles.unit}>
                {recap.lastWeek.sessions === 1 ? ' session' : ' sessions'}
              </Text>
            </>
          )}
        </Text>

        <Text style={styles.meta} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {recap.lastWeek.sessions} {recap.lastWeek.sessions === 1 ? 'session' : 'sessions'}
          {recap.delta != null ? (
            <Text style={styles.delta}>
              {'  '}
              {recap.delta > 0
                ? `+${recap.delta}% vs week before`
                : recap.delta < 0
                  ? `-${Math.abs(recap.delta)}% vs week before`
                  : 'same as week before'}
            </Text>
          ) : null}
        </Text>

        {recap.prs.length > 0 ? (
          <View style={styles.prs}>
            {recap.prs.slice(0, 3).map((pr) => (
              <View key={pr.canonical} style={styles.prRow}>
                <PrLabel />
                <Text style={styles.prLine} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {pr.canonical} · {pr.weightKg} kg
                  {pr.reps != null ? ` × ${pr.reps}` : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {branding ? (
          <Text style={styles.brand} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Recore
          </Text>
        ) : (
          <>
            {notifState === 'offer' ? (
              <Pressable
                onPress={() => void handleEnableNotif()}
                accessibilityRole="button"
                style={({ pressed }) => [styles.notifOffer, pressed && styles.donePressed]}>
                <Text style={styles.notifOfferLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  Get this as a Sunday notification
                </Text>
              </Pressable>
            ) : notifState === 'on' ? (
              <Text style={styles.notifOn} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Weekly notification is on — the time is yours to change in You.
              </Text>
            ) : null}
            <Pressable
              onPress={dismiss}
              style={({ pressed }) => [styles.done, pressed && styles.donePressed]}>
              <Text style={styles.doneLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Done
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sharePressed: {
    opacity: 0.5,
  },
  value: {
    ...type.statNumber,
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
    color: color.textSecondary,
  },
  meta: {
    marginTop: 2,
    fontFamily: fonts.reading,
    fontSize: moderateScale(10.5),
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  // The archival comparison voice — words + figure, never lime.
  delta: {
    color: color.textMuted,
  },
  prs: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  prLine: {
    flexShrink: 1,
    fontFamily: fonts.reading,
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  notifOffer: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  notifOfferLabel: {
    fontSize: type.caption.fontSize,
    fontWeight: '600',
    color: color.textPrimary,
  },
  notifOn: {
    marginTop: spacing.md,
    fontSize: type.caption.fontSize,
    color: color.textMuted,
  },
  done: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  donePressed: {
    opacity: 0.6,
  },
  doneLabel: {
    fontSize: type.caption.fontSize,
    fontWeight: '600',
    color: color.textSecondary,
  },
  brand: {
    marginTop: spacing.md,
    textAlign: 'right',
    fontSize: type.caption.fontSize,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: color.textMuted,
  },
});
