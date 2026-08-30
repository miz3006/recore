# Lyfta — Exercise Detail › Progress

App `6443740936` · "Lyfta: Gym Workout Tracker Log". Studied 28 Aug 2026 for the
Recore Progression rebuild. Images in `img/` (watermark top-left is Appllama
provenance, not part of the screen).

| ref | name | flow | pos |
|---|---|---|---|
| `6443740936/oth_v4hq9` | Exercise Progress Charts | Exercise Detail | 16 |
| `6443740936/oth_pj6we` | Exercise Progress Stats | Exercise Detail | 17 |

Reported colours: `#FFFFFF` page · `#EEF2FA` card · `#A7A7A7`/`#B9B9B9` chart
ink · `#D8DDE4` gridline · `#111111` heading · `#007AFF` (control only).

## Geometry, measured at 1170×2532 (÷3 → pt on a 390 pt screen)

- Page margin 16 pt. Card width ~358 pt, radius ~20 pt.
- Card inner padding ~20 pt all round; top padding ~28 pt (generous).
- Metric name ~19 pt / 700, ink. Chevron right, ~20 pt, mid grey, vertically
  aligned with the name's cap height — not its baseline.
- The value: ~48 pt, weight 800, **grey not ink**, tabular. Unit is a ~18 pt
  bold suffix in the same grey, sitting on the same baseline.
- Sub-label ~16 pt regular, one notch lighter than the value.
- Chart ~180–200 pt tall, gridlines inset to the same ~20 pt as the text.
- **6 gridlines**, evenly spaced ~32 pt apart, hairline, spanning the full
  inner width. No axes, no ticks, no legend, no labels, no y-scale.
- Line: ~2 pt, smoothed (Catmull-ish, real overshoot between points), dot at
  every point r≈4. **The series is not scaled to the gridlines** — the peak dot
  sits above the top line and the trough between lines. Gridlines are texture.
- Bars: square corners, no radius, solid mid grey, wide with narrow gaps
  (~7 bars filling the width), **sitting on the bottom gridline**.
- Card gap ~24 pt; the next card peeks at the scroll edge.

## The thing worth stealing

The empty state. Value reads `00 kg`, sub-label `No data yet` — and the chart is
**still drawn**, in full, as a grey placeholder shape. The screen never looks
broken, never looks empty, and never explains itself. It looks like a screen
waiting for you rather than a screen that failed.

## The thing not to steal

`#EEF2FA` is a cool blue-grey card on white — about 5 % darker than the page and
slightly cool. Recore's paper is warm and its surfaces sit *lighter* than the
canvas, so the tonal separation transfers and the direction and hue do not.
Lyfta is monochrome because Lyfta has no plan; we have one, so `#547C00` gets
the planned continuation and nothing else on the screen gets colour.
