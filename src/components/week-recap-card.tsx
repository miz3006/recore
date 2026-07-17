import { useMemo, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';

import { getMeta, setMeta } from '@/lib/db/index';
import { getAllTimePRs } from '@/lib/db/insights';
import { getStatsSummary, mondayOf } from '@/lib/db/stats';
import { todayKey } from '@/lib/db/dates';
import { tap } from '@/lib/haptics';
import { groupThousands } from '@/lib/parse/estimate';
import { alpha, color, ink, MAX_FONT_SCALE, moderateScale, radius, spacing, type } from '@/lib/theme';
import { useSession } from '@/state/session-store';

import { Icon } from './icon';

/**
 * The weekly recap (research: the one push serious lifters tolerate; the
 * memory layer is what retains paying users). No notifications yet — the
 * recap greets the FIRST empty open of a new week instead: last week's
 * tonnage, sessions, the week-over-week delta in the machine's ink, and any
 * all-time PRs set that week. One Share (dark PNG), one Done — then it's
 * gone until next Monday. Silence when last week didn't train.
 */
const seenKey = (weekStart: string) => `recap_seen:${weekStart}`;

export function WeekRecapCard() {
  const userId = useSession((s) => s.userId);
  const reduceMotion = useReducedMotion();
  const cardRef = useRef<View>(null);
  const [dismissed, setDismissed] = useState(false);
  const [branding, setBranding] = useState(false);

  const recap = useMemo(() => {
    if (!userId) return null;
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
    const prs = getAllTimePRs(userId, 50).filter(
      (pr) => pr.day >= lastWeek.weekStart && pr.day < thisMonday,
    );

    return { thisMonday, lastWeek, delta, prs };
  }, [userId]);

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
      await Share.share({ url: uri });
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
          <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            LAST WEEK
          </Text>
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
            <Text style={recap.delta >= 0 ? styles.deltaUp : styles.deltaDown}>
              {'  '}
              {recap.delta >= 0 ? '↑' : '↓'} {Math.abs(recap.delta)}%
            </Text>
          ) : null}
        </Text>

        {recap.prs.length > 0 ? (
          <View style={styles.prs}>
            {recap.prs.slice(0, 3).map((pr) => (
              <Text key={pr.canonical} style={styles.prLine} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                <Text style={styles.prTick}>PR </Text>
                {pr.canonical} · {pr.weightKg}
                {pr.reps != null ? ` × ${pr.reps}` : ''}
              </Text>
            ))}
          </View>
        ) : null}

        {branding ? (
          <Text style={styles.brand} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Recore
          </Text>
        ) : (
          <Pressable
            onPress={dismiss}
            style={({ pressed }) => [styles.done, pressed && styles.donePressed]}>
            <Text style={styles.doneLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Done
            </Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(color.accent, ink.hairline),
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: type.caption.fontSize,
    letterSpacing: 1.2,
    color: color.textMuted,
    fontWeight: '500',
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
    fontSize: type.caption.fontSize,
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  deltaUp: {
    color: color.signal,
    fontWeight: '600',
  },
  deltaDown: {
    color: color.textSecondary,
    fontWeight: '600',
  },
  prs: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  prLine: {
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  prTick: {
    color: color.signal,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  done: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
  },
  donePressed: {
    backgroundColor: color.surfaceHigh,
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
