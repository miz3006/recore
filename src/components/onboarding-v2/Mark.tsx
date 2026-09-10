import Ionicons from '@expo/vector-icons/Ionicons';
import { SymbolView } from 'expo-symbols';
import { type ComponentProps } from 'react';

import { BrandIcon } from './BrandIcon';
import type { MarkName } from './flow';

/**
 * THE FLOW'S ONE LEADING MARK, and the second half of the answer the emoji
 * audit only got halfway through.
 *
 * 28 August 2026 removed the last two emoji from this flow for a reason that
 * was right and that has not changed: a colour emoji is a bitmap laid out on a
 * text baseline with its own internal padding and its own off-centre mass, so
 * it cannot be centred without a hard-coded per-glyph nudge that the next iOS
 * release can invalidate. What that pass did NOT do was replace them — the
 * option lists simply lost their glyphs and the flow shipped as nine screens of
 * identical bare rows.
 *
 * This is the replacement, and it is the platform's own set (owner, 9 September
 * 2026 — *"make onboarding look more like a native iOS app … and icons"*).
 *
 * ## Why SF Symbols rather than more drawn paths
 *
 * The same argument that put SF Pro on the app's text and moved the accessory
 * bar, the settings list and the first-open tour over one surface at a time
 * (`src/components/icon.tsx`): **Apple's set already carries the optical
 * sizing, stroke weight and alignment that a third-party outline can only
 * approximate**, and it is the set every other control on the phone is drawn
 * from. A list of near-misses sitting under the system status bar reads as
 * hand-drawn before it reads as anything else.
 *
 * They also answer every objection the emoji failed:
 *
 *   · centred by their own metrics, not by a baseline nudge;
 *   · one ink, so a mark takes the row label's colour and turns white with it
 *     when the row fills blue — no invert, no vanish, no white disc needed;
 *   · one weight across the whole set, so the visual-weight rule is a property
 *     of the set rather than something checked by eye per glyph;
 *   · they scale with Dynamic Type for free.
 *
 * ## Two sources, never on one screen
 *
 * The attribution screen keeps `BrandIcon`'s drawn paths, because SF Symbols
 * contains no third-party logos and an approximation of a logo is the one thing
 * a mark must not be. Every other mark in the flow is a system symbol. The two
 * sources never meet on a screen, which is the same rule `icon.tsx` moved the
 * app over under — one surface at a time, so no screen is ever caught showing a
 * mixed pair.
 *
 * `SymbolView` renders its `fallback` off-iOS by construction, so there is no
 * platform branch at any call site and no way for the two to drift apart.
 */

/** The marks that are drawn paths rather than system symbols — screen 5 only. */
const BRAND: ReadonlySet<MarkName> = new Set<MarkName>([
  'tiktok',
  'instagram',
  'x',
  'youtube',
  'appstore',
  'friend',
]);

type Symbol = {
  name: ComponentProps<typeof SymbolView>['name'];
  /** Off-iOS outline. Chosen for the same meaning, not the closest shape. */
  fallback: ComponentProps<typeof Ionicons>['name'];
  /**
   * Multiplier on the fitting box. SF Symbols are laid out by their own
   * metrics rather than by a square, so a wide glyph fitted into the same box
   * as a narrow one comes out noticeably shorter. Optical, set by eye.
   */
  box?: number;
};

const SF: Partial<Record<MarkName, Symbol>> = {
  // --- SCREEN 2, "Where do you log your training now?" ----------------------
  //
  // One family, and it is the honest one: these four options name OBJECTS a
  // record currently lives in, so each mark denotes the object. Nothing here
  // stands for a mood, a quality or a number.
  notes: { name: 'note.text', fallback: 'document-text-outline' },
  // MEASURED, NOT GUESSED. Rendered at 22 pt in the row and read off the
  // screenshot, the four marks came out 19.0 / 15.3 / 18.7 pt of ink tall and
  // the dumbbell 11.3 — it is a wide, short glyph, so fitting it to the same
  // square as a tall one gives it about a quarter less optical mass than
  // everything beside it. 1.15 puts its ink area back in the family's range.
  trackerapp: { name: 'dumbbell', fallback: 'barbell-outline', box: 1.15 },
  notebook: { name: 'book.closed', fallback: 'book-outline' },
  spreadsheet: { name: 'tablecells', fallback: 'grid-outline' },

  // --- SCREEN 20, "Weekly recap" -------------------------------------------
  //
  // Apple's own sun and moon, replacing the hand-drawn pair that replaced the
  // emoji. Same meaning, same weight as the rest of the set, and drawn by the
  // same renderer that draws the clock in the status bar above them.
  morning: { name: 'sun.max', fallback: 'sunny-outline' },
  evening: { name: 'moon.stars', fallback: 'moon-outline' },
};

/** The weight every symbol in the flow is drawn at — one value, so the set
 * cannot disagree with itself. `medium` is what `icon.tsx` uses app-wide. */
const WEIGHT = 'medium' as const;

export function Mark({ name, size = 20, tint }: { name: MarkName; size?: number; tint: string }) {
  if (BRAND.has(name)) return <BrandIcon name={name} size={size} tint={tint} />;

  const sf = SF[name];
  // A name with no entry cannot happen through the type, but a mark that fails
  // to resolve must not take the row down with it.
  if (!sf) return null;

  return (
    <SymbolView
      name={sf.name}
      size={size * (sf.box ?? 1)}
      weight={WEIGHT}
      tintColor={tint}
      fallback={<Ionicons name={sf.fallback} size={size} color={tint} />}
    />
  );
}
