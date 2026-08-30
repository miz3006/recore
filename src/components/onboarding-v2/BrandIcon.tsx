import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import type { MarkName } from './flow';

/**
 * THE ATTRIBUTION SCREEN'S MARKS — screen 4, and nowhere else.
 *
 * Cal AI ships an `Icon Option List` on its own attribution screen (position
 * 4/38) and it is the right call: 🎵 is not TikTok, ✖️ is not X, and 🔍 is
 * certainly not the App Store. An emoji standing in for a logo is an
 * approximation of a thing the person is being asked to recognise, which is the
 * one job it cannot do badly.
 *
 * ## Monochrome, on purpose
 *
 * These draw in one ink at one weight, not in brand colours. Three reasons, in
 * order of how much they matter:
 *
 *   1. It is the only way to satisfy the visual-weight rule. Full-colour brand
 *      marks in a list are exactly the incoherence this pass removed — TikTok's
 *      cyan/magenta beside Instagram's gradient beside the App Store's blue is
 *      four palettes in six rows, and none of them is Recore's.
 *   2. A selected row in this flow fills solid blue with a white label. A
 *      coloured mark would have to invert or disappear; a single-ink mark just
 *      takes the label's colour, which is what `tint` is for.
 *   3. Nominative use of a wordmark's SHAPE to say "this is where you found us"
 *      is what these are for; recolouring them into a brand's own palette makes
 *      the row look like an endorsement rather than an answer.
 *
 * They are simplified silhouettes, drawn on a 24-unit grid to read at 20 pt.
 * Recognition at that size comes from proportion and negative space, not from
 * detail, so nothing here tries to be the real asset at 1:1.
 */
export function BrandIcon({
  name,
  size = 20,
  tint,
}: {
  name: MarkName;
  size?: number;
  tint: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {glyph(name, tint)}
    </Svg>
  );
}

function glyph(name: MarkName, tint: string) {
  switch (name) {
    /**
     * The eighth note — TikTok's whole silhouette. Drawn as a stroke rather
     * than a solid body so it carries the same optical weight as the outline
     * marks beside it; the flag at the top is what makes it read.
     */
    case 'tiktok':
      return (
        <G>
          <Path
            d="M14.8 3.6v9.9a4.6 4.6 0 1 1-4.6-4.6c.35 0 .7.04 1 .12"
            stroke={tint}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M14.8 3.6c.6 2.3 2.2 3.7 4.6 3.9"
            stroke={tint}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </G>
      );
    /** Rounded square, lens, flash dot. */
    case 'instagram':
      return (
        <G>
          <Rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="5.4"
            ry="5.4"
            stroke={tint}
            strokeWidth="1.9"
            fill="none"
          />
          <Circle cx="12" cy="12" r="4.1" stroke={tint} strokeWidth="1.9" fill="none" />
          <Circle cx="17.2" cy="6.8" r="1.25" fill={tint} />
        </G>
      );
    /**
     * Two crossing strokes. The real mark is a solid glyph, and drawn solid it
     * was by some distance the heaviest thing in the row — checked rendered at
     * 20 pt, which is the only way this is checkable. Stroked at the list's own
     * weight it still reads as X and stops shouting.
     */
    case 'x':
      return (
        <Path
          d="M4.6 4.4 19.4 19.6M19.4 4.4 4.6 19.6"
          stroke={tint}
          strokeWidth="2.1"
          strokeLinecap="round"
          fill="none"
        />
      );
    /** The rounded plate and its play triangle. */
    case 'youtube':
      return (
        <G>
          <Rect
            x="2.2"
            y="5.4"
            width="19.6"
            height="13.2"
            rx="4.2"
            ry="4.2"
            stroke={tint}
            strokeWidth="1.9"
            fill="none"
          />
          <Path d="M10.3 9.2 15.6 12l-5.3 2.8V9.2z" fill={tint} />
        </G>
      );
    /** The App Store's compass-drawn A inside its circle. */
    case 'appstore':
      return (
        <G>
          <Circle cx="12" cy="12" r="9.1" stroke={tint} strokeWidth="1.9" fill="none" />
          {/* The A's two legs and a crossbar that stops ON them. The first
              draft ran the bar past both legs and read as a strikethrough. */}
          <Path
            d="M7.8 16.4 12 8.2l4.2 8.2M9.3 13.5h5.4"
            stroke={tint}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </G>
      );
    /**
     * EVENING — a crescent, drawn rather than typed.
     *
     * 🌙 and ☀️ were emoji until 28 August 2026, and they were replaced for the
     * reason the owner gave: they would not sit centred. That is not a bug that
     * can be fixed, only compensated — a colour emoji is a bitmap laid out on a
     * text baseline with its own internal padding and its own off-centre mass
     * (🌙's alpha-weighted centroid measured 0.155 em down and right of its
     * box), so centring it means hard-coding a nudge per glyph and hoping the
     * next iOS release does not redraw it.
     *
     * A path has none of those problems. It is centred because the geometry
     * says so, it takes the label's colour so it turns white on a selected row,
     * it carries the same stroke weight as the five marks above it, and it
     * scales with Dynamic Type without a second thought. The flow now contains
     * no emoji at all.
     */
    case 'evening':
      return (
        <Path
          d="M20.3 14.2A8.6 8.6 0 0 1 9.4 3.9a8.7 8.7 0 1 0 10.9 10.3z"
          stroke={tint}
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
    /** MORNING — a sun on the same grid and the same stroke as the crescent, so
     * the two rows weigh the same. */
    case 'morning':
      return (
        <G>
          <Circle cx="12" cy="12" r="4.7" stroke={tint} strokeWidth="1.9" fill="none" />
          <Path
            d="M12 2.2v2.5M12 19.3v2.5M3.9 3.9l1.8 1.8M18.3 18.3l1.8 1.8M2.2 12h2.5M19.3 12h2.5M3.9 20.1l1.8-1.8M18.3 5.7l1.8-1.8"
            stroke={tint}
            strokeWidth="1.9"
            strokeLinecap="round"
            fill="none"
          />
        </G>
      );
    /**
     * Two figures — Cal AI uses a generic people glyph on its own "Friend or
     * family" row. Deliberately headless-and-shoulders rather than a person
     * emoji, because a figure with a face has a gender and a skin tone and this
     * one must have neither.
     */
    case 'friend':
    default:
      return (
        <G>
          <Circle cx="9.2" cy="8.6" r="3.1" stroke={tint} strokeWidth="1.8" fill="none" />
          <Path
            d="M3.4 19.4c0-3.2 2.6-5.4 5.8-5.4s5.8 2.2 5.8 5.4"
            stroke={tint}
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M16.4 6.1a3.1 3.1 0 0 1 0 5.9M17.2 14.4c2.2.5 3.6 2.4 3.6 5"
            stroke={tint}
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
        </G>
      );
  }
}
