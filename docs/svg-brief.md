# Brief — vector assets for Recore onboarding + paywall

> **SUPERSEDED, 27 July 2026.** The owner chose a figurative Otl Aicher-style pictogram system
> instead — build to `docs/pictogram-brief.md`. Three assets from this brief survive there
> (wordmark, trial timeline rail, price bars to scale); everything else here is history. Kept
> for the reasoning, not as instructions.

You are designing and building a small, closed set of vector assets for **Recore**, an iOS
training-record app (Expo, React Native, `react-native-svg@15.12.1`). These are **not
illustrations**. Recore's own spec forbids illustration in onboarding (CLAUDE.md §13.2) and
forbids shipping a custom icon set (§6.10). What you are making instead are **instrument
diagrams and specimens**: precise drawings of objects the app itself produces, or schematics
that prove a claim the copy cannot make alone.

If any asset you produce could plausibly appear in a stock illustration pack, it is wrong.

---

## 1 · Read before you draw

In `recore/`:

- **`CLAUDE.md` in full.** It is the source of truth and it wins over anything here.
  Load-bearing sections: §4 (principles), §6 (visual system — record contract, colour, type,
  space, shape, elevation, iconography), §7 (motion), §13 (onboarding, screen by screen),
  §14.3 (the paywall layout), §17 (accessibility), §20 (components), §21 (words).
- `src/lib/theme/{color,type,spacing,elevation,scale}.ts` — the live tokens. Read the comments,
  not just the values.
- `src/components/{primitives,charts,motion}.tsx` and `src/app/onboarding/index.tsx`,
  `src/app/paywall.tsx` — the house style you must be indistinguishable from.
- `PLAN.md` — for where the project actually is (Phase 0).

**Know this conflict before you pick a single colour.** The shipped code is on the *light*
scheme: warm paper (`bg #F4F5EF`, `surface #FBFCF6`), ink `#171914`, and `signal #547C00`
reserved for PLANNED values only. `CLAUDE.md` v3 specifies a *dark-first* graphite/chalk scheme
with `ember #FF6B3D` in the same PLANNED-only role, and that migration is unbuilt (PLAN.md
Phase 1). Consequence, and it is non-negotiable: **every asset must be theme-agnostic and
token-driven so it survives the migration untouched.** Not one hex literal in any file you
write. Colour arrives as a prop resolved from the theme at the call site.

---

## 2 · The one test every asset must pass

> Does the drawing prove something the adjacent caption cannot say in words?

If the copy next to it already states the point, the drawing is decoration — delete it and say
so in your report. Recore's onboarding is allowed to be sixteen screens long *only* because its
length comes from proof rather than from posters (§2.3). An asset that adds a beat without
adding evidence makes the funnel worse, not richer.

You are expected to kill at least one asset from the list below on these grounds. A brief that
comes back with everything approved has not been reviewed.

---

## 3 · Hard rules

**Form**
- Stroke-first geometry. One stroke-weight family: hairline (1pt) for rules and structure,
  1.5pt for the one element that carries the meaning. Nothing heavier.
- `vector-effect="non-scaling-stroke"` on every stroked path, so hairlines stay hairlines when
  the asset is scaled.
- Geometry sits on the 4pt grid. Radii come from the shape tokens, and nested radii are
  concentric (inner = outer − padding), per §6.7.
- **Forbidden, no exceptions:** gradients, drop shadows, glows, blurs, blobs, isometric or 3D
  perspective, hand-drawn wobble, dumbbells, barbell-plate clipart used decoratively, anatomy,
  muscle diagrams, mascots, faces, human figures, confetti, sparkles, badges, medals, ribbons,
  emoji, stars, trophies, "AI" motifs (orbs, neural nets, sparkle-wands).
- No filled areas except where a fill *is* the datum (a filled week slot, a filled plate, the
  elapsed portion of a rail). Fills use a token, never an opacity guess — the opacity ladder in
  `color.ts` (`ink.*`) is the only source of alpha.

**Colour**
- Monochrome by default: ink, muted ink, rule. `alpha()` from `color.ts` for anything softer.
- The accent (`signal` today, `ember` after the migration) may appear on **at most one element
  in at most two of these assets**, and only where the element depicts a number that has not
  been lifted yet — that is the entire meaning of the accent (§6.2). Where it appears, the word
  `next` must be adjacent as real text. Nowhere else. Not on the wordmark, not on the paywall,
  not on a CTA, not to "add warmth".
- The paywall assets are **strictly monochrome**. §14.3: no colour on that screen, deliberately.

**Text**
- **Geometry only inside the SVG. Every word and every number is a real React Native `<Text>`,
  composed in layout around or over the SVG.** This is the most important technical rule here.
  Baked-in text breaks Dynamic Type (§17, supported to `accessibilityLarge`), breaks Slovenian
  and any other language the user writes in (§13.6), and breaks the two-face type contract
  (words humanist, numbers mono+tabular, §6.5).
- The single exception is the wordmark, which is a mark: outlined paths, no live font
  dependency, no text element.

**Icons**
- Never draw an icon where an SF Symbol exists. `expo-symbols` is already in the project.
  Checkmarks, chevrons, arrows, locks, mics, calendars: SF Symbols. If you find yourself
  drawing a glyph, stop.

**Motion**
- `react-native-svg` does not do SMIL, and CSS animation does not exist here. If an asset
  animates, it animates by driving props from Reanimated 4 through the existing tokens in
  `src/lib/theme` / `src/components/motion.tsx` — never a new animation approach.
- Motion explains or it is removed (§7.3, §7.5). Honour `useReducedMotion()`: reduced means
  opacity-only or a static end state, and it never removes information.
- Most of these assets should not animate at all. Justify each one that does.

**Accessibility**
- Legible at 1x on the narrowest supported device, and still legible at `accessibilityLarge`.
  Nothing meaningful below ~1.5pt of visual detail.
- If the diagram carries information the surrounding copy does not, the component exposes
  `accessibilityRole="image"` with a sentence-shaped label. If the copy already says it, the
  asset is hidden from VoiceOver (`accessibilityElementsHidden`) so it is not read twice.
- Verify contrast of every stroke against both `bg` and `surface`, in both schemes.

---

## 4 · The assets

Each spec below states what the asset must **prove**. Design to the proof, not to the
description — if you find a cleaner geometry that proves the same thing, take it and say why.

### Onboarding

**A1 · Wordmark** — screen 1 and the share card, the only two places it may appear (§6.10).
Outlined paths, one weight, works at 20pt height and at 400pt, in ink on paper and in chalk on
graphite. Deliver a horizontal lockup and, if it survives its own test, a compact mark for the
share card capture. Restraint: this is a record-keeper's mark, not a fitness brand's.

**A2 · Raw line → structure** — screen 6, *"Your notes, understood."*
Proves the wedge: the user's own sentence stays intact, and a clean record appears underneath
it. Composition is a raw text line, a bracket or rule that reads as derivation, and the
structured row beneath. The user's words must read as *primary* and the structure as *derived*
— that is §4.3 drawn as geometry. The SVG supplies the bracket/rules only; both lines of text
are RN `<Text>` in their correct faces.

**A3 · Alias fan-in** — screen 8, the language payoff.
Three or four of the user's own words converge on one canonical row. Proves the claim no
competitor can make: you never change how you write. Curves must be a single continuous stroke
family and must not read as a flowchart or an org chart. Slovenian labels are RN text, so the
geometry has to tolerate strings of very different widths — build it to a layout, not to a
fixed viewBox.

**A4 · Progression ladder** — screen 4, the goal payoff, two variants.
Proves the one mechanic the user must trust before the Coach can work (§10.2, §13.4).
*Hypertrophy:* reps fill toward the top of the range, then the load steps. *Strength:* the load
steps when every set hits the top. Same geometry, different emphasis — do not draw two unrelated
pictures. This is the strongest candidate for the accent, on the step that has not been lifted
yet.

**A5 · Plate pair** — screen 9, units and smallest increment.
The end of a bar with plates drawn **to real relative diameter**, the smallest plate marked as
the unit of change. Proves why `roundToPlate` exists and why the question is being asked. This
is the asset most at risk of turning into gym clipart: keep it a cross-section / end-on
schematic, stroke-only, mechanical.

**A6 · Week grid** — screen 10, and reused in the streak sheet.
Seven slots, *n* filled, target marked. Proves §15.3 — the streak counts weeks against the
user's own target, so rest days are not failures. Must read correctly at target 2 through 6+.
Nothing here may imply a missed day.

**A7 · Signal-length panels** — screens 11–12, the commitment beat.
Two panels of the **same** series: too short to read a trend, then long enough that the trend is
visible. Proves the honest version of the claim in §13.8 (eight weeks is when an e1RM curve
starts saying something) and is the explicit, deliberate refusal of Lyfta's axis-free invented
chart (§2.2, §13.8). Therefore: the data must be labelled as an example in adjacent copy, and
the two panels must plot the identical underlying series — one merely truncated. If you cannot
make it truthful, kill it and report that.

### Paywall (§14.3 — strictly monochrome)

**A8 · Trial timeline rail** — replaces or reinforces the three literal rows.
A hairline rail with three ticks: today, the day-25 reminder, the day-30 charge. Proves the app
is not hiding the charge date, which §14.3 names as the category's most common dark pattern.
The dates themselves are RN text and must be the real computed dates, not baked in.

**A9 · Price bars, to scale** — beside the plan cards.
Two bar lengths in true proportion ($5.00 monthly-equivalent against $8.99 monthly = 55.6%).
Proves `SAVE 44%` instead of asserting it. If the ratio is not exact, the asset is a lie and
fails review. No axis, no chart furniture — two lengths and RN labels.

**A10 · Lock-screen rest pill** — the one feature bullet that words handle badly.
A cropped, cornered frame with the rest countdown pill in it. Proves the timer lives outside the
app (§8.7, Live Activity). **Do not draw a phone.** A device illustration is exactly the slop
this brief exists to prevent — crop to a corner and a hairline, and ground the proportions in
real iOS lock-screen geometry.

### Explicitly not SVG — do not build these

Charts of real data (`src/components/charts.tsx` owns those, hand-drawn per §19.3) · the live
parse demo on screens 1 and 8 (a real parse against the real prompt, §13.6) · the build progress
bar (`motion.tsx`) · checkmarks, chevrons, arrows, mic, calendar (SF Symbols) · tab icons (SF
Symbols) · anything that must reflect user data.

**Discriminator, when you are unsure:** does it bind to data? → it is a component, not an asset.
Is its geometry fixed and illustrative? → it is one of these assets.

---

## 5 · Use Mobbin, as evidence

You have the Mobbin MCP available (authenticate if prompted). Use it for **placement and
proportion evidence, not for style**.

Worth searching: onboarding value/payoff screens where a diagram earns its place; unit and
increment settings screens; free-trial timeline patterns; plan comparison layouts; weekly-goal
and streak representations; lock-screen and Live Activity presentations.

Bring back, per asset: two or three concrete references (app, screen, what it does with size,
placement, and how much of the screen the drawing takes), and one **counter-example** — a screen
where the illustration is doing nothing, so you can name the failure mode you are avoiding.

Do not style-transfer. Almost everything on Mobbin is more decorated than Recore is allowed to
be. You are using it to calibrate *how much drawing a screen can carry and where it sits*, then
drawing Recore's version.

---

## 6 · Deliverables

- One file per asset in `src/components/specimens/`, each exporting a typed React Native
  component. No colour literal, no font-size literal, no spacing literal — §23 makes any of
  those a build-blocking review failure.
- A consistent props API across all of them: intrinsic sizing driven by a single `width` or
  `size`, plus semantic tone props (`tone="ink" | "muted"`), never a `color` prop (§20).
  Colour resolves from the theme hook inside the component.
- Where labels are involved, the component composes RN `<Text>` in layout — the SVG holds only
  the geometry layout cannot express (curves, brackets, plates, rails, to-scale lengths).
- A dev-only gallery route so every asset can be reviewed side by side: both schemes (current
  light, and a stubbed dark preview), and three Dynamic Type sizes including
  `accessibilityLarge`.
- A short report: what you built, what you killed and why, the Mobbin references per asset, and
  every judgement call you made that the brief did not decide for you.

## 7 · Acceptance checklist

- [ ] Zero colour literals, zero font-size literals, zero spacing literals outside
      `src/lib/theme/`.
- [ ] Every asset renders correctly under both colour schemes with no code change.
- [ ] Every word and number is RN text, in the correct face (words humanist, numbers mono +
      tabular). The wordmark is the only outlined-path exception.
- [ ] Accent appears on at most one element in at most two assets, only on a not-yet-lifted
      number, always adjacent to `next`. Paywall assets are pure monochrome.
- [ ] No custom glyph exists where an SF Symbol would do.
- [ ] Legible at 1x on the narrowest device and at `accessibilityLarge`; nothing meaningful
      under ~1.5pt.
- [ ] VoiceOver: labelled where the asset carries information, hidden where the copy repeats it.
- [ ] Reduce Motion honoured by anything that animates; no information lost when it is on.
- [ ] `npm run typecheck`, `npm test`, `npm run lint` pass.
- [ ] Nothing in the set could pass as stock illustration.

## 8 · Stop and ask

Before building, come back with the shortlist you intend to build, the ones you are killing, and
your Mobbin evidence — then stop. Do not touch `src/app/onboarding/` or `src/app/paywall.tsx`;
these assets are authored standalone and wired in later (PLAN.md Phase 5). Do not add a
dependency; `react-native-svg` and `expo-symbols` are already here and §19.3 forbids new UI or
illustration libraries.
