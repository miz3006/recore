import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { makeStyles, MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';

/**
 * Placeholder body for the tab roots that Phase 1 and Phase 4 build for real
 * (PLAN.md 0.6). Deliberately not `StubScreen`: that one carries a back chevron,
 * and a tab root has nowhere to go back to.
 *
 * The copy is the real §12.1 empty-state line rather than filler, so the routes
 * read as unfinished-but-honest instead of unfinished-and-fake — and so the
 * wording is already under review before `EmptyState` (1.6) inherits it.
 */
export function TabPlaceholder({ title, note }: { title: string; note: string }) {
  const styles = useStyles();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {title}
        </Text>
        <Text style={styles.note} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {note}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((t) => ({
  root: {
    flex: 1,
    backgroundColor: t.canvas,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  title: {
    ...type.title1,
    color: t.ink,
  },
  note: {
    ...type.callout,
    lineHeight: moderateScale(23),
    color: t.inkMuted,
  },
}));
