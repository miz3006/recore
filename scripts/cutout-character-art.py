"""Key the baked-in transparency checkerboard out of the cap-character art.

The exports in assets/new_onboarding/ are 1024x1024 with NO alpha: the
checkerboard an image editor draws BEHIND a transparent layer was flattened
into the picture. This removes it, trims the result to the drawing, and writes
assets/new_onboarding/cutout/<name>.png. Originals are never touched.

Run: python3 scripts-local/cutout.py     (needs pillow + scipy)
"""
from PIL import Image
import numpy as np
from scipy import ndimage
import sys, os

SRC = 'assets/new_onboarding'
DST = f'{SRC}/cutout'


def cutout(name: str) -> None:
    im = Image.open(f'{SRC}/{name}.png').convert('RGB')
    a = np.array(im).astype(np.int16)
    mx, mn = a.max(2), a.min(2)
    neutral = (mx - mn) <= 10
    cand = neutral & (mn >= 226)
    grey = neutral & (mn >= 228) & (mx <= 246)   # the darker checker square
    white = neutral & (mn >= 250)                 # the lighter one

    lab, n = ndimage.label(cand)
    border = set(np.unique(np.concatenate([lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]]))) - {0}

    # A region is background if it touches the edge OR carries BOTH checker
    # tones — that second test is what removes the enclosed gaps (between the
    # legs, under the bag strap) without touching the character's own whites,
    # which are one flat tone.
    gn = ndimage.sum(grey, lab, index=range(1, n + 1))
    wn = ndimage.sum(white, lab, index=range(1, n + 1))
    sn = ndimage.sum(np.ones_like(lab, bool), lab, index=range(1, n + 1))
    ids = [i for i in range(1, n + 1)
           if sn[i - 1] >= 12 and (i in border or (gn[i - 1] / sn[i - 1] > 0.12 and wn[i - 1] / sn[i - 1] > 0.12))]
    bg = np.isin(lab, ids)

    alpha = np.where(bg, 0, 255).astype(np.uint8)
    # The anti-aliased ring where ink met checker: half-transparent, so the edge
    # does not carry a bright halo onto the paper canvas.
    edge = ndimage.binary_dilation(bg, iterations=1) & ~bg & (mn >= 200)
    alpha[edge] = 110

    out = Image.fromarray(np.dstack([np.array(im), alpha]), 'RGBA')
    out = out.crop(out.getbbox())
    pad = max(4, int(0.02 * max(out.size)))
    canvas = Image.new('RGBA', (out.width + pad * 2, out.height + pad * 2), (0, 0, 0, 0))
    canvas.paste(out, (pad, pad))
    if canvas.height > 900:  # 3x the largest place any of them is drawn
        s = 900 / canvas.height
        canvas = canvas.resize((max(1, round(canvas.width * s)), 900), Image.LANCZOS)
    canvas.save(f'{DST}/{name}.png', optimize=True)
    print(f'{name}: -> {canvas.size}  aspect={canvas.width / canvas.height:.3f}')


if __name__ == '__main__':
    os.makedirs(DST, exist_ok=True)
    names = sys.argv[1:] or sorted(f[:-4] for f in os.listdir(SRC) if f.endswith('.png'))
    for name in names:
        cutout(name)
