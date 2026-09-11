import { Link, Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { listClients, revokeLink, type CoachClient } from '@/lib/coaching';
import { tap } from '@/lib/haptics';
import { PAPER_FIELD_CSS } from '@/lib/paper-field';
import { color, hairline, MAX_FONT_SCALE, moderateScale, spacing, TAB_BAR_CLEARANCE, type } from '@/lib/theme';

import { relativeDay } from '@/lib/coaching/relative';

/**
 * THE CLIENT LIST — who the coach works with, and who needs reading.
 *
 * Researched first (Appllama, 10 September 2026):
 *   · `1451878715/oth_45wd3` and `oth_79mci` — Dribbleup, "Activity Feed" and
 *     its empty state: a roster of people reduced to name, one relative time,
 *     and nothing else. The empty state points at the single action that fills
 *     the screen, which is what this one does.
 *   · `6450921637/oth_gx5zu` — Gravl, "Empty Feed", for the same shape in a
 *     training app.
 *
 * The library was thin here — no top-grossing consumer app ships a trainer-side
 * roster, because that surface usually lives on a web dashboard. So the
 * structure is borrowed from the closest relative (a people feed) and the
 * MATERIAL is entirely Recore's: **bare rows, no cards.** Design skill
 * §Structure — a list of facts is typography on canvas, and a coach's client
 * list is a record, not a control.
 *
 * ## The context menu is ADDITIVE, which is the only reason it is allowed
 *
 * `entry-actions-sheet.tsx` records this app moving actions OFF a long-press
 * because it was "a gesture nobody could see", and that ruling stands: nothing
 * here is reachable ONLY by long-pressing. The row still taps straight through
 * to the feed, and "Remove access" is a visible header button once you are in
 * it. What the menu adds is a peek at the client's sessions and a shortcut for
 * a coach who already knows what they want — a real `UIContextMenu`, with
 * `Link.Preview` rendering the destination and the destructive action in the
 * system's own red. A menu that only duplicates visible paths cannot hide one.
 *
 * ## THE TRIGGER CARRIES ITS OWN `onPress`, AND HAS TO (10 September 2026)
 *
 * That paragraph claimed the row "taps straight through to the feed". Measured
 * on the iOS 26.5 simulator, it did not: a tap did nothing at all, while a
 * long-press opened the menu and the preview perfectly. The whole roster was a
 * list a coach could only reach through a gesture nobody can see — the exact
 * failure the paragraph above forbids.
 *
 * The cause is React Native's responder system, not expo-router. `Link` puts
 * the press on ITSELF; a `Pressable` inside the trigger claims the touch first
 * (`onStartShouldSetResponder`) and never gives it back, so a trigger whose
 * child is pressable swallows every tap. `PressableScale` had no `onPress` of
 * its own, so the swallowed tap led nowhere.
 *
 * The fix is to navigate from the trigger itself rather than to unwrap it: the
 * press feedback and the 44 pt target are the Pressable's, and the preview and
 * the menu are the Link's UIKit interaction, which is a separate recogniser and
 * keeps working. `open()` below is the single destination all three paths use,
 * so the tap, the menu item and the `href` cannot drift apart.
 *
 * THE UNREAD MARK IS A BLUE DOT AND A COUNT. Not a badge, not a flame, and
 * specifically not green: `signal` green means a PLANNED prescription in this
 * app and may never mean "new". The count says the number beside the dot so
 * colour is never the only carrier (design skill §Colour).
 */
export default function Clients() {
  const router = useRouter();
  const [clients, setClients] = useState<CoachClient[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setClients(await listClients());
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  /** One destination for the tap, the menu item and the `href`. */
  const open = (c: CoachClient) =>
    router.push({
      pathname: '/you/coaching/client/[id]',
      params: { id: c.clientId, name: c.displayName ?? 'Client', linkId: c.linkId },
    });

  return (
    <>
      <Stack.Screen options={{ title: 'Clients', headerLargeTitle: true }} />
      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {loaded && clients.length === 0 ? (
          <Text style={styles.empty} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Nobody yet. Invite a client from the Coaching section and their sessions will appear
            here as they log them.
          </Text>
        ) : null}

        {clients.map((c) => (
          <Link
            key={c.linkId}
            href={{
              pathname: '/you/coaching/client/[id]',
              params: { id: c.clientId, name: c.displayName ?? 'Client', linkId: c.linkId },
            }}>
            <Link.Trigger>
              <PressableScale
                onPress={() => open(c)}
                haptic="light"
                activeScale={0.98}
                accessibilityRole="button"
                accessibilityLabel={`${c.displayName ?? 'Client'}, last trained ${relativeDay(c.lastWorkoutAt)}${
                  c.unreadCount ? `, ${c.unreadCount} unread` : ''
                }`}
                style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.name} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {c.displayName ?? 'Client'}
                  </Text>
                  <Text style={styles.sub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {relativeDay(c.lastWorkoutAt)}
                  </Text>
                </View>
                {c.unreadCount > 0 ? (
                  <View style={styles.unread}>
                    <View style={styles.dot} />
                    <Text style={styles.unreadCount} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {c.unreadCount}
                    </Text>
                  </View>
                ) : null}
              </PressableScale>
            </Link.Trigger>
            <Link.Preview />
            <Link.Menu>
              <Link.MenuAction title="Open sessions" icon="list.bullet" onPress={() => open(c)} />
              <Link.MenuAction
                title="Remove access"
                icon="person.crop.circle.badge.xmark"
                destructive
                onPress={() => {
                  tap();
                  Alert.alert(
                    `Stop coaching ${c.displayName ?? 'this client'}?`,
                    'You will immediately stop being able to read their sessions. The comments you have written stay in their record.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Stop',
                        style: 'destructive',
                        onPress: () => {
                          void (async () => {
                            if (await revokeLink(c.linkId)) await load();
                          })();
                        },
                      },
                    ],
                  );
                }}
              />
            </Link.Menu>
          </Link>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  /**
   * THE CANVAS IS THE SCROLL VIEW'S OWN BACKGROUND (11 September 2026).
   *
   * Every screen in this folder drew the retired grouped world instead of the
   * app's paper. Sampled on the iOS 26.5 simulator: a flat `242,242,242` from
   * the status bar to the tab bar, against Today's `247,245,238 → 245,244,243`.
   * The design skill is explicit that there is no `#F2F2F7` grouped world left,
   * and the coaching stack was the last place still living in it.
   *
   * `you/_layout.tsx` already hangs a `PaperField` beside its navigator, and
   * that is exactly why this is needed: **the navigator's own container view is
   * opaque and paints over the sibling.** That file has the whole probe. The
   * answer it lands on is this one — the gradient goes on the scroll view's own
   * style, where it needs no sibling and sits under no container, and the
   * screen keeps its collapsing large title.
   */
  scroll: {
    flex: 1,
    experimental_backgroundImage: PAPER_FIELD_CSS,
  },
  content: { paddingHorizontal: spacing.xxl, paddingBottom: TAB_BAR_CLEARANCE + spacing.xxl },
  empty: { ...type.body, color: color.textMuted, paddingVertical: spacing.xxl },
  /** A bare row: air between records, one hairline only because a roster is a
   * list a finger scans rather than a record it reads. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: moderateScale(68),
    gap: spacing.md,
    borderBottomWidth: hairline,
    borderBottomColor: color.border,
  },
  rowText: { flex: 1, gap: 2 },
  name: { ...type.headline, color: color.textPrimary },
  sub: { ...type.subhead, color: color.textSecondary },
  unread: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.brand },
  unreadCount: { ...type.subhead, color: color.brand },
});
