import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type ComponentProps } from 'react';

import { useTheme } from '@/lib/theme';

/** Semantic icon names used across the app. */
export type IconName =
  | 'chevron-down'
  | 'gear'
  | 'flame'
  | 'mic'
  | 'camera'
  | 'plus'
  | 'keyboard'
  | 'apple'
  | 'google'
  | 'chevron-back'
  | 'chevron-forward'
  | 'chart'
  | 'timer'
  | 'share';

type Glyph =
  | { set: 'ion'; name: ComponentProps<typeof Ionicons>['name'] }
  | { set: 'mci'; name: ComponentProps<typeof MaterialCommunityIcons>['name'] };

// A single consistent, monochrome outline set (Ionicons), plus one MCI glyph for
// the keyboard, which Ionicons lacks.
const MAP: Record<IconName, Glyph> = {
  'chevron-down': { set: 'ion', name: 'chevron-down' },
  gear: { set: 'ion', name: 'settings-outline' },
  flame: { set: 'ion', name: 'flame-outline' },
  mic: { set: 'ion', name: 'mic-outline' },
  camera: { set: 'ion', name: 'camera-outline' },
  plus: { set: 'ion', name: 'add' },
  keyboard: { set: 'mci', name: 'keyboard-outline' },
  apple: { set: 'ion', name: 'logo-apple' },
  google: { set: 'ion', name: 'logo-google' },
  'chevron-back': { set: 'ion', name: 'chevron-back' },
  'chevron-forward': { set: 'ion', name: 'chevron-forward' },
  chart: { set: 'ion', name: 'stats-chart-outline' },
  timer: { set: 'ion', name: 'timer-outline' },
  share: { set: 'ion', name: 'share-outline' },
};

type IconProps = {
  name: IconName;
  size?: number;
  /** Defaults to muted grey — icons stay quiet until they mean something. */
  tint?: string;
};

export function Icon({ name, size = 20, tint }: IconProps) {
  const t = useTheme();
  // Resolved here rather than as a default parameter: a default cannot call a
  // hook, and the muted tone now depends on the active theme.
  const resolved = tint ?? t.inkMuted;
  const glyph = MAP[name];
  if (glyph.set === 'mci') {
    return <MaterialCommunityIcons name={glyph.name} size={size} color={resolved} />;
  }
  return <Ionicons name={glyph.name} size={size} color={resolved} />;
}
