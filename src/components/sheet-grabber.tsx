import { View } from 'react-native';

import { makeStyles, moderateScale, radius, spacing } from '@/lib/theme';

/**
 * The standard iOS sheet affordance: a short quiet bar centered at the top of
 * a bottom sheet. Drawn in the border tone — structural furniture, not ink.
 */
export function SheetGrabber() {
  const styles = useStyles();

  return (
    <View style={styles.wrap}>
      <View style={styles.bar} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: {
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  bar: {
    width: moderateScale(38),
    height: moderateScale(5),
    // A capsule, not a computed half-height: the bar is a pill at any size, and
    // a radius that has to be recalculated when the height changes is a radius
    // that will eventually be wrong (§6.7).
    borderRadius: radius.capsule,
    backgroundColor: t.rule,
  },
}));
