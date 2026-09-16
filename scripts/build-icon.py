#!/usr/bin/env python3
"""
Derive every app icon asset from the one exported master (PLAN C1, rewritten
16 September 2026).

WHAT CHANGED, AND WHY THIS FILE NO LONGER DRAWS. Until now this script WAS the
icon: it set an "R" in SF Pro Bold over a ledger rule, in ink on warm paper,
and re-running it reproduced every size. That was the right call while the
brand had no drawn mark. It has one now — the geometric R with the circular
counter and the descending leg, exported at 1024 to
`assets/brand/app-icon-1024.png` (white on `color.brand`) and as a path to
`assets/brand/mark.svg` (which `src/components/brand-mark.tsx` draws).

A drawing script and an exported master cannot both be the source of truth. The
master wins, because it is where the mark is actually designed. So this file
DERIVES: it reads the export and emits the six assets `app.json` names. Running
it is now idempotent against the export rather than against a description of a
different icon — which is the bug that made the rewrite necessary, since the old
script would have quietly redrawn the retired letter-mark over the new one.

HOW THE MARK IS LIFTED OFF THE FIELD. The export is exactly two colours:
`#007AFF` behind, `#FFFFFF` on top. Their RED channels are 0 and 255, so the
red channel IS the mark's coverage mask, antialiased edges included — no
threshold, no path maths, and the mark keeps the export's own position and size
rather than a re-derived guess at them. (Green would be wrong: 122 vs 255 is a
partial separation. Blue would be useless: 255 in both.)

Not an app dependency: this needs python3 + Pillow on a dev machine and nothing
in `package.json` changes. Run it from the repo root:

    npm run build:icon
"""

from PIL import Image

MASTER = "assets/brand/app-icon-1024.png"
OUT = "assets/images"

# src/lib/theme/color.ts — the only place these numbers are allowed to differ.
BRAND = (0, 122, 255)     # color.brand      #007AFF  the one blue, the icon field
ON_INK = (255, 255, 255)  # color.onInk      #FFFFFF  a glyph sitting ON brand
INK = (23, 25, 20)        # color.textPrimary #171914 the mark inside the product


def mask() -> Image.Image:
    """The mark's coverage, 1024×1024, white where the mark is."""
    return Image.open(MASTER).convert("RGB").getchannel("R")


def tinted(coverage: Image.Image, rgb: tuple[int, int, int], size: int) -> Image.Image:
    """The mark in one flat colour on transparency, at `size`.

    Resampled from the 1024 coverage rather than re-rendered: LANCZOS on a
    coverage mask keeps the edge that the export already antialiased, where a
    redraw at a small size would have to guess at it.
    """
    a = coverage.resize((size, size), Image.LANCZOS) if size != coverage.width else coverage
    img = Image.new("RGBA", (size, size), rgb + (0,))
    img.putalpha(a)
    return img


def write(img: Image.Image, name: str) -> None:
    path = f"{OUT}/{name}"
    img.save(path, "PNG")
    print(f"wrote {path} ({img.width}×{img.height})")


def main() -> None:
    master = Image.open(MASTER).convert("RGB")
    coverage = mask()

    # iOS + the store listing. Opaque, no transparency, no rounded corners —
    # the system masks it. This is the export itself, passed through.
    write(master.convert("RGBA"), "icon.png")

    # Android adaptive: three layers. The mark sits 0.48 × 0.58 of the canvas
    # in the export, so it is already inside the inner 66% the launcher
    # guarantees — no safe-zone shrink, and the two platforms show the same
    # lockup rather than two different ones.
    write(Image.new("RGBA", (1024, 1024), BRAND + (255,)), "android-icon-background.png")
    write(tinted(coverage, ON_INK, 1024), "android-icon-foreground.png")
    # The monochrome layer is a stencil: shape only, the launcher tints it.
    write(tinted(coverage, (0, 0, 0), 1024), "android-icon-monochrome.png")

    # The splash mark, drawn by app.json at 76 pt on white. INK, not the field
    # blue and not white: inside the product the mark is one ink, the same one
    # `BrandMark` takes on the sign-in screen. White on blue belongs to the
    # icon, which is the one place the app is a tile on someone's home screen.
    write(tinted(coverage, INK, 512), "splash-icon.png")

    # The web favicon — the full tile, since a favicon is shown at tile size.
    write(master.resize((96, 96), Image.LANCZOS).convert("RGBA"), "favicon.png")


if __name__ == "__main__":
    main()
