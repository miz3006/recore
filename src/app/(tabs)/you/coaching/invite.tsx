import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { CodeTiles } from '@/components/coaching/code-tiles';
import { AppButton } from '@/components/primitives';
import { createInvite, publishDisplayName, type InviteError } from '@/lib/coaching';
import { registerForComments } from '@/lib/coaching/push';
import { useAuth } from '@/lib/auth/provider';
import { getName } from '@/lib/prefs';
import { tap } from '@/lib/haptics';
import { PAPER_FIELD_CSS } from '@/lib/paper-field';
import { color, MAX_FONT_SCALE, spacing, type } from '@/lib/theme';

/**
 * INVITE A CLIENT — the coach's side of the handshake.
 *
 * Researched first (Appllama, 10 September 2026):
 *   · `6463766369/oth_t8mhk` — Cozy Couples, "Invite partner". A 1:1 link, not
 *     a viral referral: six code tiles, "Tap to copy" beneath, one share CTA,
 *     and a footer that flips to the other role ("Received an invite? Enter
 *     partner's code"). That footer is borrowed directly — it is the cheapest
 *     answer to the spec's own edge case, a person who coaches someone AND has
 *     a coach.
 *   · `6473512692/oth_db6go` — Cal Scanner, "Free Gifts Referral", for the
 *     share-sheet-first CTA. Its reward framing is deliberately NOT borrowed:
 *     there is nothing to win here, and CLAUDE.md §2 rule 6 has no room for
 *     invented incentives.
 *
 * WHAT IT PROMISES IS WHAT THE DATABASE DOES. The expiry line states seven days
 * because `coach_invites.expires_at` defaults to seven days, and the cap
 * message names five because the RPC refuses a sixth. Neither sentence is
 * decoration; if the migration changes, both change with it.
 */
const ERROR_COPY: Record<InviteError, string> = {
  too_many_invites:
    'You already have five codes waiting to be used. Wait for one to be redeemed or for it to expire.',
  not_a_coach: 'Turn on “I coach other people” in You before inviting a client.',
  not_authenticated: 'Sign in first to invite a client.',
  offline: 'No connection. A code has to be issued by the server, so try again when you are back online.',
  unknown: 'That did not work. Try again in a moment.',
};

export default function InviteClient() {
  const { session } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // KEYED ON THE ACCOUNT, WHICH IS THE SAME AS "ONCE" HERE. `uid` is a string,
  // so a token refresh replacing the session object does not re-run this and
  // does not burn a second code. Behind the signed-in guard it is never
  // absent; if it somehow were, `create_coach_invite` raises `not_authenticated`
  // and this screen already has the true sentence for that — no code is issued
  // to nobody, and the retry when the id lands still produces exactly one.
  const uid = session?.user.id;
  useEffect(() => {
    void (async () => {
      // The name the client will see once they redeem. Published before the
      // code exists so it is already there when they do, and only here —
      // issuing a code is this person choosing to be identified to whoever
      // types it (`publishDisplayName`).
      if (uid) await publishDisplayName(uid, getName());
      const result = await createInvite();
      if ('code' in result) setCode(result.code);
      else setError(ERROR_COPY[result.error]);
      setLoading(false);
      // The coach side of the same rule as `join.tsx`: a coach who issues a
      // code is about to have someone replying to them, so this is their first
      // honest moment to be asked. Not awaited — the code is already on screen
      // and nothing about it waits on a permission answer.
      if (uid) void registerForComments(uid);
    })();
  }, [uid]);

  const share = async () => {
    if (!code) return;
    tap();
    await Share.share({
      // The deep link AND the bare code: a code that survives being read aloud
      // is worth more than a link that only works on the same phone.
      message: `Join me as your coach in Recore. Open recore:///you/coaching/join?code=${code} or enter the code ${code}.`,
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Invite a client', headerLargeTitle: true }} />
      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}>
        <Text style={styles.lede} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Give this code to the person you coach. When they enter it, you will be able to read
          their logged sessions and comment on them. Either of you can end that at any time.
        </Text>

        {loading ? (
          <ActivityIndicator style={styles.loading} color={color.textMuted} />
        ) : code ? (
          <View style={styles.codeBlock}>
            <CodeTiles code={code} />
            <Text style={styles.expiry} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              This code works once, and expires in 7 days.
            </Text>
          </View>
        ) : (
          <Text style={styles.error} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {error}
          </Text>
        )}

        {code ? <AppButton label="Share the code" onPress={share} /> : null}
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
  content: { padding: spacing.xxl, gap: spacing.xxl },
  lede: { ...type.body, color: color.textSecondary },
  loading: { paddingVertical: spacing.xxxl },
  codeBlock: { gap: spacing.md, alignItems: 'center' },
  expiry: { ...type.caption, color: color.textMuted, textAlign: 'center' },
  error: { ...type.body, color: color.error },
});
