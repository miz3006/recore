import { osFontScale, spacing, type } from '@/lib/theme';

/**
 * Shared metrics for the note body so the editor text, the right-gutter value,
 * and the ghost prediction all sit on the SAME baseline grid and left margin
 * (task §1, §3). Everything derives from the scaled `body` token — no hardcoded
 * pixel sizes.
 */

/** Left text = the width-scaled body token. RN grows the glyph by OS font size. */
export const NOTE_FONT_SIZE = type.body.fontSize;

/**
 * Generous, paper-like line spacing (task §2). Multiplied by the clamped OS font
 * scale so the rhythm stays proportional when Dynamic Type grows the glyphs. The
 * SAME value is used by the editor, the measuring mirror, and the gutter so all
 * three stay locked to one baseline grid.
 */
export const NOTE_LINE_HEIGHT = Math.round(NOTE_FONT_SIZE * osFontScale * 1.75);

/** Fixed-min-width right column for the parsed value; pinned to BODY_PADDING_H.
 * Sized for the widest echo ("3×10 82.5" ≈ 10 mono chars); anything longer
 * shrinks slightly instead of ellipsizing. */
export const GUTTER_WIDTH = Math.round(NOTE_FONT_SIZE * osFontScale * 6.0);

/** Gap between the wrapping left text and the gutter column. */
export const GUTTER_GAP = spacing.md;

/** One horizontal padding token, applied on every screen edge (task §2). */
export const BODY_PADDING_H = spacing.xxl; // 24
export const BODY_PADDING_TOP = spacing.lg; // 16
