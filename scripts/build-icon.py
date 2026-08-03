#!/usr/bin/env python3
"""
Generate every app icon asset from one description (PLAN C1).

WHY A SCRIPT. The icon was the Expo template — a blue chevron on a grid, with
an Android background of #E6F4FE, a template blue that belongs to no palette in
this app. Replacing it with an exported PNG would leave the next change to a
guess; this file IS the design, in the same colours as src/lib/theme/color.ts,
and re-running it reproduces every size exactly.

THE MARK. Warm paper, ink, and one letter set in the app's own voice: SF Pro
Bold with tight tracking, the same face and the same restraint as the wordmark
in `top-bar.tsx`. Under it, the rule a ledger line is written on. Monochrome —
`signal` green marks a PLANNED VALUE and nothing else (CLAUDE.md §5.1), and an
icon is not a planned value, so there is no green here at all.

Not an app dependency: this needs python3 + Pillow on a dev machine and nothing
in `package.json` changes. Run it from the repo root:

    python3 scripts/build-icon.py
"""

from PIL import Image, ImageDraw, ImageFont

# src/lib/theme/color.ts — the only place these numbers are allowed to differ.
BG = (244, 245, 239)      # color.bg      #F4F5EF  warm paper
INK = (23, 25, 20)        # color.accent  #171914  ink

SF = "/System/Library/Fonts/SFNS.ttf"

OUT = "assets/images"

# Geometry, expressed as fractions of the canvas so every size is one render
# rather than a resample of a bigger one (a resampled hairline goes muddy).
LETTER = "R"
LETTER_SIZE = 0.60        # cap height relative to the canvas
LETTER_BASELINE = 0.635   # where the letter sits
RULE_WIDTH = 0.52
RULE_THICKNESS = 0.022
RULE_GAP = 0.085          # below the baseline


def font_at(px: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(SF, px)
    try:
        f.set_variation_by_name("Bold")
    except Exception:
        pass
    return f


def draw_mark(size: int, ink=INK, bg=None, safe_zone: float = 1.0) -> Image.Image:
    """The mark on `bg`, or on transparency when bg is None.

    `safe_zone` shrinks the artwork for Android's adaptive icon, where the
    launcher may mask away everything outside the middle ~66%.
    """
    img = Image.new("RGBA", (size, size), (bg + (255,)) if bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    s = size * safe_zone
    off = (size - s) / 2

    px = int(s * LETTER_SIZE)
    font = font_at(px)

    # Place by the glyph's real ink box, not by its metrics: SF Pro's line box
    # carries leading that would push the letter visibly off centre.
    box = d.textbbox((0, 0), LETTER, font=font)
    w = box[2] - box[0]
    h = box[3] - box[1]
    x = off + (s - w) / 2 - box[0]
    y = off + s * LETTER_BASELINE - h - box[1]
    d.text((x, y), LETTER, font=font, fill=ink)

    # The ledger rule the letter is written on.
    rw = s * RULE_WIDTH
    rt = max(2, round(s * RULE_THICKNESS))
    ry = off + s * (LETTER_BASELINE + RULE_GAP)
    rx = off + (s - rw) / 2
    d.rounded_rectangle([rx, ry, rx + rw, ry + rt], radius=rt / 2, fill=ink)

    return img


def write(img: Image.Image, name: str) -> None:
    path = f"{OUT}/{name}"
    img.save(path, "PNG")
    print(f"wrote {path} ({img.width}×{img.height})")


def main() -> None:
    # iOS + the store listing. Opaque, no transparency, no rounded corners —
    # the system masks it.
    write(draw_mark(1024, bg=BG).convert("RGB").convert("RGBA"), "icon.png")

    # Android adaptive: three layers, artwork inside the safe zone.
    write(Image.new("RGBA", (1024, 1024), BG + (255,)), "android-icon-background.png")
    write(draw_mark(1024, safe_zone=0.66), "android-icon-foreground.png")
    # The monochrome layer is a stencil: shape only, the launcher tints it.
    write(draw_mark(1024, ink=(0, 0, 0), safe_zone=0.66), "android-icon-monochrome.png")

    # The splash mark (app.json draws it at 76 pt on the paper background) and
    # the web favicon.
    write(draw_mark(512), "splash-icon.png")
    write(draw_mark(96, bg=BG), "favicon.png")


if __name__ == "__main__":
    main()
