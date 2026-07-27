import { useFonts } from 'expo-font';
import type { TextStyle } from 'react-native';

/**
 * The two faces (CLAUDE.md §6.5). Their division of labour *is* the record
 * contract: **words are humanist, numbers are machine.** A load never appears in
 * SF Pro; a sentence never appears in JetBrains Mono.
 *
 * · **Text — SF Pro**, the iOS system font. Left as `undefined` so the platform
 *   resolves it, which is also what gives us Dynamic Type and the optical sizes
 *   Apple ships for free.
 * · **Data — JetBrains Mono**, bundled here rather than borrowed from the
 *   platform. `ui-monospace` (what v2 used) is SF Mono on iOS and something else
 *   on every other surface, so the app's most important glyphs — the numbers —
 *   were the one thing that changed shape between devices. Three weights ship
 *   because the data ladder uses exactly three; nothing else is bundled.
 *
 * ONE FAMILY PER WEIGHT, and no `fontWeight` on a mono token. iOS resolves a
 * custom font by family name, and asking a single-face family for a weight it
 * does not contain gets you a synthesised (smeared) bold rather than the real
 * cut. Registering `JetBrainsMono-Bold` as its own family makes the wrong
 * combination unrepresentable instead of merely discouraged.
 */
export const mono = {
  /** 500 — table cells, sublines, the archival voice. */
  medium: 'JetBrainsMono-Medium',
  /** 600 — card values, tags, the eyebrow. */
  semibold: 'JetBrainsMono-SemiBold',
  /** 700 — the one hero number per screen. */
  bold: 'JetBrainsMono-Bold',
} as const;

/** SF Pro. `undefined` is not an oversight — it is how RN says "the system". */
export const sans: TextStyle['fontFamily'] = undefined;

/**
 * The load map. Keys become family names verbatim, which is why they match
 * `mono` above exactly.
 */
export const FONT_ASSETS = {
  [mono.medium]: require('../../../assets/fonts/JetBrainsMono-Medium.ttf'),
  [mono.semibold]: require('../../../assets/fonts/JetBrainsMono-SemiBold.ttf'),
  [mono.bold]: require('../../../assets/fonts/JetBrainsMono-Bold.ttf'),
} as const;

/**
 * Load the bundled faces. Returns `true` once every number in the app can be
 * drawn in its real face.
 *
 * The root layout holds the splash on this, so there is no frame in which a load
 * renders in the system font and then reflows — a font swap under a settled card
 * would make the record itself look unstable, which §7.3 forbids for exactly the
 * same reason it forbids animating text inside a settled card.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(FONT_ASSETS);
  // A missing face must never hold the app hostage: fall through to the system
  // mono and let the numbers be ugly rather than absent.
  return loaded || error !== null;
}
