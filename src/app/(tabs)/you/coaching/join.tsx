import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CodeTiles, CODE_LENGTH } from '@/components/coaching/code-tiles';
import { AppButton } from '@/components/primitives';
import { myCoach, publishDisplayName, redeemInvite, type RedeemError } from '@/lib/coaching';
import { registerForComments } from '@/lib/coaching/push';
import { useAuth } from '@/lib/auth/provider';
import { getName } from '@/lib/prefs';
import { tap } from '@/lib/haptics';
import { PAPER_FIELD_CSS } from '@/lib/paper-field';
import { color, MAX_FONT_SCALE, spacing, type } from '@/lib/theme';

/**
 * JOIN A COACH — the client's side, and the screen where consent is given.
 *
 * Researched first (Appllama, 10 September 2026):
 *   · `6758457625/onb_xbchg` — Focustown, "Referral Code Entry", on a cream
 *     `#F8F4EC` canvas a shade off Recore's own. Six separate slots, a subline
 *     that states the length before the first keystroke, and a CTA that stays
 *     dead until all six are there. All three borrowed.
 *   · `6742204639/oth_83eis` — CloserCoach, "Join Team", for the shape of the
 *     screen: one field, one sentence about what joining means, one button.
 *   · `1669041518/oth_qf2zw` — Phone Tracker, "Join Circle", which confirms the
 *     same layout outside fitness.
 *
 * THE CONFIRMATION IS NOT A DIALOG PATTERN, IT IS THE POINT. Redeeming is what
 * the database treats as consent (see `redeem_coach_invite`), so the sentence
 * before it has to be the true one — this person will be able to read your
 * sessions and your notes — and it has to be readable before the tap, not
 * after. `Alert` is used rather than a custom sheet because a system alert is
 * the one thing on iOS a person already knows is a decision.
 *
 * ## The invisible input
 *
 * ## IT ANSWERS (10 September 2026)
 *
 * This screen used to call `router.back()` the instant the RPC returned a link
 * id, and that silence was half of the bug the owner reported: a person typed
 * six characters, the keyboard went away, the previous screen came back, and
 * NOTHING said the code had been accepted. A pop is not a confirmation — it is
 * the same animation a Cancel produces.
 *
 * So the screen stays and says what happened, naming the coach it read back
 * from the link rather than the one it assumed. `Done` does the popping, when
 * the person has read it.
 *
 * ## The invisible input
 *
 * The six cells are drawn by `CodeTiles`; the actual `TextInput` is a
 * zero-opacity layer over them. That is the standard iOS one-time-code trick
 * and it is chosen for a specific reason: six real inputs mean six focus
 * targets, six backspace edge cases, and a VoiceOver reading that walks a
 * person through six unlabelled fields. One field, one cursor, one accessible
 * label — and the cells are then free to be pure drawing.
 */
const ERROR_COPY: Record<RedeemError, string> = {
  invalid_or_expired: 'That code is not valid, or it has already been used. Ask your coach for a new one.',
  self_invite: 'That is your own code. Send it to the person you coach instead.',
  already_has_coach: 'You already have a coach. Remove that access first, then join a new one.',
  // Not a scolding: a person who mistyped a code four times reads this too. It
  // says what to do and does not imply they did anything wrong.
  too_many_attempts: 'Too many tries just now. Wait a few minutes, then enter the code again.',
  not_authenticated: 'Sign in first to join a coach.',
  offline: 'No connection. Joining needs the server, so try again when you are back online.',
  unknown: 'That did not work. Try again in a moment.',
};

export default function JoinCoach() {
  const router = useRouter();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ code?: string }>();
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set once the link exists — the screen's second and final state. */
  const [joined, setJoined] = useState<{ name: string | null } | null>(null);

  // Arriving from `recore://coach/join?code=XXXXXX` prefills the field. It does
  // NOT auto-redeem: the confirmation below is the consent, and a deep link
  // that linked an account on open would be exactly the thing this feature must
  // not do.
  useEffect(() => {
    const fromLink = (params.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (fromLink) setCode(fromLink.slice(0, CODE_LENGTH));
  }, [params.code]);

  const confirm = () => {
    tap();
    Alert.alert(
      'Join this coach?',
      'They will see your name, and be able to read the sessions you log and the notes you write on them, and to comment. They can never edit your record. You can remove their access at any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Join', style: 'default', onPress: () => void submit() },
      ],
    );
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await redeemInvite(code);
    if ('linkId' in result) {
      const uid = session?.user.id;
      // The name the coach is about to see beside their new client. Published
      // here and not at sign-up, because THIS is the moment this person chose
      // to be readable by somebody (`publishDisplayName`, CLAUDE.md §2 rule 2)
      // — and because until it existed both ends of every link read each other
      // as the words "Coach" and "Client".
      if (uid) await publishDisplayName(uid, getName());
      // THE PERMISSION PROMPT LANDS HERE and nowhere else (spec Phase 5): the
      // moment a link exists is the first moment a notification could have
      // anything to say. Awaited so the system sheet appears over this screen
      // rather than over whatever comes next, and its answer is not checked —
      // declining is a valid answer and joining still succeeded.
      if (uid) await registerForComments(uid);
      // Who they actually joined, read back from the link rather than assumed:
      // the next thing this screen does is say a name out loud.
      const mine = await myCoach();
      setBusy(false);
      setJoined({ name: mine?.displayName ?? null });
      return;
    }
    setBusy(false);
    setError(ERROR_COPY[result.error]);
  };

  const ready = code.length === CODE_LENGTH;

  return (
    <>
      <Stack.Screen options={{ title: 'Join a coach', headerLargeTitle: true }} />
      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}>
        {joined ? (
          <>
            <Text style={styles.joined} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {joined.name ? `${joined.name} is now your coach.` : 'You now have a coach.'}
            </Text>
            <Text style={styles.lede} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              They can read the sessions you log and comment on them. Their comments, and the way
              to remove their access, are under Coaching in You.
            </Text>
            <AppButton label="Done" onPress={() => router.back()} />
          </>
        ) : (
          <>
          <Text style={styles.lede} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Enter the 6-character code your coach gave you.
          </Text>

          <Pressable onPress={() => inputRef.current?.focus()} accessible={false}>
            <View>
              <CodeTiles code={code} />
              <TextInput
                ref={inputRef}
                style={styles.hidden}
                value={code}
                onChangeText={(t) => {
                  setError(null);
                  setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH));
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                maxLength={CODE_LENGTH}
                keyboardType="ascii-capable"
                accessibilityLabel="Invite code, 6 characters"
                maxFontSizeMultiplier={MAX_FONT_SCALE}
              />
            </View>
          </Pressable>

          {error ? (
            <Text style={styles.error} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {error}
            </Text>
          ) : null}

          <AppButton label="Join" onPress={confirm} disabled={!ready} loading={busy} />
          </>
        )}
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
  /** The one sentence this screen exists to be able to say. */
  joined: { ...type.title2, color: color.textPrimary },
  /** Present for the keyboard and for VoiceOver, invisible to the eye — the
   * cells above are what a sighted person reads. */
  hidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, color: 'transparent' },
  error: { ...type.subhead, color: color.error },
});
