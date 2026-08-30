import { moderateScale, osFontScale, spacing, textRoom, type } from '@/lib/theme';

/**
 * Shared metrics for the note body so the editor text, the right-gutter value,
 * and the ghost prediction all sit on the SAME baseline grid and left margin
 * (task §1, §3). Everything derives from the scaled `body` token — no hardcoded
 * pixel sizes.
 */

/** Left text = the width-scaled body token. RN grows the glyph by OS font size. */
export const NOTE_FONT_SIZE = type.body.fontSize;

/**
 * Generous, paper-like line spacing (task §2). The SAME value is used by the
 * editor, the measuring mirror, and the gutter so all three stay locked to one
 * baseline grid.
 *
 * This is the value a `lineHeight` is set to; the renderer grows it by the
 * reader's own text setting, exactly as it grows the glyph (see `lineFor`). It
 * used to carry `osFontScale` itself, which meant the text scaled twice while
 * the gutter ROWS beside it scaled once — so at any setting but the default the
 * two grids drifted apart by that factor, a line at a time.
 */
export const NOTE_LINE_HEIGHT = Math.round(NOTE_FONT_SIZE * 1.75);

/**
 * The same line as a BOX — the gutter row that has to sit on the note's own
 * baseline, and anything else drawn as a `View` beside the text. A view is not
 * grown by the reader's setting, so it takes the scale by hand.
 */
export const NOTE_LINE_BOX = textRoom(NOTE_LINE_HEIGHT);

/**
 * Interpreted readings sit a full step smaller than the written ink (design
 * frames 05–09: 17pt text, ~11.5pt reading) — the machine answers quietly.
 */
export const READING_FONT_SIZE = moderateScale(11.5);

/** Fixed-min-width right column for the parsed reading; pinned to
 * BODY_PADDING_H. Sized for the widest reading voice ("82.5 kg · 10·10·10"
 * at the smaller reading size); anything longer shrinks slightly instead of
 * ellipsizing. */
export const GUTTER_WIDTH = Math.round(NOTE_FONT_SIZE * osFontScale * 6.5);

/** Gap between the wrapping left text and the gutter column. */
export const GUTTER_GAP = spacing.md;

/** One horizontal padding token, applied on every screen edge (task §2). */
export const BODY_PADDING_H = spacing.xxl; // 24
export const BODY_PADDING_TOP = spacing.lg; // 16
