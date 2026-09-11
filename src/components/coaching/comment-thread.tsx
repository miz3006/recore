import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Eyebrow } from '@/components/primitives';
import { PressableScale } from '@/components/motion';
import { Icon } from '@/components/icon';
import {
  listComments,
  markRead,
  postComment,
  MAX_COMMENT_CHARS,
  type Comment,
} from '@/lib/coaching';
import { tap } from '@/lib/haptics';
import {
  color,
  hairline,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  type,
} from '@/lib/theme';

/**
 * THE COMMENT THREAD — one conversation about one workout, or about one lift
 * inside it.
 *
 * ## Researched before it was drawn (Appllama, 10 September 2026)
 *
 * `6504206467/oth_7wcg6` — Minutes, "Meeting Chat". A thread ATTACHED TO A
 * DOCUMENT rather than to a person: the note's title sits above the
 * conversation, so every message is visibly about that thing. It also splits
 * the two speakers without two coloured bubbles — the other party is bare text,
 * the reader's own words get a light neutral fill, right-aligned. That is the
 * detail borrowed hardest, because Recore cannot afford a two-colour chat: on
 * cream paper a pair of saturated bubbles is the loudest object in the app, and
 * the one blue is spoken for (design skill §Colour — brand is CTA, selection
 * and links, not decoration).
 *
 * `527219710/oth_23zyo` — Sworkit, "AI Coach Chat", for the pinned single-line
 * composer with the send affordance inside the field rather than beside it.
 *
 * ## The rules it inherits
 *
 * It is built on `bottom-sheet.tsx`, which is the app's ONE sheet chrome, and
 * it follows `entry-note-sheet.tsx` — the closest existing thing, being free
 * text about one lift in one session. Scope is stated at the top in the
 * `Eyebrow` voice: "Whole session" or the exercise name, so nobody types a
 * remark about the squats under the bench press.
 *
 * ## Sending is optimistic, and the words are never lost
 *
 * The message appears the moment it is sent, in a pending state, and the field
 * clears. If the insert fails the message is REMOVED AND THE TEXT IS PUT BACK
 * IN THE FIELD — not dropped with an apology in a toast. A comment needs the
 * network; a person's sentence does not need to be destroyed by its absence.
 */
export function CommentThread({
  workoutId,
  /** `null` = the whole session. Otherwise `entryNoteKey(exercise)`. */
  exerciseRef,
  /** How the scope reads in the header — the lift's display name. */
  scopeLabel,
  viewerId,
  /** Names for the two participants, so a message is signed with a person. */
  nameFor,
}: {
  workoutId: string;
  exerciseRef: string | null;
  scopeLabel: string;
  viewerId: string;
  nameFor: (authorId: string) => string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    const all = await listComments(workoutId);
    setComments(all.filter((c) => (c.exerciseRef ?? null) === exerciseRef));
    setLoading(false);
  }, [workoutId, exerciseRef]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    // Opening the thread is what marks the other party's words read (spec
    // Phase 3.5). It is fire-and-forget: a failed read receipt must never stop
    // someone from reading.
    void markRead(workoutId);
  }, [refresh, workoutId]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    tap();
    setSending(true);
    setFailed(false);
    setDraft('');

    const optimistic: Comment = {
      id: `pending-${Date.now()}`,
      workoutId,
      exerciseRef,
      authorId: viewerId,
      body,
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    setComments((prev) => [...prev, optimistic]);

    const stored = await postComment(workoutId, exerciseRef, body, viewerId);
    setSending(false);
    if (stored) {
      setComments((prev) => prev.map((c) => (c.id === optimistic.id ? stored : c)));
    } else {
      // Roll back, and give the sentence back to the field.
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
      setDraft(body);
      setFailed(true);
    }
  };

  const left = MAX_COMMENT_CHARS - draft.length;

  return (
    /* The SHEET is the route (`coach-thread.tsx`); this is only its contents,
       and it is a PLAIN VIEW on purpose.
       It was a `KeyboardAvoidingView`, and inside a form sheet that broke the
       layout outright — verified on the iOS 26.5 simulator, 10 September 2026:
       the header and the first message rendered ON TOP OF each other, because
       a `KeyboardAvoidingView` with no height to work from lays nothing out in
       a column. It also is not needed: a `UISheetPresentationController`
       resizes itself for the keyboard, which is one of the things a `<Modal>`
       imitation never did for free. */
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.rootContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}>
      <View style={styles.head}>
        <Eyebrow tone="muted">{exerciseRef ? 'Comments on' : 'Comments'}</Eyebrow>
        <Text style={styles.scope} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {scopeLabel}
        </Text>
      </View>

      <View style={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator style={styles.loading} color={color.textMuted} />
        ) : comments.length === 0 ? (
          <Text style={styles.empty} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Nothing here yet. Write the first note about this
            {exerciseRef ? ' lift' : ' session'}.
          </Text>
        ) : (
          comments.map((c) => {
            const mine = c.authorId === viewerId;
            const pending = c.id.startsWith('pending-');
            return (
              <View key={c.id} style={[styles.message, mine && styles.messageMine]}>
                {!mine ? (
                  <Text style={styles.author} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {nameFor(c.authorId)}
                  </Text>
                ) : null}
                <View style={[styles.bubble, mine && styles.bubbleMine, pending && styles.bubblePending]}>
                  <Text style={styles.body} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {c.body}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* The offline state is a sentence, not a symbol: it says what happened
          and confirms the words are still in the field. */}
      {failed ? (
        <Text style={styles.failed} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          That didn&apos;t send — you may be offline. Your note is still here; tap send to try again.
        </Text>
      ) : null}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={(t) => setDraft(t.slice(0, MAX_COMMENT_CHARS))}
          placeholder="Write a comment"
          placeholderTextColor={color.textMuted}
          multiline
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          accessibilityLabel={`Comment on ${scopeLabel}`}
          onSubmitEditing={Keyboard.dismiss}
        />
        <PressableScale
          onPress={send}
          disabled={!draft.trim() || sending}
          haptic="none"
          accessibilityRole="button"
          accessibilityLabel="Send comment"
          accessibilityState={{ disabled: !draft.trim() || sending }}
          style={[styles.send, (!draft.trim() || sending) && styles.sendOff]}>
          <Icon name="tour-next" size={18} tint={color.onInk} />
        </PressableScale>
      </View>
      {left < 200 ? (
        <Text style={styles.counter} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {left}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {},
  rootContent: { paddingHorizontal: spacing.xxl, paddingTop: spacing.lg, paddingBottom: spacing.lg },
  head: { paddingBottom: spacing.md },
  scope: { ...type.title2, color: color.textPrimary, marginTop: spacing.xs },
  scrollContent: { paddingVertical: spacing.sm, gap: spacing.md },
  loading: { paddingVertical: spacing.xl },
  empty: {
    ...type.subhead,
    color: color.textMuted,
    paddingVertical: spacing.lg,
  },
  message: { alignItems: 'flex-start', gap: spacing.xs },
  messageMine: { alignItems: 'flex-end' },
  author: { ...type.footnote, color: color.textMuted },
  /** The other party: bare words on the sheet, the way the record is bare. */
  bubble: { maxWidth: '86%' },
  /** Your own: one neutral recessed fill, no colour. Which side it sits on is
   * the second carrier, so the distinction survives without hue. */
  bubbleMine: {
    backgroundColor: color.surfaceHigh,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubblePending: { opacity: 0.5 },
  body: { ...type.body, color: color.textPrimary },
  failed: { ...type.caption, color: color.error, paddingBottom: spacing.sm },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    borderTopWidth: hairline,
    borderTopColor: color.border,
    paddingTop: spacing.md,
  },
  input: {
    flex: 1,
    ...type.body,
    color: color.textPrimary,
    maxHeight: moderateScale(120),
    minHeight: moderateScale(40),
    paddingVertical: spacing.xs,
  },
  send: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: 999,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { backgroundColor: color.disabled },
  counter: {
    ...type.footnote,
    color: color.textMuted,
    alignSelf: 'flex-end',
    paddingTop: spacing.xs,
  },
});
