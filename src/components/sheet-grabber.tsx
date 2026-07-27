import { StyleSheet, View } from 'react-native';

import { color, moderateScale } from '@/lib/theme';

/**
 * The standard iOS sheet affordance: a short quiet bar centered at the top of
 * a bottom sheet. Drawn in the border tone — structural furniture, not ink.
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
    width: moderateScale(38),
    height: 5,
    borderRadius: 3,
    backgroundColor: color.border,
  },
});
