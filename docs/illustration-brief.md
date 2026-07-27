# Brief — the Recore illustration system

Supersedes `docs/pictogram-brief.md` and `docs/svg-brief.md`. One illustration register ships,
not three: two visual languages in one funnel reads as two apps.

You are building a small, closed set of **monochrome line illustrations** for **Recore**, an iOS
training-record app (Expo, React Native, `react-native-svg@15.12.1`). They appear on named
onboarding screens and once on the paywall, in the product.

---

## 0 · The style, and the honest problem with it

The owner has chosen the **lineal / outline concept-illustration** language: a single thin
uniform black stroke, flat frontal construction, no shading, no colour, and selective **solid
ink masses** (hair, one garment per figure, one prop accent) used for compositional weight.

You must know what you are up against. This is the single most common stock-illustration style
on the internet, and the reference image the owner supplied is itself indistinguishable from a
stock pack — including its tells: an office, a laptop, a kanban board, a potted plant, and
floating decorative arcs, a squiggle, a dot, and a four-point sparkle. `CLAUDE.md` §1.5 forbids
cute, §2.2 names cheap-feeling illustration as what this app's user rejects on sight, and §1.2
says that user is an expert who does not need to be taught what a squat looks like.

So the style is approved and the **garnish and the subject matter are not**. What makes this set
credible rather than generic is entirely in four places:

1. **A measured line system**, locked in constants — not drawn by feel per illustration.
2. **Recore's own world as the subject**: a gym, a bar on the floor, a phone with a written
   line, a record accumulating. Never an office, never a desk, never a laptop, never a plant.
3. **Zero decorative garnish.** No arcs, swooshes, squiggles, sparkles, or floating dots.
4. **Technically correct lifting form**, because the audience is expert and a rounded-back
   deadlift or a wrist-bent bench press destroys more trust than any typography can rebuild.

If an illustration you produce could be relabelled "teamwork" or "productivity" and sold in a
pack, it has failed, no matter how well drawn.

---

## 1 · Read before you draw

In `recore/`:

- **`CLAUDE.md` in full.** It currently forbids this work in three places — §6.10 (no custom
  marks beyond the wordmark), §13.2 (no illustration, no centred hero in onboarding), and §1.5
  (never cute) — and §2.2 explains why. The owner has consciously overridden that, scoped to the
  screens named in §4. §7 of this brief is how you reconcile the document. Everything else in
  `CLAUDE.md` still binds absolutely: §1.2 (who the user is), §1.5 (voice), §6.2 (the record
  contract), §6.3 (colour), §17 (accessibility), §21 (words), §23 (definition of done).
- `src/lib/theme/{color,type,spacing,scale}.ts` — the live tokens. Read the comments.
- `src/components/primitives.tsx`, `src/components/motion.tsx`, `src/app/onboarding/index.tsx`,
  `src/app/paywall.tsx`.
- `PLAN.md` — the project is at Phase 0. Onboarding and the paywall are Phase 5, so these assets
  are authored standalone and wired in later.
- **`docs/reference/lineal-style-reference-01.png`** — the style reference. Open it and measure
  it before drawing anything; §2's ratios are derived from it. Read it for line grammar, ink-mass
  placement, and how faces are handled — and read §0 for everything in it you must not repeat.

**The colour situation, which decides your entire file format.** Shipped code is the *light*
scheme (warm paper `#F4F5EF`, surface `#FBFCF6`, ink `#171914`, `signal #547C00` reserved for
PLANNED values only). `CLAUDE.md` v3 specifies an unbuilt *dark-first* graphite scheme with
`ember #FF6B3D` in the same PLANNED-only role. A line illustration with hardcoded black strokes
and white fills is destroyed by that migration — inverted, it becomes a black rectangle with
white lines and unreadable masses.

Therefore **there is no black and no white in these files.** Every path carries exactly one of
three semantic roles (§3.4), and the accent never appears in an illustration at all: a drawing
is not a number the user has not lifted yet, so it has no claim on the accent, in either scheme.

---

## 2 · The measurable style law

Deliver `src/lib/illustration.ts` with the whole vocabulary as named constants. No illustration
file may contain a raw number for any of these. This file is the reason five separate drawings
read as one set.

Derive the ratios by measuring the supplied reference, then lock and document them. Starting
points, to be verified — not gospel:

| Property | Rule |
|---|---|
| Canvas | one authored viewBox for the whole set (square or a single fixed ratio), identical optical padding |
| Stroke width | **one** width across every path in every illustration, expressed as a fraction of viewBox width (reference lands near `vb / 500`) |
| Stroke terminals | round caps, round joins, consistently — never mixed, never tapered, never variable-width |
| Corner radii | two values only: a small radius for props, a large one for panels. Nothing hand-eased |
| Figure height | one figure height for the set, so people are the same size in every scene |
| Head | ≈ figure height / 7.5. Anything larger reads as a cartoon |
| Hands | simplified mitten with an indicated thumb; a fixed vocabulary of at most three hand shapes, reused |
| Feet | plain low shoe, two lines maximum |
| Depth | a **single offset contour** (one duplicated outer line, offset on one consistent side) on large architectural objects only. Never on figures. This replaces all shading |
| Ink mass budget | solid-filled area = **10–20%** of the drawing's ink area, computed and reported per illustration |
| Perspective | flat frontal, no vanishing point, no isometric. One consistent eye level across the set |
| Ground | no ground line, no shadow. Figures sit on an implied horizon shared by the whole set |
| Faces | **no eyes, no mouths, no eyebrows, no expressions.** Profile or three-quarter contour only — exactly as the reference does it. This is the property that keeps the style serious |

**Solid ink masses** are the compositional tool that carries the whole style, so they are
rationed: **hair, one garment per figure, and at most one prop accent per scene.** Distribute
them so the composition balances without a heavy corner, and report the area figures.

---

## 3 · Hard rules

### 3.1 Forbidden — the stock-illustration tells

Floating arcs, swooshes, ribbons, squiggles, sparkles, four-point stars, confetti, orbiting
dots, bubbles · potted plants (the most reliable single indicator that a drawing came from a
pack) · desks, office chairs, laptops, monitors, kanban boards, sticky notes, coffee cups ·
lightbulbs, rockets, gears, targets with arrows, checklists with giant ticks · gradients,
shadows, hatching, texture, grain, halftone, glow · isometric or 3D perspective · speech
bubbles, thought clouds · anything an "abstract concept vector illustration" pack contains.

### 3.2 Forbidden — the fitness-marketing tells

Flexing, posing, mirror shots, six-packs, muscle-definition lines, veins · sweat drops, motion
arcs, impact bursts, speed lines · gym-bro props: shakers, pre-workout tubs, hoods up, headphones
as personality · aspirational body types, crop-top-and-sports-bra styling, gendered fitness
clothing cues · anything triumphal: raised arms, podiums, medals, trophies, fireworks · emoji,
badges, stars, flames, streak icons (§15.3 forbids the flame explicitly).

Clothing is plain and unbranded: a t-shirt or long sleeve, plain trousers or shorts, a low shoe.
Bodies are ordinary and varied without being typed. No faces means no ethnicity or gender
signalling through features — vary build and hair silhouette instead, and keep it neutral.

### 3.3 Forbidden — text and data

No text inside any SVG, in any form. Words become **line-blocks** — the abstracted bars the
reference uses on its card — which is how this style already solves the problem, and it is the
only way the set survives Slovenian (§13.6), Dynamic Type, and every language the user writes in
(§17). Every real word on the screen is React Native `<Text>`, composed around the illustration.

No numbers either, drawn or implied as legible values. A depicted chart is an abstracted curve
with no axis, no labels, and no readable data points. §13.8 explicitly rejects Lyfta's
axis-free invented chart *presented as evidence*; an illustration may suggest a shape, but the
honest claim lives in the copy beside it, never in the drawing.

### 3.4 The three roles — the only colours that exist

Every path gets exactly one:

```
stroke  →  ink token            every line in the set, one width
fill    →  canvas/surface token opaque, for occlusion — never `fill="none"` on a shape
           that must hide what is behind it
solid   →  ink token (masses)   hair, one garment, one prop accent
```

- Opaque canvas fills, not transparency: this style depends on near objects hiding far ones, and
  a missing fill shows as lines bleeding through a torso. Draw in explicit back-to-front order.
- **Dark-scheme inversion must be verified, not assumed.** With the roles above, dark mode turns
  every solid mass into chalk-on-graphite, and a large hair mass that read as elegant on paper
  can read as a glaring blob. If it does, introduce **one** muted-ink token for masses in the
  dark scheme and fix it globally — never per path, never per illustration.
- No accent, no `signal`, no `ember`, in any illustration, in either scheme.

### 3.5 Lifting form is a correctness requirement

`CLAUDE.md` §1.2: the user already knows what a squat looks like. So every depicted lift must be
technically defensible — neutral spine on a deadlift, bar over mid-foot, wrists stacked over
elbows on a bench, knees tracking, a plausible bar path. Ask yourself for each figure whether a
coach would correct it. If they would, redraw it.

This is the one requirement in this brief that no stock illustrator meets, and it is worth more
to this audience than any amount of styling.

---

## 4 · The catalogue — five illustrations

Five. Each earns its screen or it is not built. A scene is expensive; a sixth mediocre one costs
more than it adds.

For each, the spec below states **what it must prove**. Design to the proof.

### I1 · Welcome — "Write your training the way you'd say it" (onboarding screen 1)

A lifter sits on a bench between sets, phone in hand, thumbing a line. A loaded bar rests on the
floor in the foreground. Behind or beside them, an oversized note plane holds two or three raw
line-blocks, and below those, one clean card of structured line-blocks.

**Proves the whole product in one frame:** their words go in, a record comes out, and it happens
in the gym between sets — not at a desk afterwards. This is the app's entire thesis (§1.1) and
the most important drawing in the set.

Note: screen 1 also carries a live self-typing specimen (§13.2). The illustration must sit
*with* it, not compete — verify the composition holds with a text specimen below it.

### I2 · "Your notes, understood" (onboarding screen 6)

An oversized note page as the dominant object. At the top, the user's own raw line as loose
line-blocks of uneven length. Beneath it, the same content again as a clean card: aligned rows,
a value column. A figure stands at the page, not touching it — the machine did the reading.

**Proves §4.3, the sacred-words principle**, drawn: the original stays intact and unedited above
its own clean projection. Never show the raw line being erased, corrected, or crossed out.

### I3 · The next target (onboarding screens 3–4, the goal payoff)

A lifter approaching a loaded bar — chalking hands, or setting up. Floating near them, one card
whose last row is set apart by a rule: the prescription. Line-blocks only, no legible numbers.

**Proves the Coach's promise** (§10): the app tells you what to beat, computed from your own
sets. The figure has not lifted yet — the whole scene is anticipation, which is exactly what a
PLANNED value is. Do not use the accent to say so; the composition says it.

### I4 · Rest, on the lock screen (paywall, the one illustration there)

A lifter seated between sets, phone face-up on the bench beside them, a pill-shaped countdown on
its screen. An oversized clock in the frame — the reference's clock, which happens to be the one
stock prop that is genuinely Recore's subject (§8.7: the rest timer on the lock screen, which
`CLAUDE.md` calls the difference between a timer and a rest timer).

**Proves the feature words handle worst**: the countdown lives outside the app, so you do not
hold your phone waiting. §14.3 keeps the paywall strictly monochrome — no exception here.

### I5 · The record accumulates (onboarding screen 14, "Your record is ready")

A wall or shelf of stacked session cards, months of them, drawn as receding panels with the
offset-contour treatment. A figure stands looking at it, small against the volume of it.

**Proves what a training record becomes** — the argument for staying, made once before the price
(§13.8: a record is only worth what it is long enough to show). No triumph, no arms raised. Just
someone standing in front of their own accumulated work.

### Not illustrated, deliberately

Screens 2, 5, 7, 9, 10, 11, 12, 13, 15, 16 · the four record surfaces (Today, Lifts, Progress,
You) · every empty state · the session summary · the share card. Screen 8's Slovenian hero is a
**real parse against the real prompt** (§13.6) and an illustration would undercut the only proof
on the strongest screen in the funnel. Do not add drawings to screens because there is space.

### Carried over from the superseded briefs

Two assets survive because a drawing cannot do their job. Build them in the same line grammar,
but never inside an illustration:

- **Wordmark** — outlined paths, onboarding screen 1 and the share card only (§6.10).
- **Price bars to scale** — $5.00 monthly-equivalent against $8.99 monthly in true proportion
  (55.6%), proving `SAVE 44%` instead of asserting it. If the ratio is not exact it is a lie and
  it fails review.

---

## 5 · Format, performance, accessibility

**Format.** Author each illustration as an optimised `.svg` in `assets/illustrations/`, then
render it through **one** loader component using `SvgXml` from `react-native-svg` — already a
dependency, so no new package (§19.3 forbids adding UI or illustration libraries). Put
placeholder role markers in the file (`%INK%`, `%CANVAS%`, `%MASS%`) and have the loader
substitute resolved theme tokens once and memoise the result. If you find a cleaner mechanism,
propose it in the report — but the constraints are fixed: no new dependency, no hex in any asset,
one substitution point, and it must survive the light→dark migration with zero edits to the art.

**Budgets, per illustration.** Optimise paths (SVGO-equivalent: merge, drop metadata, round
coordinates to a documented precision). Target **under 40 KB** and a documented path count. No
embedded rasters, no fonts, no filters. Avoid `mask` and prefer draw order plus opaque fills —
`react-native-svg` mask support is uneven, notably on Android. Keep `clipPath` to the minimum and
state where it was unavoidable.

**Render size.** Authored once, rendered roughly 280–360pt wide. Verify at the narrowest
supported device and at the largest, and confirm the single stroke width still reads as a line
rather than a hairline or a rope at both ends. Do **not** use `vector-effect="non-scaling-stroke"`
here — unlike a diagram, an illustration's line should scale with the art. Check the optical
result instead of assuming it.

**Performance.** These are static, mounted one per onboarding screen. Never inside a list, never
remounted on keystroke, never on a record surface. Memoise. If a screen's mount cost is visible,
report it rather than hiding it behind a spinner (§12.2 forbids one under 400ms).

**Accessibility.** The headline carries the meaning, so the illustration is decorative: hidden
from VoiceOver (`accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`)
so it is never read as a fragment. It contains no text and no data, so Dynamic Type does not
touch it — but verify the *layout* at `accessibilityLarge`: when the headline grows, the
illustration must shrink or crop from a defined edge, never squash and never push the primary
action off screen. §17: one primary action, always reachable.

**Motion.** At most one reveal on mount, using the existing `FadeSlideIn` in
`src/components/motion.tsx` with the existing tokens. No per-path animation, no drawn-line
effect, no parallax, no float. Honour `useReducedMotion()` (§7.5) — reduced means it is simply
there.

---

## 6 · Deliverables

- `src/lib/illustration.ts` — the locked style constants from §2.
- `assets/illustrations/*.svg` — five illustrations plus the wordmark, role-marked, optimised.
- One loader component and a typed name union; per-illustration wrappers only if they need
  different layout behaviour.
- A dev-only gallery route: all five at real render width, both colour schemes, at
  `accessibilityLarge`, plus a strip at 50% scale for the legibility check.
- A report: the locked ratios; ink-mass area per illustration; path count and file size per
  asset; which scenes you changed and why; your Mobbin references; the form-correctness pass
  (what you redrew after checking it against real lifting technique); and every judgement the
  brief left open.

**Do not** touch `src/app/onboarding/` or `src/app/paywall.tsx` — Phase 5 wires these in. **Do
not** add a dependency.

---

## 7 · Reconcile the document

This set ships in-product, so `CLAUDE.md` must stop forbidding it. Propose a **minimal diff and
stop for approval — do not apply it.** Narrow enough that it cannot be read as permission to
decorate the rest of the app:

- **§13.2** — replace the blanket "no illustration, no centred hero" with an explicit allowance:
  one monochrome line illustration on the five screens named in §4, and nowhere else in the
  funnel. Keep the ban on carousels.
- **§6.10** — carve out the illustration set alongside the wordmark, and reaffirm SF Symbols for
  everything that is UI. No illustration may become an icon, a tab icon, or replace a system
  symbol.
- **§2.2** — one line distinguishing this constructed, garnish-free set from the cheap
  illustration the section rejects, so the distinction is written down rather than remembered.
  Name the tells (§3.1, §3.2) as the boundary.
- **§6.3** — state that illustrations carry no accent, in either scheme.
- **§20** and **Appendix A** — one row each: the loader component, and the change.
- Add the hard line that keeps this contained: **no illustration on Today, Lifts, Progress, or
  You, ever.** The record surfaces stay undecorated.

If you conclude the diff cannot be written narrowly enough to be safe, say so plainly. That is a
finding, not a failure.

---

## 8 · Use Mobbin, as evidence, not as style

Authenticate if prompted. Search: onboarding screens where a full illustration carries the hero;
monochrome and line-art illustration in mobile onboarding; fitness and training onboarding
heroes; paywall header art. Note how much vertical space the drawing takes against the headline
and the CTA, and how many screens in a funnel carry art versus none.

Bring back per illustration: two or three concrete references (app, screen, the drawing's share
of the viewport, its relationship to the headline), plus one **counter-example** — a screen where
the illustration is doing nothing — and name the failure mode you are avoiding.

Most of what you find will be more decorated, more colourful, and more generic than this app is
allowed to be. **Mobbin calibrates size, placement, and how often. The reference image and §2
decide the drawing.** Do not blend them.

---

## 9 · Acceptance checklist

- [ ] One stroke width, one cap/join style, one head-to-body ratio, one figure height across all
      five. Every value from `src/lib/illustration.ts`.
- [ ] No eyes, mouths, or expressions anywhere.
- [ ] Ink-mass area within 10–20%, computed and reported per illustration.
- [ ] Zero garnish: no arcs, squiggles, sparkles, dots, plants, laptops, desks, or office props.
- [ ] Zero fitness-marketing tells; no triumph; no flame, badge, or streak iconography.
- [ ] Every depicted lift is technically defensible.
- [ ] No text and no legible number inside any SVG. Words are line-blocks; real copy is RN text.
- [ ] Every path carries one of the three roles. No hex, no `black`, no `white`, no accent.
- [ ] Occlusion correct: opaque canvas fills, deliberate back-to-front order, nothing bleeding
      through a body.
- [ ] Verified in both schemes; mass legibility on dark fixed globally by one token if needed.
- [ ] Under 40 KB and within the documented path count per asset; no rasters, filters, or
      avoidable masks.
- [ ] Legible at real render width and at 50% scale; stroke reads as a line at both extremes.
- [ ] Hidden from VoiceOver; layout holds at `accessibilityLarge` with the primary action still
      on screen.
- [ ] One reveal maximum, Reduce Motion honoured.
- [ ] `npm run typecheck`, `npm test`, `npm run lint` pass; no literals outside
      `src/lib/theme/` and `src/lib/illustration.ts` (§23).
- [ ] The `CLAUDE.md` diff is written, narrow, and awaiting approval — not applied.
- [ ] Final test, applied to each drawing: **could this be relabelled "teamwork" and sold in a
      stock pack?** If yes, it is not finished.
