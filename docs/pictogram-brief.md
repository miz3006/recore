# Brief — the Recore pictogram system

> **SUPERSEDED, 27 July 2026.** The owner chose lineal outline illustrations instead — build to
> `docs/illustration-brief.md`. The wordmark and the to-scale price bars carry over there;
> everything else here is history. Kept for the reasoning, not as instructions.

Supersedes the earlier schematic-assets brief (`docs/svg-brief.md`), except for three items
carried over in §7.

You are building **one pictogram system** for **Recore**, an iOS training-record app (Expo,
React Native, `react-native-svg@15.12.1`). Figures and equipment: bench press, squat, deadlift,
runner, dumbbell, carry, hold, sled. They appear in onboarding and on the paywall, in the
product, not in marketing only.

**The style is decided and it is not open for interpretation: Otl Aicher's Munich 1972
pictogram grammar.** Solid ink silhouettes, constructed on an angular grid, no faces, no
outlines, no strokes. Adjacent legitimate references, in this order: Aicher (Munich '72 and the
ERCO pictogram books), Gerd Arntz's Isotype figures, the AIGA/DOT 1974 symbol signs.

Your prior for "flat vector fitness illustration" is the exact failure mode this brief exists to
prevent. Do not draw. **Construct**: a pictogram is the output of a module system, and if the
system is right the figures cannot drift out of style, because there is no freehand left in
them.

---

## 1 · Read before you start

In `recore/`:

- **`CLAUDE.md` in full**, and know that it currently *forbids this work* in four places: §6.10
  (no custom icon set), §13.2 (no illustration in onboarding), §1.5 (never cute), and §2.2,
  where Lyfta's cartoon avatars are named as what this app's user reads as cheap. The owner has
  consciously overridden that for a rigorous pictogram system scoped to onboarding and the
  paywall. §8 of this brief is how you reconcile the document. Everything else in `CLAUDE.md`
  still binds absolutely — especially §1.5 (voice), §6.2 (the record contract), §6.3 (colour),
  §17 (accessibility), §21 (words), §23 (definition of done).
- `src/lib/theme/{color,type,spacing,scale}.ts` — the live tokens. Read the comments.
- `src/components/primitives.tsx`, `src/app/onboarding/index.tsx`, `src/app/paywall.tsx`.
- `PLAN.md` — the project is at Phase 0; onboarding and paywall are Phase 5, so these assets are
  authored standalone and wired in later.

**The colour conflict you must design around.** Shipped code is the *light* scheme (warm paper
`#F4F5EF`, ink `#171914`, `signal #547C00` reserved for PLANNED values only). `CLAUDE.md` v3
specifies an unbuilt dark-first graphite scheme with `ember #FF6B3D` in the same PLANNED-only
role. Therefore every pictogram is **one flat fill, resolved from a theme token at runtime**, and
survives the migration with no code change. No hex literal anywhere. **The accent never touches
a pictogram** — a figure is not a number the user has not lifted yet, so it has no claim on the
accent, in either scheme.

---

## 2 · The module system — build this first, before any figure

Deliver `src/lib/pictogram.ts` containing the entire geometry vocabulary as named constants. No
figure file may contain a magic number. If a proportion needs to change, it changes once, there,
and the whole set moves together. This file *is* the reason the set stays consistent.

**Grammar, non-negotiable:**

- Every edge runs at **0°, 45°, or 90°**. If you can justify adding 22.5° as a systematic fourth
  angle, add it to the constants and use it across the whole set or not at all. No other angle
  exists.
- **Solid positive shapes, one fill, no stroke, no outline, no line weight.** `fill` only,
  `fillRule="evenodd"`. There is no border and no second tone. A pictogram is a silhouette.
- **Limbs are separated elements with visible gaps at the joints** — this is the single most
  characteristic property of the Aicher grammar and the thing a naive figure gets wrong by
  drawing one continuous body.
- **Limb ends are cut flat**, square or at 45°. Never rounded caps. Rounded caps are the tell of
  a friendly icon set.
- **The head is a detached disc.** Small. A head that reads as large is a cartoon.
- Uniform limb module across the entire set: **the runner's thigh and the bench presser's
  forearm are the same thickness.** Equipment is built from the same module — a barbell shaft, a
  bench, a sled handle all derive from it.

**Starting proportions**, to be verified against reference and then locked. These are a point of
departure, not gospel — measure real Aicher figures, adjust once, document the final ratios in
the constants file:

```
H     figure height (the module base)
head  ≈ H / 6      detached disc
limb  ≈ H / 11     uniform thickness, every limb, every figure
gap   ≈ limb / 4   joint separation
grid  all vertices land on H / 24
```

**Optical balance across the set.** Equal *perceived* weight, not equal bounding box. A dumbbell
and a running figure occupy very different areas; in a row they must not read as one heavy and
one light. Compute filled area per pictogram, keep the spread tight, and record the numbers in
your report. This is the difference between a system and eight drawings.

**Same frame.** Every pictogram uses one square viewBox with identical optical padding, so a row
of them aligns on a shared baseline and optical centre without per-figure nudging.

---

## 3 · Forbidden, without exception

Faces, eyes, mouths · fingers, toes, shoes, hair · clothing, shorts, singlets · muscle
definition or anatomy · motion arcs, speed lines, swooshes, sweat, impact bursts · exaggerated or
bobblehead proportions · outlines, strokes, second tones, gradients, shadows, glows, blurs,
grain, texture · a containing circle, badge, squircle, or plate behind the figure · isometric or
3D perspective · gendered silhouettes (no chest, hip, or hair cues — one neutral body, as in
§1.3's audience: a serious trainee, not a demographic) · text inside the SVG · emoji · anything
"dynamic" in the sports-branding sense.

Two positive constraints that follow from `CLAUDE.md`:

- **Never replace an SF Symbol with a pictogram.** `expo-symbols` is in the project. Chevrons,
  checkmarks, mic, calendar, lock, share: system symbols, always (§6.10). A pictogram depicts a
  *training action or implement* and nothing else. The moment you find yourself drawing UI, stop.
- **Never a tab icon, never in Today / Lifts / Progress / You.** The record surfaces stay
  wordless and unillustrated. This set exists in onboarding and on the paywall.

---

## 4 · The catalogue

Eight to ten pictograms, maximum. A tight set that is unmistakably one family beats a broad set
that drifts. Each entry names the job it does — if a pictogram has no job, it does not get built.

**Lifts** (`CLAUDE.md` §9.3 shows what the parser actually receives, so the set should mirror
real logged work, not a gym poster's idea of it):

1. **Bench press** — lying press. The app's canonical example lift; it appears in nearly every
   spec, demo, and eval case.
2. **Squat** — barbell back squat.
3. **Deadlift** — the strength archetype.
4. **Dumbbell** — the implement alone, for isolation and DB work. Object, not figure.
5. **Overhead press** *or* **pull-up** — pick one and justify it; both is redundant in a set
   this size.

**Non-lifting work.** §2.4 claims runs, carries and holds are *first-class*, and that is the one
competitive claim words handle badly. These pictograms are the proof:

6. **Runner** — cardio, the `5k easy 26min` line.
7. **Carry** — farmer's walk, figure with a load in each hand.
8. **Sled push** — the Hyrox archetype.
9. **Hold** — plank, or an overhead/front hold. Optional; build it only if the set stays
   coherent with it.

### Where they appear

**Onboarding screens 3–4, the goal question and its payoff.** This is the set's primary job:
*Strength · Hypertrophy · Both · Hybrid/Hyrox* become four option rows, each carrying a
pictogram. Strength reads as barbell work, hypertrophy as dumbbell work, hybrid as runner +
sled. Selected state changes the fill token (full ink vs the muted/echo tone from `color.ts`'s
`ink` ladder) — never a colour, never an accent, never a badge. Rendered around 28–32pt, which is
the size that governs the whole module: **if it is not identifiable at 28pt, the module is
wrong.**

**The paywall — one band, not one icon per bullet.** A pictogram per feature row is generic
icon-list design and it is where this set would turn into slop. Instead: a single horizontal
**frieze** of the set — lift, run, carry, hold, in a row, evenly weighted — sitting once on the
screen. In the Munich system a pictogram frieze *is* the artifact, and here it does real work: it
proves "everything you do fits, not just barbell sets", which is §2.4's differentiator and the
hardest thing on that screen to say in words. Strictly monochrome, per §14.3 (no colour on the
paywall, deliberately).

**Nowhere else in onboarding.** Screen 1 and screen 8 are live parse demos and must stay the
product itself (§13.2, §13.6). Screens 5–7 are text payoffs. Screen 13 is the build beat. Do not
add figures to them because there is space.

---

## 5 · Sizes, states, motion, accessibility

- Three render sizes must all work from one geometry: **28pt** (option rows), **48pt** (frieze),
  **~120pt** (any single hero use). No size-specific variants, no detail that only survives large.
- **Legibility gate:** at 28pt, blurred or squinted, each pictogram is still identifiable, and
  identifiable *without its label*. Test it, report which ones failed first, fix the module — not
  the individual figure.
- **States:** default = ink, unselected/quiet = the ink ladder's echo tone, disabled = the
  disabled rung. Three states, from tokens, nothing else.
- **Motion: none.** These do not animate. A selection change may cross-fade its fill using the
  existing tokens in `src/components/motion.tsx`; that is the only movement permitted, and it
  respects `useReducedMotion()` (§7.5).
- **Accessibility:** a pictogram never carries information alone — every one has a real RN
  `<Text>` label beside it (§17, and it is the only way this survives Slovenian, §13.6). So the
  SVG is `accessibilityElementsHidden` and the row reads as one element with the label's text.
  Verify fill contrast against `bg` and `surface` in both schemes.
- Dynamic Type: the pictogram scales with the label's rung via `moderateScale`, so a 28pt figure
  next to `accessibilityLarge` text does not become a speck. Numbers and words never shrink
  (§6.5), so neither does the figure beside them.

---

## 6 · Deliverables

- `src/lib/pictogram.ts` — the module constants and the angle set. The single source of geometry.
- `src/components/pictograms/<name>.tsx` — one typed RN component each; props are `size` and a
  semantic `tone`, never a `color` prop (§20). Fill resolves from the theme hook inside.
- `src/components/pictograms/index.ts` — barrel with a typed name union.
- A dev-only gallery route: the whole set in a row at 28 / 48 / 120pt, both colour schemes, at
  three Dynamic Type sizes including `accessibilityLarge`, plus a deliberately downscaled and
  blurred strip for the legibility gate.
- A report: the final locked proportions, the filled-area balance table, which catalogue entries
  you killed and why, your Mobbin references, and every judgement the brief left open.

**Do not** touch `src/app/onboarding/` or `src/app/paywall.tsx` (Phase 5 wires them). **Do not**
add a dependency — §19.3 forbids new UI, icon, or illustration libraries.

## 7 · Carried over from the earlier brief

Three assets survive, because a pictogram cannot prove what they prove. Build them in the same
ink-only discipline, but do not mix registers: a figure and a diagram never appear in the same
drawing.

- **Wordmark** — outlined paths, screen 1 and the share card only, per §6.10.
- **Trial timeline rail** — hairline rail, three ticks: today, the day-25 reminder, the day-30
  charge. Real computed dates as RN text. §14.3 names hidden charge dates as this category's
  most common dark pattern.
- **Price bars to scale** — $5.00 monthly-equivalent against $8.99 monthly, in true proportion
  (55.6%). Proves `SAVE 44%` instead of asserting it. If the ratio is not exact, it is a lie and
  it fails review.

Everything else from that brief (raw→structure schematic, alias fan-in, progression ladder,
plate pair, week grid, signal-length panels) is superseded — mention any you think should return
in the report, but do not build them.

## 8 · Reconcile the document

Since this set ships in-product, `CLAUDE.md` must stop forbidding it. Propose a **minimal diff
and stop for approval — do not apply it.** It should be narrow enough that it cannot be read as
permission to decorate:

- **§6.10** — carve out one exception: a single pictogram system, ink-only, depicting training
  actions and implements, in onboarding and on the paywall exclusively. Reaffirm SF Symbols for
  everything that is UI, and reaffirm that no pictogram may become a tab icon or appear on
  Today / Lifts / Progress / You.
- **§13.2** — amend "no illustration" to permit pictograms on the option and payoff screens
  named in §4 above, while keeping the ban on centred hero art and carousels.
- **§2.2** — add one line that distinguishes a constructed pictogram system from the cartoon
  avatars the section rejects, so the distinction is written down rather than remembered.
- **§20** and **Appendix A** — one row each: the component, and the change.

If you conclude the diff cannot be written narrowly enough to be safe, say so plainly in the
report. That is a legitimate finding, not a failure.

## 9 · Use Mobbin, as evidence, not as style

Authenticate if prompted. Search: onboarding goal-selection and option rows that carry a mark;
training/fitness onboarding where illustration earns its place; hybrid and Hyrox apps;
paywall feature bands and header art.

Bring back per use-case: two or three concrete references (app, screen, mark size, placement,
what fraction of the screen it takes, how many marks per screen), plus one **counter-example** —
a screen where the illustration does nothing — and name the failure mode.

Almost everything you find will be more decorated than this app is allowed to be, and much of it
will be exactly the 3D-blob and cartoon-mascot work the style choice rejects. **Mobbin is for
calibrating size, placement, and count. Aicher is the style authority.** Do not blend them.

## 10 · Acceptance checklist

- [ ] Every proportion comes from `pictogram.ts`; no magic number in any figure file.
- [ ] Every edge is 0° / 45° / 90° (or the one documented fourth angle, used set-wide).
- [ ] Solid single fill; zero strokes, zero outlines, zero gradients, zero shadows.
- [ ] Detached head; separated limbs with real joint gaps; flat-cut limb ends.
- [ ] One limb thickness across the whole set, figures and equipment alike.
- [ ] Filled-area balance verified and tabled; no pictogram reads heavy in a row.
- [ ] Identifiable at 28pt, blurred, and without its label.
- [ ] One square viewBox and one optical padding for the whole set; a row aligns with no nudges.
- [ ] No accent colour on any pictogram, in either scheme. Paywall assets pure monochrome.
- [ ] Zero colour / font-size / spacing literals outside `src/lib/theme/` (§23).
- [ ] No pictogram where an SF Symbol belongs; none on the four record surfaces; none as a tab icon.
- [ ] Labels are RN text; SVGs hidden from VoiceOver; both schemes contrast-verified.
- [ ] `npm run typecheck`, `npm test`, `npm run lint` pass.
- [ ] Nothing in the set could be mistaken for stock flat-vector fitness illustration.
- [ ] The `CLAUDE.md` diff is written, narrow, and awaiting approval — not applied.
