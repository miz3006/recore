import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAX_FONT_SCALE, makeStyles, spacing, type } from '@/lib/theme';
import { useCurrentNote } from '@/state/session-store';

import { Eyebrow } from './primitives';
import { Sheet } from './sheet';

/**
 * The raw note (CLAUDE.md §8.2, PLAN.md 1.18).
 *
 * *"Swiping down on the header reveals the raw note in full — the 'show me what
 * I actually typed' escape hatch, which must always exist."*
 *
 * It exists because of §4.3: `raw_text` is the record and the cards are a
 * projection we compute from it. A projection the user cannot get behind is
 * indistinguishable from a rewrite, and the first time someone suspects the app
 * changed their words is the last time they trust it with a session.
 *
 * So this is deliberately unstyled: the user's words, verbatim, in the text
 * face, with nothing interpreted, nothing highlighted, and nothing to interact
 * with. Read-only — editing happens where writing happens.
 */
export function RawNoteSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const note = useCurrentNote();
  const text = note.replace(/\n+$/, '');

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      detents={[0.6, 0.95]}
      sheetStyle={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
      <View style={styles.head}>
        <Eyebrow>What you typed</Eyebrow>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.raw} maxFontSizeMultiplier={MAX_FONT_SCALE} selectable>
          {text.length > 0 ? text : 'Nothing yet today.'}
        </Text>
      </ScrollView>
    </Sheet>
  );
}

const useStyles = makeStyles((t) => ({
  sheet: {
    paddingHorizontal: spacing.xl,
  },
  head: {
    paddingBottom: spacing.md,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  raw: {
    ...type.body,
    color: t.ink,
  },
}));
