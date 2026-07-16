import { StyleSheet, View } from 'react-native';

import { alpha, color, moderateScale, radius } from '@/lib/theme';

/**
 * The standard iOS sheet affordance: a short quiet bar centered at the top of
 * a bottom sheet. White like everything else, faded far enough to be furniture.
 */
export function SheetGrabber() {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: 6,
  },
  bar: {
    width: moderateScale(36),
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: alpha(color.accent, 0.18),
  },
});
