"""Odstrani zapečeno mrežo prosojnosti iz onboarding ilustracij.

Mrežo prepozna po PERIODIČNOSTI, ne po svetlosti: risba ima lahko svojo
svetlo ploskev (tabla, koža), mreža pa je edina, ki se ponavlja na ~14-26 px.
Datoteke brez periodičnega signala pusti nedotaknjene.
"""
import sys
import numpy as np
from PIL import Image

PERIOD_MIN, PERIOD_MAX = 14, 26
SCORE_MIN = 12.0          # ločnica: mreže 13-36, prave ploskve 4-8
LIGHT_MIN = 205           # nad tem ni nobene prave črnilne vrednosti


def periodicity(mask):
    best = 0.0
    for axis in (0, 1):
        p = mask.sum(axis=axis).astype(float)
        if p.sum() == 0:
            continue
        p = p - np.convolve(p, np.ones(41) / 41, mode='same')
        F = np.abs(np.fft.rfft(p * np.hanning(len(p))))
        fr = np.fft.rfftfreq(len(p))
        b = (fr > 1 / PERIOD_MAX) & (fr < 1 / PERIOD_MIN)
        if not b.any():
            continue
        best = max(best, F[b].max() / max(np.median(F[fr > 1 / 60]), 1e-9))
    return best


def degrid(path):
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im)
    flat = a.reshape(-1, 4)
    cols, counts = np.unique(flat, axis=0, return_counts=True)
    lum = cols[:, :3].mean(axis=1)
    cand = np.where((lum > LIGHT_MIN) & (cols[:, 3] > 60) & (counts > 800))[0]

    tiles = []
    for i in cand:
        m = np.all(a == cols[i], axis=2)
        if periodicity(m) >= SCORE_MIN:
            tiles.append((cols[i], lum[i]))
    if not tiles:
        return im, 0, 0.0

    kill = np.zeros(a.shape[:2], bool)
    for col, l in tiles:
        kill |= np.all(a == col, axis=2)
        # robovi ploščic: ista skoraj bela družina, delna prosojnost
        near = (np.abs(a[..., :3].astype(np.int16).mean(axis=2) - l) <= 8) & (a[..., 3] < 200) & (a[..., 3] > 0)
        kill |= near

    b = a.copy()
    b[kill, 3] = 0
    return Image.fromarray(b), int(kill.sum()), max(periodicity(np.all(a == t[0], axis=2)) for t in tiles)


if __name__ == '__main__':
    for p in sys.argv[1:]:
        out, n, s = degrid(p)
        print(f"{p}  odstranjeno {n:7d} px  periodičnost {s:5.1f}")
