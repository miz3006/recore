# Recore onboarding v2 — build spec

This file is the source of truth for the v2 onboarding flow. The screen list below is **fixed**: do not add, remove, merge or reorder screens. Scope of work is motion, in-screen layout, and character placement.

If you believe a screen is missing or redundant, write it in `FINDINGS.md` at the end of the run with your reasoning. Do not act on it.

---

## 0. Rules of engagement

**This is additive.** The existing onboarding at `src/app/onboarding/` must keep working exactly as it does today. Do not delete, refactor or "improve along the way." If you find yourself editing a file under `src/app/onboarding/`, stop — you are in the wrong place.

> **28 August 2026.** Still true, with one exception the promotion forced: `components/onboarding/ProjectionStrip.tsx` reads the v2 projection as a fallback, because the paywall reprises the picture the person just saw and that picture now comes from v2. The v1 renderer and its config are untouched.

**Structure:**

```
src/app/onboarding-v2/[step].tsx     new route
src/components/onboarding-v2/        new components
src/lib/motion/                      shared motion primitives (new)
```

**Isolation goes both ways.** v2 may read `src/lib/theme/` and shared utilities. It may not import from `src/app/onboarding/` or `src/components/onboarding/`, and nothing existing may import from v2. If a component is worth sharing, copy it into v2. The test: deleting either directory later must leave the other intact.

**Sandbox state — AMENDED 28 AUGUST 2026: v2 IS THE PRIMARY ONBOARDING.** The owner's ruling
of that date promotes this flow from sandbox to the flow a new person actually meets. What that
changes, exactly:

- **The dispatcher sends here.** `src/app/index.tsx` redirects an un-onboarded launch to
  `/onboarding-v2/<step>`, resumed where a killed app left off. The illustrated flow at
  `src/app/onboarding/` is no longer dispatched to; it is **not deleted**, still works, and is
  still reachable from the You tab's development section.
- **A real run persists.** `state/onboarding-v2.ts` now stores answers and position through the
  SQLite meta KV under `pref_ob_v2`, so four minutes of answers survive a phone call. `pref_%`
  means they are carried by `export-json.ts` and dropped with the account (§12), like every other
  onboarding answer.
- **A real run commits, once.** `lib/onboarding-v2-commit.ts` writes name, goal, experience,
  frequency, split, key lifts and their loads, the smallest plate, the tracker, the attribution
  and the recap answer, then marks onboarding done. Nothing before the last screen writes
  anything; the eighteen screens still only touch the v2 store.
- **It ends ON THE PAYWALL.** Screen 20's Continue commits and hands the root over to the
  dispatcher, which sends a new person to `/paywall` and an entitled replay back to Today. There
  is no interstitial: the done screen is a **development** screen now and a real run never reaches
  it. The paywall's own forward step is unchanged and is where the account is created — plan →
  sign-in → the store's purchase sheet (§6).
- **Screen 1 offers "I already have an account".** "Auth last" is about where the funnel ASKS,
  not about making a returning person walk twenty screens to reach their own record. The link
  opens the real `/sign-in`; when the session lands, the funnel stands aside and the dispatcher
  routes them. In a development run the link says sign-in is off instead.
- **It still creates no account itself, starts no trial and touches no RevenueCat.**

**The sandbox promise survives, scoped to a development run.** The You tab's rows open
`/onboarding-v2/1?dev=1`; the parameter is carried forward by every push, and while it is set the
store refuses to persist and the flow refuses to commit. So a dev run still creates no account,
sets no onboarding-complete flag, overwrites no name/split/key lifts, ends on a "done" screen that
says so, and returns to where it was launched from. Every dev run starts clean.

**Settings entry.** In the You tab, add a `DEVELOPMENT` section with three hairline rows in the existing You tab style:

- Run onboarding (current) — the existing flow, also sandboxed
- Run onboarding (v2)
- Reset sandbox state

Gate the whole section behind `__DEV__`. Tell me in your summary how to flip that.

**Everything user-facing is ENGLISH.** Option labels, headlines, sublines, buttons, empty
states, ghost rows, accessibility labels, the reveal, notification copy — all of it. The first
draft of this spec was written in Slovenian by mistake and the flow was built from it; that was
corrected on 28 August 2026. Loads are written `82.5`, never `82,5`. No i18n scaffolding —
English strings inline, like the rest of the app. Code, comments and this document are English
too (CLAUDE.md §2 rule 7); only replies to the owner are Slovenian.

**Emoji: two glyphs, one screen.** Emoji appear only where a person CHOOSES, never where the app
REPORTS, and on top of that: all-or-none per screen, one semantic family per screen, consistent
visual weight checked RENDERED rather than in the source, and the glyph must denote the thing the
option names. Numbers, durations, dates, frequencies and abstract states get none. Never in
headlines, body copy, buttons, progress indicators, explainers or the character's speech. No skin
tones, gendered figures, body parts, flags or keycap sequences. **THE FLOW CONTAINS NO EMOJI** (owner, 28 August 2026 — the last two would not sit centred, and a
colour bitmap on a text baseline cannot be centred without a per-glyph nudge). Screen 4 carries six
monochrome brand marks and screen 18 carries two time-of-day marks, all drawn as paths on one grid
at one stroke weight. Every other screen carries nothing. The rules above still govern any future
glyph. Pinned by
`src/components/onboarding-v2/characters.test.ts` — change the rule there and in this paragraph
together, or the build fails.

**An opt-out is an answer that gives the app NOTHING** ("Other", "No thanks", "I don't log
anywhere") and renders as a ghost row below the list. An answer that turns on a distinct code
path is a peer row however much it looks like a refusal — "I don't follow a split" is the only
route into flat clustering mode, and a branch that is visually demoted ships under-tested.

**Tokens are frozen.** Read `src/lib/theme/` and use it. Canvas `#F4F5EF`, surface `#FBFCF6`, ink `#171914`, blue `#007AFF` for primary CTAs and selected states, green `#547C00` reserved strictly for PLANNED values, existing type scale, radii (button 14, card 18, hero 22–28), `CONTROL_HEIGHT` 50. Also read `.claude/skills/recore-design/SKILL.md`. Where that skill and this file disagree, ask me.

**Analytics.** Every screen fires a view event and an advance event through the existing `analytics.ts`. Per-screen drop-off is the only thing that will eventually settle which screens deserve to exist, so the instrumentation is not optional.

---

## 1. Research basis

Two funnels were walked screen by screen on the Appllama MCP:

- **Cal AI** (id `6480417616`) — 38 onboarding screens, $2M/mo, 4.8 at 356k ratings, launched 4/2024, $29.99/yr
- **Gravl: AI Personal Trainer** (id `6450921637`) — 32 onboarding screens, $400K/mo at only 10k downloads, 4.89. Subtitle: "Progressive Overload Tracker" — the closest analogue to this app

What both do, independently:

| Pattern | Cal AI | Gravl |
|---|---|---|
| Auth last | 31/38, screen named **"Save Progress Sign In"** | 30/32 |
| Attribution early | position 3/38 | 26/32 |
| Name → immediate payoff screen | — | name at 3, "Hello [name]" at 4 |
| Loading is a screen, not a spinner | % counter + checklist rows | progress bars **+ testimonial card** |
| Concrete artifact before paywall | macro rings + daily recommendation | strength forecast with a % score |
| Trial split across screens | Trial Offer → Trial Reminder → Checkout w/ timeline | Subscription Offer |

Copy the behaviour, not the look. Cal AI is white/black/`#F4D44E` and card-based; this app has deliberately rejected that.

---

## 2. Screen list (fixed — 20 screens)

> **28 August 2026 — two insight screens added (owner).** The list was eighteen and fixed. The
> owner asked for interstitials that say something specific back, built from the answers already
> given, so the flow reads as personal rather than administrative — Cal AI runs two of these
> (`Habit Insight` 12/38, `AI Comparison` 14/38) and they are the only screens in its funnel with
> no input at all. **The list is fixed again at twenty.** The same rule applies: do not add,
> remove, merge or reorder without asking.
>
> Their content may never be a claim about other people. Cal AI's reads *"90% of users say that
> the change is obvious"*; CLAUDE.md §2 rule 2 and §3 forbid that outright. Every line is either
> arithmetic on this person's own answers or a fact about how the app works, and
> `echo.test.ts` fails the build on percentages, "users say", "most people", "studies show",
> "proven", or any health claim.

The rule each screen had to pass: it changes app behaviour, creates commitment, or returns value. Anything else is a survey.

**1 — Welcome.** No question. Live ledger demo that writes and parses itself. CTA "Start" + text link "I already have an account".

**2 — Where do you log your training now?** Notes app · Hevy or Strong · Paper notebook · A spreadsheet · *(opt-out)* I don't log anywhere
→ Decides whether CSV import is offered later.

**3 — What gets in the way?** *(up to 2)* Too much tapping between sets · Supersets and dropsets don't fit · I forget what I did last time · I never know what weight to use next · I stop after a few weeks
→ Decides which value prop leads on the reveal and the paywall.

**4 — The obstacle, answered.** *(insight, no question)* Names what the app does about the
specific thing they picked on screen 3, and adds one line for their tracker answer. Skipped
silently if nothing was picked.
→ The first moment the flow gives something back rather than taking something.

**5 — Where did you hear about us?** TikTok · Instagram · X · YouTube · App Store · A friend · *(opt-out)* Other. Real monochrome brand marks, never emoji approximations — Cal AI ships an `Icon Option List` here.
→ Changes nothing in-product; it is the only way to know which channel works. Early, per Cal AI's position 3 — zero-effort warm-up while compliance is highest.

**6 — Try it.** *(interactive)* **Not a mockup — the real Today components** (owner, 28 August
2026): `NoteInput` and `ExerciseCard`, imported from `components/note-surface.tsx`, with the real
`buildReceipt` pipeline behind them. Empty field on Today's own placeholder, plus a "Use this
example" tap. Parses with the offline grammar so it works with no network and no account. Anything
that makes it behave differently from Today is a bug — the complete list of intended differences
is `FINDINGS.md` §21.
→ The aha moment. Neither reference app has this because neither can show its magic in three seconds. This one can.

**7 — Here's the read.** No question. The parsed table from screen 5 + "Your words stay exactly as you wrote them."

**8 — What's your name?** Text field.

**9 — "Hello, [name]."** No question. Cap character. 1.5 s, auto-advances.

**10 — What are you training for?** Muscle · Strength · Both · Just being consistent · Hyrox or hybrid
→ Selects the progression model.

**11 — How long have you been training?** Less than 6 months · 6 months to 2 years · 2 to 5 years · More than 5 years
→ Sets progression increment size.

**12 — How many sessions a week?** Two · Three · Four · Five · Six or more
→ Feeds Next-tab clustering and weekly volume.

**13 — Your year, counted.** *(insight, no question)* `sessions × 52`, counted up, with one line
that follows from the goal. Multiplication on their own answer — no adherence assumption, no
drop-off curve, no claim about whether they will do it.
→ The first moment the flow has a number worth multiplying.

**14 — Which split do you train on?** Push / Pull / Legs · Upper / Lower · Full body · Bro split · **I don't follow a split**
→ Drives the clustering engine directly. The last option is mandatory, routes to flat mode, and stays a **peer row** — it drives a branch, so it is never demoted to a ghost row. Use an inline info banner here rather than a separate explainer screen (Gravl does this at its positions 18–19).

**15 — Your key lifts, and what you lift now.** Multi-select of lifts, then a weight per lift.
→ Fuel for both the projection and the first-session targets. A heavy screen late in the funnel is fine when it visibly improves the result — Gravl's equipment picker is the same bet.

**16 — Why progressive overload works.** No question. One chart, one sentence. **Must use their numbers from screen 13**, not a generic curve. Cal AI's four explainers are all generic; that is the opening.

**17 — The commitment.** Hold-to-commit: "I'll log every session for the next 4 weeks."

**18 — Building your plan.** % counter, thin progress bar, checklist rows ticking in. Gravl puts a testimonial in this dead time — until there are real reviews, put a factual line instead. Never invented reviews.

**19 — Your first session.** *(reveal)* Not the 12-week projection. Concrete targets, editable:
> Bench press — 82.5 kg × 3 sets
> +2.5 kg on what you entered

Projection sits below this as secondary. Both reference apps give a number you use today rather than a promise about three months out.

**20 — Weekly recap.** Sunday evening 🌙 · Monday morning ☀️ · *(opt-out)* No thanks
→ Ask *when*, not *whether*. Cal AI does the same with a segmented control.

**Then:** trial timeline (today unlocked → day 5 reminder → day 7 charged) → paywall, leading with the value prop from screen 3 and repeating the number from screen 17 → **sign-in last**, titled "Shrani svoj plan", Apple + Google.

Note: gender and bodyweight are deliberately absent. Neither changes anything in this app unless bodyweight is used for relative strength on screen 17 — if it is added back, it must earn it that way.

---

## 3. Motion system

Build in `src/lib/motion/` as shared primitives, not per-screen. Springs throughout — no linear or ease-in-out anywhere in this flow. Name springs semantically, not `spring1`/`spring2`.

What Cal AI actually ships, from its screen inventory — this is what its choreography is made of:
`Progress Step Indicator` on every question screen · `Disabled Rounded CTA` becoming `Rounded Continue CTA` on selection · `Selected Black Option` · `Vertical Wheel Scroll Picker`, `Horizontal Ruler Slider`, `Weight Ruler Picker` with a `Faded Bottom Gradient` over them · `Large Percent Counter` + `Thin Progress Bar` + `Checklist Rows` · `Circular Macro Widgets`, `Circular Progress Rings` · `Ascending Line Chart`, `Red Trend Curve` · `Circular Mascot Ring`.

**Screen transition.** Horizontal push. Outgoing translates left, fades to ~0.6; incoming enters from the right at full opacity. Back gesture reverses. Fast, slightly overshooting — ~350ms of perceived travel.

**Progress bar.** Same spring, same frame as the transition, so bar and screen read as one gesture. On every question screen. Reaches 100% at the reveal, not at the paywall.

**Option rows.** Press → scale 0.97 + `impactLight`, spring back on release. Selection animates in on a spring, never an instant swap. Single-select: outgoing animates out as incoming animates in, never both active for a frame.

**Continue button.** Disabled until a selection exists, then it animates alive — opacity plus a small scale pop, with a `selection` haptic. Copy Cal AI exactly here. It makes the CTA a reward rather than furniture.

**Pickers.** Haptic tick per unit crossed. The large number tracks the scroll rather than snapping. Faded gradient so the list dissolves instead of clipping.

**Numbers.** Every number that appears as a *result* — not an input — counts up from zero on a spring on mount. Tabular figures so width doesn't jitter (`READING_FACE` is already sans with tabular-nums).

**Charts.** Lines draw left to right on mount, ~800ms, end dot landing last on a small spring. Bars grow from baseline, ~40ms stagger.

**Screen 16.** The one screen that should feel like real work. Checklist rows on a stagger, each checkmark scaling in with a light haptic. 2.5–3.5s total. Do not make it faster — this is where perceived effort is manufactured.

**Screen 5.** The raw line stays visible; the structured reading resolves underneath row by row, ~120ms apart. This is the aha moment and it needs to be watchable.

**Restraint.** No motion on price cards, error states, the tab bar, or anything reporting a real recorded value. Respect Reduce Motion — everything degrades to a cross-fade, haptics stay.

---

## 4. The cap character

**It appears only where the app speaks to the user, never where it asks them something.**

| Screen | Character | Behaviour |
|---|---|---|
| Welcome | Yes | Settles in with a small spring |
| every question screen | **No** | Competes with the options; slows every screen it sits on |
| the read, overload (explainers) | Optional, small | Only if it reacts to or points at the content |
| "Hello, [name]" | **Yes — its screen** | Scales in on a spring as the name resolves |
| Commitment | Yes | Reacts as the hold completes |
| Building | **Yes** | Cal AI's `Circular Mascot Ring` sits exactly here — put the character inside a slowly rotating ring |
| Reveal | Small, to one side | The numbers are the subject |
| Paywall | No | — |

Two hard rules:

1. **Never adjacent to a number.** A character beside a figure makes the figure look decorative.
2. **Never on two consecutive screens.** If two in a row would show it, drop it from the first.

One consistent entrance — scale from 0.9 + fade, on a spring — so it reads as the same character arriving, not a different asset loading.

Declare per-screen presence in **one file, as data**, not scattered conditionals. I want to change this rule by editing one table. **Key it by screen ID, never by position** — the table was keyed by number until 28 August 2026, and inserting the two insight screens would have moved the character onto whichever screens inherited the old numbers, silently and with every test still green.

---

## 5. Deliverables

1. `src/lib/motion/` — springs and reusable primitives (option row, continue button, counting number, drawing chart, checklist row)
2. Full v2 flow at `src/app/onboarding-v2/`, every screen on those primitives, no bespoke per-screen animation
3. Character presence table in one file
4. Reduce Motion handling throughout
5. Analytics events on every screen
6. `DEVELOPMENT` section in the You tab
7. `FINDINGS.md` — anything you disagreed with and didn't act on
8. A summary: files added, existing files touched and why, how to flip the `__DEV__` gate, how to delete either flow cleanly once I've decided

## 6. Sequencing

Build the motion primitives and screens 1–3, then stop and show me. I want to check the spring feel once before it is applied eighteen times.
