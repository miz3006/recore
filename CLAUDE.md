# CLAUDE.md — Recore

**Version 3.0 · 26 July 2026 · Supersedes all previous versions of this document.**

Read this file completely before writing any code. It is the single source of truth for what
Recore is, how it looks, how it behaves, how it makes money, and in what order it gets built.
Where this document conflicts with the code, the document wins and the code is wrong. Where
this document conflicts with an older instruction, comment, or commit message, this document
wins.

---

## 0. How to use this document

**Section priority.** When two sections seem to conflict, resolve in this order:
§1 (thesis) → §4 (principles) → §8–§10 (the three engines) → everything else. A visual or
motion detail never overrides a principle. A principle never overrides the thesis.

**The one filter.** Before building anything, it must make one of these true:

1. The log gets faster or more accurate to write.
2. The next session gets easier to decide.
3. The record gets more beautiful to look at.

If it does none of these, do not build it. This is the single most important rule in the file.
Hevy has 40 features. We will have twelve, executed at a level Hevy cannot reach with 40.

**On judgement.** This document is opinionated on purpose. When it says "never," it means
never. When it leaves a gap, use taste — and match the taste already established here:
quiet, precise, fast, warm-but-not-cute.

---

## 0.1 One decision the owner must consciously ratify

The redesign brief that produced this document asked for richer exercise cards, better set
logging, and better weight/rep inputs. Taken literally, that means a form: pick an exercise,
tap a stepper, tap +, repeat. That is exactly what Setgraph, Lyfta, Hevy, and Strong already
are, and they have between 2,000 and 5,000,000 users of head start each. Recore cannot win
that fight and should not enter it.

So this document resolves the brief this way:

> **The input stays one text field. Everything the text field produces becomes beautiful.**

Every request in the brief — cards, hierarchy, dividers, motion, delight, progress
visualisation, premium components — is applied to the *output* of logging, which is where
Recore has been ugly. Weight and rep inputs come back as **correction affordances on the
card** (a stepper you touch when the parse read 82.5 and you meant 85), not as the primary
path. Free text is the fast path; touch is the repair path.

If the owner disagrees and wants a form as the primary input, that is a legitimate product
call — but it is a different product, and this document should be rewritten before that is
built, not patched.

---

## 1. Product thesis

### 1.1 What Recore is

Recore is a **training record you write in.** You open it and type what you did, in your own
words, in your own language:

```
bench 3x8 80kg superset flyes 12x, last set dropset to 40
squats worked up to 140x3, felt heavy
5k easy 26min
```

It reads that, understands it, and turns it into structure — exercises, sets, reps, loads,
supersets, dropsets, distance, notes — without you touching a picker, a dropdown, a plus
button, or a search field. Then it shows you the record it built, and tells you what to beat
next time.

There is no exercise library to browse. No routine builder to fill in. No chat interface. The
page and the keyboard are the product.

### 1.2 Who it is for

A serious trainee: someone who already knows what a superset is, already has a program or a
strong opinion about one, and does not need to be taught what a squat looks like. Lifters
running hypertrophy or strength blocks, and hybrid/Hyrox athletes whose sessions do not fit a
set/rep grid. They are already tracking something — in Notes, in a spreadsheet, in a notebook,
or in an app whose logging friction they resent.

They are **not** beginners. We never explain form, never show anatomy diagrams, never
recommend a program. Someone who needs those is Lyfta's user and we should be happy to lose
them.

### 1.3 Why this can win

The category's failure mode is documented and consistent. Health & fitness apps retain roughly
3–4% of installs at day 30. Roughly 70% of users of lifestyle/health apps quit within 100
days, with the steepest drop in the first two weeks. Even among people who *paid*, 46.8% churn
within 90 days. The single most-cited cancellation reason in fitness subscriptions is **lost
motivation (38%)**, followed by cost relative to a gym membership (18%) and lack of
personalisation or progress tracking (12%).

Read that carefully: people do not quit because the app lacked a feature. They quit because
the admin outlasted the motivation. Every competitor's answer is to add more app — more
programs, more library, more social, more badges. Recore's answer is to remove the app from
the moment that hurts, and to put everything it has into the two moments that keep people:
**the seconds after a set** and **the seconds before the next one.**

### 1.4 The three engines

Everything in Recore is one of three engines or serves one of them.

| Engine | What it is | Why it exists |
|---|---|---|
| **The Composer** (§8) | The text surface and the cards it produces | The wedge — the reason someone switches |
| **The Parser** (§9) | Free text → structure, any language | The moat's foundation — nobody switches back once their shorthand works |
| **The Coach** (§10) | Deterministic next-session targets | The retention loop — the reason to open the app on a training day |

Work that makes these better outranks all other work, always.

### 1.5 Voice

Quiet, precise, and on the user's side. We are the training partner who writes things down and
never talks during the set.

- Never cute. Never hype. Never an exclamation mark in the product UI.
- **No emoji anywhere in the interface.** Ever. Not in the streak, not in a celebration, not
  in a notification.
- Never congratulate someone for opening the app. Congratulate them only for a number.
- When we have nothing useful to say, we say nothing. Silence is a design element and we use
  it constantly.
- We never claim credit for the user's training. They lifted it; we wrote it down.

---

## 2. Competitive position

Direct study of both competitors' complete onboarding funnels and shipped products, July 2026.

### 2.1 Setgraph

Nine years old, ~2.25k ratings, paid (annual or lifetime after a short trial), positioned
squarely on speed + progressive overload. Onboarding is ~30 screens over ~5 minutes and is the
best-constructed funnel in the category: **every question is followed by a screen that
visibly uses the answer.** Answer "notebook" and the next screen is titled *Your Notebook,
Upgraded* and says "no notebook can do that." Three real App Store reviews with usernames and
storefronts appear mid-funnel, at the exact points of maximum agreement. A three-screen
sequence teaches progressive overload *before* selling the app as its solution, so the user
has already accepted the premise. Notifications are sold on a dedicated screen before the OS
prompt fires.

What they get right that we must match: the ask → payoff rhythm, permission priming, real
proof.
What they get wrong: they never show the actual app, and account creation is the very first
screen, before any value.

### 2.2 Lyfta

5M+ users, 300M+ lifts logged, free with a 14-day Pro trial, 5,000-exercise library, social
feed, leaderboards, monthly challenges. Onboarding is ~20 screens over ~3 minutes, account
**last**. Question-dense (11 questions) with generic brand screens between them — none of the
content responds to any answer, so it feels like a form with posters. Two devices are worth
stealing:

- **The commitment beat.** "How long can you stick to it?" (no "I don't know" option) →
  a screen comparing "a few weeks" against "3 months" with a button that reads **I'm
  Committed**. Self-declaration, then the paywall. Note that the chart on that screen has no
  axis, no data, and no source. It is rhetoric shaped like evidence. We take the psychology
  and refuse the dishonesty (§13.10).
- **The attribution question.** "How did you hear about Lyfta?" — not personalisation, pure
  marketing telemetry, and the cheapest useful question in either funnel.

What they get wrong: cartoon avatars, emoji, gold medals, gradients, fake-feeling
testimonials. It is built for a broad Instagram-ad audience. Our user reads that as cheap.

### 2.3 The structural lesson

Both competitors can afford a 20–30 screen funnel because they have things to configure:
programs, equipment, splits, libraries. **Recore has nothing to configure — that is the
entire point.** Therefore the length of our onboarding must come from *proof*, not from
questions. Every question we ask must change something the user can see. A question whose
answer we do not use is a Lyfta mistake, and we do not make it.

### 2.4 Where we are structurally different

| | Setgraph | Lyfta | **Recore** |
|---|---|---|---|
| Input | tap forms | tap forms | **type or speak, any language** |
| Exercise library | curated | 5,000 + animations | **none — your vocabulary is the library** |
| Business model | paid | free + Pro | **hard paywall, trial** |
| Social | none | feed, leaderboards | **none, permanently** |
| Next session | you decide | you decide | **computed and shown** |
| Non-lifting work | poor | poor | **first-class (runs, carries, holds)** |

---

## 3. What success means

Design and build against these, in this order. The bars are set against real category
benchmarks, not aspirations.

### 3.1 Activation (the metric that predicts everything)

Day-1 completion of a meaningful first action is the strongest single predictor of day-30
retention across every app category — apps that nail it retain at 2–3× the rate of apps that
do not. For a training app the meaningful action is not "opened" and not "typed one line."

> **Activation = three sessions logged within the first seven days.**

Everything in the first week is optimised for this one number. If a feature does not increase
it, it is not a first-week feature.

| Moment | Metric | Bar |
|---|---|---|
| First run | Onboarding start → paywall shown | < 3 min |
| First run | Trial start → first line parsed | < 30 s |
| Week 1 | **Activation (3 sessions in 7 days)** | **≥ 45% of trial starts** |
| Every session | Typing time for a full 5-exercise session | < 45 s |
| Every line | Card settles after the user stops typing | < 1.2 s p50, < 2.5 s p95 |
| Every line | Parse accuracy on the user's own vocabulary | ≥ 97% by week 2 |
| Training day | Target shown → session logged | ≥ 60% |
| Day 30 | Retention (of trial starts) | ≥ 25% (category leaders' level) |
| Always | Data loss | zero, unconditionally |

### 3.2 Business

Health & fitness has the highest annual-plan adoption of any category (68%) and one of the
highest trial-to-paid rates (37.7% median). Hard paywalls convert at ~10.7% day-35
trial-to-paid versus 2.1% for freemium — roughly 5× — and generate ~8× the revenue per install
at day 60, with effectively identical one-year subscriber retention. Onboarding paywalls with
a trial produce the highest install-to-paid conversion of any placement.

Conclusion: **hard paywall, annual-default, trial-gated, paywall inside onboarding.** This is
already the strategy; the data ratifies it. Two changes follow in §14.

Target arithmetic, so the numbers are not abstract: at $59.99/year with Apple's Small Business
Program rate (15%), each annual subscriber nets ≈ $51/year ≈ $4.25/month. Roughly **1,000
active annual subscribers** clears the €3–5k/month goal. At a 10.7% install-to-paid rate that
is on the order of 9,500 installs, before renewals. That is a realistic ASO + Search Ads
target for year one and it should shape every scoping decision: 1,000 subscribers who love
one screen, not 50,000 who tolerate twenty.

### 3.3 Instrumentation

Count locally first. Ship these counters from day one, stored in `meta`, synced with the
user's row, never through a third-party SDK without the owner's explicit approval:

`onboarding_step_reached`, `paywall_shown`, `trial_started`, `first_parse_ms`,
`sessions_logged_d7`, `parse_repair_rate`, `target_shown`, `target_followed`,
`weekly_review_opened`, `attribution_source`.

---

## 4. Experience principles

These are the ten rules that make Recore feel like Recore. They are testable — each one can be
violated by a specific line of code, and that line of code is a bug.

**1 · The keyboard is the interface.**
The composer is focused on open. Typing is always available. The primary action never requires
leaving the keyboard. Any feature that forces a keyboard dismissal to complete a log is
rejected.

**2 · Nothing blocks on the network.**
Every write lands in SQLite in the same frame. Parsing, syncing, and prediction are
background concerns and are allowed to be late, never allowed to be in the way. The app is
fully functional in airplane mode in a basement gym, forever.

**3 · The user's words are sacred.**
`raw_text` is the record. Structure is a projection we compute from it and may recompute at
any time. We never rewrite, correct, tidy, or discard what the user typed. When our reading
differs from their words, both are visible and their words win.

**4 · Silence over noise.**
A line we cannot read gets no error, no red underline, no warning icon. It is saved and stays
saved. "Felt destroyed today" is a note, not a failure. We have nothing to say about it, so we
say nothing.

**5 · The machine never speaks first without a number.**
No encouragement, no "great job," no generated pep talk. The Coach opens its mouth only when
it has a specific prescription and a specific reason drawn from the user's own history. If
there is no real reason, there is no line.

**6 · Confidence is visible.**
A reading the parser is sure of and a reading it guessed at do not look identical. The user
must always be able to tell, at a glance, what the machine knows versus what it inferred (§6.4,
§9.5).

**7 · Every screen has one job.**
One primary action, stated in the largest type on screen. If a screen needs a second
paragraph to explain what it is for, it is two screens.

**8 · Motion explains, never entertains.**
Every animation communicates a state change, a spatial relationship, or a causal link. An
animation that could be removed without losing meaning is removed. There is exactly one
moment in the app allowed to be exuberant (§7.6).

**9 · Density where it earns, air everywhere else.**
Data tables can be tight — a lifter reading history wants rows, not cards with 24pt padding.
Everything that is not a table breathes. The composer in particular is mostly empty space and
that is the design.

**10 · We never hold the user's data hostage.**
Export is free, complete, and permanent — including after a subscription lapses. A lapsed
subscriber gets a read-only app with full export, never a wall in front of their own training
history. This is both ethics and marketing.

---

## 5. Information architecture and navigation

### 5.1 The four surfaces

```
┌─────────────┬──────────────────────────────┬────────────────────────────┐
│ Tab         │ Question it answers          │ Opened when                │
├─────────────┼──────────────────────────────┼────────────────────────────┤
│ Today       │ "What am I doing right now?" │ Every session. 85% of use. │
│ Lifts       │ "How is my bench going?"     │ Between sessions, weekly.  │
│ Progress    │ "Am I actually improving?"   │ Sunday, monthly, when low. │
│ You         │ "Change something."          │ Rarely, and that is fine.  │
└─────────────┴──────────────────────────────┴────────────────────────────┘
```

**Today** — the composer, today's cards, the session summary. Default tab, always.
**Lifts** — every exercise the user has ever named, sorted by recency, each opening to its
full history, e1RM curve, PR record, and vocabulary.
**Progress** — the training life: calendar, weekly volume, consistency, the record book, the
weekly review.
**You** — profile, subscription, units, plate maths, parsing preferences, export, sign-out.

**Why not five.** "History" and "Analytics" as separate tabs is the single most common IA
mistake in this category — they answer the same question at different zoom levels. They are one
tab (Progress) with a segmented control. **Why not three:** per-exercise depth is the most
frequent between-session question a lifter has, and burying it two levels under Progress makes
the app feel shallow.

### 5.2 The tab bar

Use **`expo-router/unstable-native-tabs`** (`NativeTabs`). Do not hand-build a floating tab
bar.

This is the correct answer to the brief's request for "floating, rounded, glassmorphism,
translucent blur, premium shadows, subtle animations." `NativeTabs` renders a real
`UITabBarController`, which on iOS 26 *is* a floating Liquid Glass bar with true refraction,
correct scroll-edge behaviour, correct Dynamic Island interaction, correct accessibility, and
correct behaviour when the user enables Reduce Transparency or Increase Contrast. A JavaScript
tab bar cannot reproduce any of that; it can only approximate the look while breaking the
behaviour. On Android the same component renders Material 3 automatically. Building our own
would be more work, worse, and permanently out of date.

```tsx
// src/app/(tabs)/_layout.tsx
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';

export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'square.and.pencil', selected: 'square.and.pencil' }} md="edit" />
        <Label>Today</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="lifts">
        <Icon sf={{ default: 'list.bullet', selected: 'list.bullet' }} md="list" />
        <Label>Lifts</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="progress">
        <Icon sf={{ default: 'chart.xyaxis.line', selected: 'chart.xyaxis.line' }} md="trending_up" />
        <Label>Progress</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="you">
        <Icon sf={{ default: 'person', selected: 'person.fill' }} md="person" />
        <Label>You</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

Rules:

- Icons are **SF Symbols** via the `sf` prop (`expo-symbols` elsewhere in the app). We never
  ship a custom icon where a system symbol exists — system symbols inherit weight, scale,
  Dynamic Type, and the user's contrast settings for free.
- Tab bar tint must be set with `PlatformColor` / `DynamicColorIOS`, never a literal hex.
  Liquid Glass recolours itself against whatever is behind it and there is no callback; a
  hardcoded colour will go illegible on some content.
- **The tab bar hides while the keyboard is up on Today.** The composer owns the full screen
  when writing. It returns on dismiss.
- Content scrolls *behind* the bar edge-to-edge. Never inset the scroll view to "clear" the
  glass — glass needs content underneath it to refract, and an inset kills the entire effect.
  Use `contentInsetAdjustmentBehavior="automatic"` and let the system handle it.

### 5.3 Depth beyond tabs

- **Sheets** for anything modal and dismissible: exercise detail, correction, calendar, plate
  maths, share. Detents `[0.6, 0.95]` with a grabber; never full-screen-cover for something
  the user is meant to glance at.
- **Push** for anything with its own identity worth a back button: a single past session, the
  full record book, a single Lift.
- **Never a modal on a modal.** If a sheet needs a sheet, the second one replaces the first
  with a push inside the same sheet's stack.
- **Deep links:** `recore://today`, `recore://lift/<slug>`, `recore://session/<date>`,
  `recore://review/<isoweek>`. All four must survive a cold start.

---

## 6. The visual system

### 6.1 The idea

**Everything recorded is cold. The one thing that is hot is what you are about to do.**

The interface is graphite and chalk — a cold, near-neutral field. Exactly one hue exists in
the product, an ember orange, and it is spent on a single semantic: **a number you have not
lifted yet.** Not on buttons, not on the logo, not on charts, not on marketing, not on
success states. When a lifter sees ember on this screen, it means one thing and it means it
everywhere.

This is the signature and the whole visual identity rests on it. It is also the reason the app
can be rich without being loud: colour carries meaning, so it never has to carry decoration.

### 6.2 The record contract

Four data states, visually distinct on every screen, without exception. This is inherited from
the previous version of Recore and it is the best idea in the old document.

| State | What it is | Treatment |
|---|---|---|
| **WRITTEN** | The user's verbatim words | Text face, full-contrast ink, left-aligned, never truncated |
| **READ** | The machine's interpretation | Mono face, muted ink, right-aligned or on its own row |
| **RECORDED** | Settled, archival fact | Mono face, full ink for the value, muted for comparison |
| **PLANNED** | A number not yet lifted | Mono face, **ember**, always with a reason available |

Two invariants that must never break:
- **Ember appears only on PLANNED.** A PR is not ember. A positive delta is not ember. A chart
  line is not ember. A button is not ember.
- **READ never wears a checkmark.** A checkmark asserts correctness; a reading is a claim. See
  §6.4.

### 6.3 Colour

Both themes ship. Default to `system`. Dark is the design target (gyms are dark, phones are on
auto, every serious competitor is dark-first); light is a full peer, not an afterthought.

```ts
// src/lib/theme/color.ts — the ONLY place literals exist
export const dark = {
  canvas:      '#0E1113',  // cold graphite — the floor at 6am
  surface:     '#161A1D',  // raised: cards, sheets, rows
  surfaceHigh: '#1F2427',  // recessed: segmented tracks, pressed, inputs
  ink:         '#EDF0EF',  // chalk — primary text and recorded values
  inkMuted:    '#98A2A4',  // secondary text, comparisons, READ values
  inkFaint:    '#69736F',  // captions, placeholders, disabled labels
  rule:        '#252B2F',  // hairlines, table rules, card borders
  ember:       '#FF6B3D',  // PLANNED ONLY
  emberSoft:   '#FF6B3D1F', // ember at 12% — target row wash, nothing else
  warn:        '#E0B14A',
  danger:      '#E2564A',
  scrim:       '#00000099',
};

export const light = {
  canvas:      '#F6F5F2',  // warm paper
  surface:     '#FFFFFF',
  surfaceHigh: '#EDEBE6',
  ink:         '#14181A',
  inkMuted:    '#5F6A6C',
  inkFaint:    '#8E9896',
  rule:        '#DFDCD5',
  ember:       '#C2410C',  // darkened for 4.5:1 on paper
  emberSoft:   '#C2410C14',
  warn:        '#8A5613',
  danger:      '#A33D36',
  scrim:       '#0E111366',
};
```

Rules:

- **No component may contain a colour literal.** Every colour resolves through the theme hook.
  A hex in a component file is a build-blocking review failure.
- **Elevation inverts between themes.** In dark, `surface` is *lighter* than `canvas`. In
  light, `surface` is *whiter* and `surfaceHigh` is *darker*. Token names and roles are
  identical across themes so no consumer branches on theme.
- **PR is a shape, not a colour** — a hairline capsule outlined in `ink` containing mono
  uppercase `PR`. It survives every theme, every colourblind profile, and every screenshot.
- **Deltas are typographic, not chromatic.** `+2.5 kg` in `inkMuted` mono with a leading `+`.
  Never green, never red. A lifter reading "−5 kg" after a deload does not need the app to
  colour it as failure.
- **Warnings are words first.** `warn` and `danger` only ever accompany text that already says
  what is wrong.
- **Charts are monochrome** — `ink` for the series, `rule` for the grid, `inkFaint` for
  labels. A second series uses a dashed stroke, not a second hue. If ember appears in a
  chart it is a projected point and it is labelled as such.

### 6.4 The confidence ladder

The parser's certainty must be legible without a word of explanation. Three levels, expressed
as increasing visual commitment:

| Confidence | Meaning | Card treatment |
|---|---|---|
| **High** (≥ 0.9) | Unambiguous | Values in `ink`. No adornment. |
| **Medium** (0.6–0.9) | Read, but guessed at something | Values in `ink`, one dotted underline under the guessed field, tapping it opens the repair sheet with that field focused |
| **Low** (< 0.6) | We think this is an exercise but are not sure | Whole card at 70% opacity with a hairline dashed border and one row: *"tap to confirm"* |

Below 0.4 we produce no card at all. The line stays in the note and nothing happens (§4.4).

### 6.5 Typography

Two faces. Their division of labour *is* the record contract.

- **Text: SF Pro** (system). Words, labels, headings, buttons, prose. Free, ships everywhere,
  supports Dynamic Type natively, and is the right neutral against a strong data face.
- **Data: JetBrains Mono** (bundled via `expo-font`). Every number that is a training fact —
  loads, reps, sets, distances, times, volumes, dates in tables, the streak, e1RM. Tabular
  figures, real character, a slab-ish terminal that reads as *instrument* rather than *code*.

The rule is absolute and it is the app's typographic signature: **words are humanist, numbers
are machine.** A load never appears in SF Pro. A sentence never appears in JetBrains Mono.

```ts
// src/lib/theme/type.ts — every size runs through moderateScale + Dynamic Type clamp
display   { 40 / 44, weight 700, tracking -0.02em }  // onboarding + paywall headlines only
title1    { 28 / 34, weight 700, tracking -0.01em }
title2    { 22 / 28, weight 600 }
title3    { 17 / 22, weight 600 }
body      { 17 / 24, weight 400 }
bodyEmph  { 17 / 24, weight 600 }
callout   { 15 / 20, weight 400 }
caption   { 13 / 18, weight 500 }
micro     { 11 / 14, weight 600, tracking 0.06em, uppercase }  // tags: RECORDED, PR, PLANNED
dataXL    { 34 / 38, mono, weight 700, tabular }  // one hero number per screen, max
dataL     { 22 / 26, mono, weight 600, tabular }  // card values
dataM     { 17 / 22, mono, weight 500, tabular }  // table cells
dataS     { 13 / 18, mono, weight 500, tabular }  // sublines, comparisons
```

- **Never hardcode a font size.** Ever. Tokens only.
- **Headlines are left-aligned and heavy**, per the iOS 26 type direction. Centred onboarding
  headlines are what both competitors do and they read as generic; left-aligned display type
  is both more current and more distinctive.
- Dynamic Type is clamped to `xSmall … accessibilityLarge`. Above that, cards reflow to a
  vertical stack rather than shrinking. Never truncate a load or a rep count — reflow instead.

### 6.6 Space

4pt base. Only these values exist:

```
space = { 0:0, 1:4, 2:8, 3:12, 4:16, 5:20, 6:24, 7:32, 8:40, 9:56, 10:72 }
```

- Screen horizontal padding: `space.4` (16). Cards: `space.4` internal.
- Between cards in a session: `space.3` (12) — close enough to read as one session.
- Between sections: `space.7` (32).
- Above a section header: `space.8` (40). Sections need more air above than below; that
  asymmetry is what makes a long scroll feel organised.
- Minimum touch target 44×44 always, even when the visual element is smaller.

### 6.7 Shape and concentricity

iOS 26 nests radii concentrically: an inner radius equals the outer radius minus the padding
between them. Follow it — mismatched nested corners are the single most common tell of a
non-native-feeling app.

```
radius = { sm:8, md:12, lg:16, xl:20, xxl:28, capsule:999 }
```

- Cards: `lg` (16). A control inside a card with 12pt padding gets `8` — because 16 − 12 = 4,
  rounded to the nearest step up for optical comfort. When in doubt compute it, don't guess it.
- Sheets: `xxl` (28) top corners.
- **Buttons and chips are capsules.** iOS 26 prefers capsule shapes for interactive elements;
  our primary CTA is a 52pt capsule.
- Inputs and the composer surface: no radius at all. The writing surface is a page, not a
  widget. This is deliberate and it is what keeps the composer from looking like a chat app.

### 6.8 Elevation

Two shadows, both in the ink family, both warm-neutral, never coloured:

```ts
shadow.card   = { y:2,  blur:8,  opacity: dark ? 0.35 : 0.06 }
shadow.raised = { y:10, blur:28, opacity: dark ? 0.50 : 0.10 }
```

- `card` — session cards, list rows that are tappable, stat tiles.
- `raised` — paywall plan cards, the PR moment, sheets, the onboarding hero card.
- Flat, hairline only: chips, tags, segmented controls, table rows, anything inside a sheet
  scrim, anything smaller than 44pt.
- A raised surface softens its border to `rule` at 50% — the shadow already carries the edge,
  and doubling them reads as heavy.

"Calm core, rich edges": the reading surfaces stay flat, the interactive and hero surfaces
lift.

### 6.9 Liquid Glass — where and where not

Glass is a **functional layer for controls and navigation that floats above content.** It is
not a decorative material and it never goes on a content surface. Apple's guidance is
explicit and we follow it exactly.

**Glass is allowed on exactly four things:**
1. The tab bar (system-provided via `NativeTabs`).
2. The composer accessory bar that sits above the keyboard.
3. The floating rest-timer pill.
4. Sheet grabber areas and navigation bars (system-provided).

**Glass is forbidden on:** cards, the session summary, stat tiles, the paywall, onboarding
screens, charts, list rows, and anything containing a scroll view. Scrollable content inside a
`GlassView` renders incorrectly and destroys the material.

```tsx
// src/components/glass.tsx — the ONLY place glass is constructed
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { BlurView } from 'expo-blur';
import { AccessibilityInfo, View } from 'react-native';

export function Glass({ style, children }) {
  const reduced = useReduceTransparency();          // AccessibilityInfo
  if (reduced) return <View style={[style, solidFallback]}>{children}</View>;
  if (isLiquidGlassAvailable())
    return <GlassView style={style} glassEffectStyle="regular">{children}</GlassView>;
  return <BlurView intensity={40} tint="dark" style={style}>{children}</BlurView>;
}
```

Hard rules learned from the platform:
- **Never animate `opacity` on a glass view or any of its ancestors.** Opacity below 1 stops
  the effect rendering entirely. Fade with the built-in `animate` prop or translate it off
  screen.
- **Always check `isLiquidGlassAvailable()` at runtime**, not the iOS version — some iOS 26
  builds lack the API and calling into it crashes.
- **Always check `AccessibilityInfo.isReduceTransparencyEnabled()`** and fall back to a solid
  `surface` at full opacity.
- Toggling `isInteractive` requires remounting with a new `key`; it does not update in place.
- Group related controls into one glass cluster; separate unrelated ones with space, not with
  a second pane. Two adjacent glass surfaces read as a bug.

### 6.10 Iconography

SF Symbols, weight `regular`, scale `medium`, always `ink` or `inkMuted`, never ember. Filled
variants only for selected tab states. We ship no custom icon set. The one custom mark in the
product is the wordmark, and it appears in exactly two places: the first onboarding screen and
the share card.

---

## 7. Motion

### 7.1 Physics

One spring family for the entire app. Reanimated 4 (`react-native-worklets`, new architecture
only — Reanimated 3 is not an option, SDK 54 requires the new arch for v4).

```ts
export const motion = {
  // springs — used for anything that moves in space
  snap:    { damping: 26, stiffness: 340, mass: 0.9 },  // cards, chips, small elements
  settle:  { damping: 30, stiffness: 220, mass: 1.0 },  // sheets, large surfaces
  gentle:  { damping: 34, stiffness: 140, mass: 1.0 },  // ambient, background, charts

  // timings — used for anything that only changes appearance
  fast:    { duration: 140, easing: Easing.out(Easing.quad)  },
  base:    { duration: 220, easing: Easing.out(Easing.cubic) },
  slow:    { duration: 380, easing: Easing.out(Easing.cubic) },
};
```

Nothing in this app overshoots except one element (§7.6). `damping` below 20 is not used.

### 7.2 The named transitions

| Name | Where | Spec |
|---|---|---|
| `card.settle` | A parsed line becomes a card | translateY 8→0 + opacity 0→1, `snap`, 40ms stagger per card |
| `card.repair` | A value changes after correction | the changed number only: scale 1→1.06→1, `fast`, plus a 200ms `emberSoft`→transparent wash |
| `read.pulse` | Parse in flight | the reading row's opacity 0.4↔0.7, `gentle`, infinite, cancels the instant a result lands |
| `target.reveal` | Coach target appears in a card | height 0→auto + opacity, `settle`, 120ms after the card settles |
| `sheet.present` | Any sheet | system presentation, untouched |
| `tab.switch` | Tab change | system, untouched |
| `push` | Navigation push | system, untouched |
| `summary.rise` | Session summary appears | translateY 24→0 + opacity, `settle` |
| `pr.flag` | A PR lands | §7.6 |
| `count.roll` | A number changes value | digit roll over `base`, only for totals ≥ 3 digits |

### 7.3 What never animates

- Text content changing inside a settled card (it just changes — animating it makes the record
  feel unstable).
- Anything during typing. The composer is silent while the keyboard is up, except the reading
  pulse.
- Tab bar, nav bar, keyboard — all system, never intercepted.
- Loading states longer than 400ms never use a spinner (§12.2).

### 7.4 Haptics

`expo-haptics`, and only these:

| Event | Feedback |
|---|---|
| Card settles | `impactAsync(Light)` |
| Correction saved | `impactAsync(Medium)` |
| Session finished | `notificationAsync(Success)` |
| PR | `notificationAsync(Success)` then `impactAsync(Heavy)` 90ms later |
| Rest timer ends | `impactAsync(Heavy)` ×2, 120ms apart |
| Destructive confirm | `notificationAsync(Warning)` |

Never haptic on: tab change, scroll, typing, keystroke, screen appear. Nothing is more
cheapening than an app that buzzes when you look at it.

### 7.5 Reduce Motion

`useReducedMotion()` from Reanimated. Mapping, not disabling:

| Normal | Reduced |
|---|---|
| translate + spring | opacity only, `fast` |
| stagger | all at once |
| `read.pulse` | static at 0.55 opacity |
| `pr.flag` | the flag appears, no scale, no particles, no overshoot |
| `count.roll` | value swaps |

Reduce Motion must never remove information, only movement.

### 7.6 The one exuberant moment

A personal record is the only thing in Recore allowed to celebrate, and it gets exactly this:

The PR capsule scales `0.9 → 1.08 → 1.0` on a spring with damping 14 — the single overshoot in
the app — while a hairline ring sweeps once around the card border over 500ms and fades. Heavy
haptic. No confetti, no full-screen takeover, no sound, no modal, no emoji. The session
continues; nothing is interrupted.

A serious lifter has just done something they have never done before. The app acknowledges it
once, precisely, and gets out of the way. That restraint is the celebration.

---

## 8. The Composer — how a session gets written

This is 85% of the time spent in Recore. It is the screen that has to be perfect.

### 8.1 Anatomy of Today

```
┌──────────────────────────────────────────────┐
│  Saturday 26 July            ⌃      ○ 6 wks  │  header: date · calendar · streak
│  Push · 4th session this week                │  subtitle, derived, silent if unknown
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ Bench Press                    ⌄       │  │  ← settled card
│  │ 82.5 kg  ·  8 · 8 · 7                  │  │     RECORDED
│  │ +2.5 kg vs 21 Jul          ⌐PR¬        │  │
│  │ ─────────────────────────────────────  │  │
│  │ next   85 kg × 8                       │  │  ← PLANNED, ember
│  │ you had two left in the tank last time │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ Incline DB Press  ·  "incline db"      │  │  ← alias echo
│  │ 30 kg  ·  12 · 12 · 10                 │  │
│  │ first recorded                         │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│    reading…                                  │  ← in flight, dashed, pulsing
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                              │
│  ┃ cable flyes 3x15 25                       │  ← the live line, cursor
│                                              │
├──────────────────────────────────────────────┤
│  ⟲ 2:00   mic    3 exercises · 4,180 kg  Finish│  ← accessory bar (glass)
└──────────────────────────────────────────────┘
```

**Header.** Date in `title2`. Tapping the chevron opens the calendar sheet. Session title is
derived from what has been logged (the dominant muscle group, or the matched split day, or
nothing at all — never "New note," never a placeholder). Streak on the right, mono, no icon,
no flame (§15.3).

**Body.** Settled cards, newest last, then the in-flight card, then the live line with the
cursor. The whole thing is one scroll view; the live line is always the last element and the
view keeps it just above the accessory bar.

**Accessory bar.** Glass, above the keyboard, four things: rest timer, microphone, the running
session total, and Finish. Nothing else ever goes here.

### 8.2 The writing surface

- Focused on mount when today is empty. Never steals focus if the user came back to read.
- One exercise per line is the convention, but the parser handles several per line and
  produces several cards.
- **Return commits.** The line is parsed, a card settles, the field clears, the cursor stays.
- The user can keep typing while a parse is in flight. The in-flight card is anchored to the
  physical line it came from and stale results are discarded.
- **Nothing is ever destroyed.** Committed lines remain in `raw_text` forever. The cards are a
  view of `raw_text`, not a replacement for it. Swiping down on the header reveals the raw
  note in full — the "show me what I actually typed" escape hatch, which must always exist.
- Placeholder on a truly empty day is a single line of `inkFaint`: `bench 3x8 80` — an
  example, not an instruction.

### 8.3 The card — anatomy

This is where the brief's "richer exercise cards, better hierarchy, elegant separators" is
delivered. Every card is a small, fixed, four-zone structure:

```
zone 1  NAME        resolved canonical name · quiet alias echo of the user's word
zone 2  VALUE       load in dataL mono, then the rep sequence in dataM
zone 3  CONTEXT     one line: comparison to last time, or "first recorded", or PR capsule
zone 4  TARGET      [optional] hairline rule, then the ember prescription + reason
```

Rules:
- **Never more than four zones.** No muscle-group tag, no equipment icon, no set-by-set table,
  no volume subtotal. Those live in the Lift detail (§11.2). A card is a receipt line, not a
  dashboard.
- The alias echo (`· "incline db"`) is how the user sees that we understood *their* word. It
  is the single highest-trust element on the screen and it is never hidden.
- Sets collapse to a sequence: `8 · 8 · 7`. Identical sets collapse further: `3 × 8`. A
  dropset renders as `80 → 60 → 40` with arrows. A superset renders as two names sharing one
  card with a vertical rule between them.
- Warm-up sets are recorded but rendered at `inkFaint` and excluded from every total.
- Cardio renders distance and time instead of load: `5.0 km · 26:04 · 5:13 /km`.
- **Separation between cards is space and a hairline, never a heavy divider.** 12pt gap,
  cards on `surface` against `canvas`. That contrast alone is the separator.

### 8.4 The repair path — where taps come back

Typing is the fast path. Repair is the touch path, and it must be excellent, because a parser
that cannot be corrected in two seconds is a parser nobody trusts.

**Tap a value → inline edit in place.** The number becomes a stepper without leaving the card:

```
  ┌───────────────────────────────────────┐
  │ Bench Press                           │
  │   ⊖   82.5 kg   ⊕      8 · 8 · 7      │
  │       └ − 2.5 ─ + 2.5 ┘               │
  └───────────────────────────────────────┘
```

- Stepper increment comes from the exercise's `increment_kg` (§10.2), so a bench steps 2.5 and
  a dumbbell press steps 2.
- Long-press the stepper to accelerate.
- Tap a rep number to edit that set only; the keyboard opens numeric.
- Changes write to SQLite immediately and animate with `card.repair`.

**Long-press a card → the repair sheet.** Full correction: exercise identity, per-set fields,
set kind (working / warm-up / dropset), and the scope control:

> ○ Only this line  ● Always read **"incline db"** as Incline Dumbbell Press

The second option writes an alias override that applies forever, including when the target is
a global exercise. This is the mechanism that makes the parser feel personal by week two.

**Swipe left on a card → Delete**, with undo in a toast for 6 seconds. Deleting a card strikes
the line in `raw_text` rather than removing it — the words survive, the record does not.

Every repair writes a `corrections` row. Those rows are training data for the eval set (§9.4)
and they are the most valuable data in the product.

### 8.5 Gestures

| Gesture | Result |
|---|---|
| Tap a card value | Inline stepper |
| Tap a card name | Open that Lift's detail sheet |
| Long-press a card | Repair sheet |
| Swipe left on a card | Delete (undo toast) |
| Swipe down on header | Reveal raw note |
| Swipe down on the composer | Dismiss keyboard |
| Pull down on Today | Nothing. Never a pull-to-refresh — the data is local |

### 8.6 Voice

The microphone dictates into the composer. That is all it does. There is no voice mode, no
transcript view, no separate pipeline — dictated text is text and goes through the same
parser. On-device `expo-speech-recognition`; never a cloud transcription API.

The parser must be explicitly hardened for dictation artefacts: `"eighty kay gee"` → 80 kg,
`"three by eight"` → 3×8, `"one oh five"` → 105, and the same in Slovenian. These belong in
the eval set as a named group.

### 8.7 The rest timer

Setgraph's strongest in-gym feature and we match it properly.

- Starts automatically when a card settles. Duration from the exercise's own rest preference,
  defaulting to the user's global default.
- Renders in the accessory bar as a mono countdown. Tap to stop, long-press to change.
- **Live Activity + Dynamic Island** via `expo-live-activity`: the countdown is on the lock
  screen without opening the app. This requires a development build and is not optional — it
  is the difference between a timer and a rest timer.
- Last 10 seconds the countdown goes ember (a countdown *is* a planned future, so this is
  consistent with §6.2).
- At zero: haptic and a local notification, **never a sound**. Nobody wants their phone to
  alarm in a quiet gym.
- The notification carries one action: **Log the same set again** — one tap repeats the last
  set without opening the app.

### 8.8 Finishing

`Finish` is the primary action in the accessory bar, disabled at 40% opacity while nothing is
staged. Tapping it dismisses the keyboard and reveals the **session summary**, which rises
into place below the last card:

```
┌────────────────────────────────────────────┐
│ RECORDED                       48 min      │
│                                            │
│ 5 exercises · 19 sets · 12,480 kg          │
│ 1 personal record                          │
│                                            │
│ vs last Push        +640 kg    +1 set      │
└────────────────────────────────────────────┘
        Share            Done
```

- The summary always exists for every finished session. No heuristics, no detection, no
  "receipt mode." The old rule that a receipt appeared only when ≥ 4 exercises were typed
  within 60 seconds was unpredictable and is removed.
- `Share` produces the share card (§15.5).
- Finishing is what turns staged work into a settled session, seeds the Coach (§10), updates
  the streak, and closes the day.

### 8.9 Empty and near-empty Today

An empty day is never a void. In priority order:

1. **A target exists** (the Coach knows what is next): show the target card. This is the best
   possible empty state — the app already knows what you are here to do.
2. **History exists, no target**: show the last session, collapsed, one line — *"Last: Push,
   Thursday · 5 exercises · 11,840 kg"* — tapping opens it.
3. **Nothing at all** (first day): the self-writing demo. A line types itself, gets read, and
   settles into a card, once, then leaves the placeholder behind. It runs exactly once per
   install.

---

## 9. The Parser

The parser is why someone switches. The bar is one sentence: **the user never has to change
how they write.**

### 9.1 Pipeline

1. Keystroke → `raw_text` to SQLite, same frame, no await.
2. Debounced (450ms after typing stops, or immediately on Return) call to the
   `parse-workout` edge function.
3. Response validated and clamped server-side, re-anchored to physical lines client-side (the
   model's line index is a hint, never a fact), stale-guarded against text typed in flight.
4. Applied to `items` / `sets`, cards settle.
5. The Coach recomputes and caches (§10).

Offline or failing: the line stays, retries at 3s / 8s / 20s with the reading row still
pulsing, then the sync loop takes over. A late success reaches an open screen through the
parse listener. **The user never waits and never loses a character.**

### 9.2 Security and cost posture (do not weaken)

- The model key exists only as a Supabase secret inside the edge function. Never in the
  client, never passed from the client, never in an env var prefixed `EXPO_PUBLIC_`.
- JWT-verified identity; per-user sliding-window rate limit via a service-role RPC.
- User text is wrapped in `<workout_log>` delimiters; the system prompt states that content
  inside is data, never instruction.
- Every numeric field is clamped server-side to physically possible ranges.
- `raw_text` is never logged, never included in an error report, never sent to any analytics.
- Haiku-class model by default (`PARSE_MODEL` secret overrides), prompt caching on the static
  prefix, `parse_cache` so unchanged text is never re-sent, debounce so a session parses once
  per pause rather than once per keystroke.

### 9.3 What it must handle

`supabase/functions/parse-workout/prompt.ts` is the single source of truth for the prompt and
is shared with the eval harness. Required coverage, each a named eval group:

| Group | Examples |
|---|---|
| Basic | `bench 3x8 80kg`, `squat 5,5,5 @100`, `deadlift 100x5 110x3 120x1` |
| Shorthand | `bp 3x8 80`, `ohp 5x5`, `rdl 3x10 60` |
| Supersets | `bench 3x8 80 ss flyes 3x12 20`, `A1 squat / A2 leg curl` |
| Dropsets | `last set drop to 40`, `curls 12 → 8 → 6 dropset` |
| Myo / rest-pause | `myo 12 + 4 + 4 + 3`, `rp 8/3/3 @ 60` |
| RIR / RPE | `left 2 in the tank`, `@8`, `rpe 9`, `to failure` |
| Bodyweight | `pull ups 3x10`, `dips bw+20 3x8`, `push ups 50 total` |
| Cardio / hybrid | `5k easy 26min`, `row 2000m 7:45`, `sled push 4x20m 100kg` |
| Carries / holds | `farmers 3x40m 2x32kg`, `plank 3x60s` |
| Slovenian | `potisk s prsi 3x8 80kg`, `počepi 5x5 100`, `mrtvi dvig 3x5` |
| Mixed language | `bench 3x8 80kg, zadnji set do odpovedi` |
| Dictation | `eighty kay gee`, `three by eight`, `osemdeset kil` |
| Prose | `felt destroyed today`, `shoulder tweaky, went light` → **no card** |
| Corrections | `actually that was 85 not 80` → amends the previous item |

### 9.4 The quality flywheel

- **The eval harness is the gate.** `npm run eval` runs the real prompt against the labelled
  set. Any change to the prompt or the schema bumps `PARSE_VERSION` and must pass eval before
  deploy. No exceptions — a parser regression breaks the core promise invisibly.
- **Every real miss becomes an eval case.** When a line parses wrong, first add it to the eval
  set, then fix the prompt. The set only grows. Seed it from synced `corrections` rows.
- Target: **150 labelled lines before launch**, with every group above represented and at
  least 30 Slovenian.
- CI blocks a deploy on any regression, not just on a lower aggregate score. A prompt change
  that fixes ten cases and breaks one is a failure until the one is fixed.

### 9.5 Personal vocabulary

By week two, the parser must feel like it was built for this specific person.

- Every user has an alias table built from their own corrections and confirmations. It is sent
  as a compact suffix *after* the cached prompt prefix, so caching is preserved:
  `known: bp=Bench Press, incline db=Incline Dumbbell Press, počepi=Squat, …` (cap at 60
  entries, most recent first).
- Alias overrides are consulted **before** any other resolution, including for global
  exercises.
- Canonical names are English; `aliases_seen` preserves exactly what the user typed,
  lowercased. Writing in your own language is an explicit adoption lever and must never
  degrade.
- When `parse_version` bumps, old notes re-parse in the background, batched, rate-limit aware,
  lowest priority. Every user's history quietly gets better overnight. This is the compounding
  advantage no form-based competitor can copy.

### 9.6 Auto-fixes are visible

When the parser silently corrects a typo (`tricpes` → Triceps Pushdown), the card keeps the
user's original word as the alias echo. An invisible auto-fix is indistinguishable from a
parser that guessed wrong, and it destroys trust the first time it is noticed. Every
correction we make is reviewable in one long-press.

---

## 10. The Coach

The Coach is why someone stays. It returns to the interface in this version, in a different
shape than the ghost card that was removed in July.

### 10.1 The iron law

> **Code computes the number. The model only phrases the reason.**

A language model never picks a weight, never picks a rep count, never decides to deload. It is
given a fact (`+2.5 kg because RIR ≥ 2 at 82.5 on 21 July, quoting "two left in the tank"`)
and writes one sentence in the user's language. If the model is unavailable, we show the number
with a template sentence. If the engine has no confident number, there is no target and no
sentence.

The category's cautionary tale is well known: precise, stable, explainable per-set targets earn
4.9-star trust; "AI-generated workouts" that feel arbitrary get uninstalled. We are firmly on
the first side of that line and we never cross it for a demo.

### 10.2 The engine

Pure, synchronous, unit-tested, no I/O: `src/lib/predict/engine.ts`.

Double progression with RIR:

- Hit the top of the rep range on every working set → **add weight** by the exercise's
  `increment_kg`, drop to the bottom of the range.
- RIR ≥ 2 extracted from the user's own words → **add weight now**, do not wait for the range.
- RIR 0–1 and inside the range → **chase one more rep** at the same load.
- Below the range → **hold**. Two consecutive stalls → **deload −10%** and reduce volume for
  one session.
- **Effort creep**: same load, flat reps, and RIR trending down across three sessions →
  propose the deload *before* the second stall fires. Say why in one line.
- Bodyweight progresses reps first, then added load.
- Cardio, carries, and holds repeat the last prescription. We do not invent running programmes.
- An exercise seen exactly once repeats verbatim with **no reason line**. We never extrapolate
  from one data point.
- Every load rounds to what the bar can actually hold, using the user's smallest plate, in
  pairs (`roundToPlate`).

Rep range is inferred as `(top set reps − 2) … top set reps` unless the exercise carries an
explicit range. Isolation work defaults wider (8–15).

### 10.3 Which session

Zero-config split matching, `src/lib/predict/split.ts`, pure and tested:

Cluster the last ≤ 10 sessions by exercise-set Jaccard similarity (≥ 0.5 against the cluster's
most recent member). Read the label sequence as a rotation. Progress the most recent session of
the cluster that *follows* the one just finished — unique successor, or dominant successor with
≥ 2 observations. No confident rotation → progress the latest session.

**We never ask the user to define their split.** Ever. If we cannot infer it, we fall back
silently.

### 10.4 Where the target appears

The old design put a whole "PLANNED" card at the top of the note. It competed with the blank
page, went stale on rest days, and forced a binary accept/dismiss decision before the user knew
what they were doing. It is replaced by something smaller and better:

> **The target lives inside the exercise card, and appears the moment the exercise is named.**

Type `bench` and the card materialises with zone 4 already filled:

```
  Bench Press
  last  82.5 kg · 8 · 8 · 7
  ─────────────────────────────────
  next  85 kg × 8
  you had two left in the tank last time
```

Type your actual numbers and zone 4 collapses away — it was a reading, not a contract. This
is better than the ghost card on every axis: it appears exactly when the decision is being
made, it is per-exercise so rest days are irrelevant, it needs no accept button, and it cannot
be wrong about *which day* it is because the user just told us by typing the name.

**Secondary placement:** on an empty Today when the Coach is confident about the whole session,
the empty state shows the full list as targets (§8.9). Tapping one writes that exercise's name
into the composer. It is a starting point, not a plan to accept.

### 10.5 Trust rules — never violate

- The target is text, not a lock. Typing anything overrides it silently, with no confirmation
  and no judgement.
- One reason line maximum, and it quotes the user's own words when it can:
  *"Last time at 82.5 you wrote you could've had two more."*
- **No reason → no line.** Never "keep it up," never "you've got this."
- Targets older than 14 days are not shown. Stale advice is worse than silence.
- When history is thin or ambiguous, **repeat conservatively rather than predict cleverly.** A
  wrong target costs more trust than a missing one earns.
- Adherence is settled after each session: matched the target → `followed`; accepted then
  changed → `edited`; never engaged → `ignored`. A rising `ignored` rate is a signal to show
  targets *less*, and the app must act on it: three consecutive `ignored` for an exercise
  suppresses its target for two weeks.

### 10.6 Honesty about the record

Once ≥ 5 targets have settled, the Lift detail shows the Coach's own record:
*"followed 11 of the last 14."* We show this even when it is bad. An app that publishes its own
hit rate is making a claim no competitor makes, and it is the cheapest trust we will ever buy.

---

## 11. The other three surfaces

### 11.1 Progress

Three zoom levels on one screen, in this order. The rule for this screen: **every number must
be true and nothing may be flattering.** A bad month looks like a bad month.

**Zoom 1 — this week.** Four stat tiles, mono, no icons, no colour:

```
┌──────────────┬──────────────┐
│ 12,480 kg    │ 4            │
│ VOLUME  +6%  │ SESSIONS     │
├──────────────┼──────────────┤
│ 140 kg       │ 11 / 14      │
│ TOP LIFT     │ TARGETS MET  │
└──────────────┴──────────────┘
```

**Zoom 2 — the last twelve weeks.** One monochrome bar chart of weekly volume with session
dots beneath each bar, and beneath it at most **two** insight lines, generated from
deterministic rules, never from a model:

- *"Your best four-week stretch since March."*
- *"Volume up 14%, sessions flat — you're adding work per session, not more sessions."*
- *"Three weeks below your target frequency."*

If no rule fires, no line appears. Never fill the space.

**Zoom 3 — the archive.** A segmented control: **Calendar · Sessions · Records.**

- *Calendar* — a month grid, dots on trained days, the dot's weight scaled by session volume.
  Tapping a day pushes that session.
- *Sessions* — a reverse-chronological list, one dense row per session: date, title, exercise
  count, volume, PR marker.
- *Records* — every all-time PR, one row each, sorted by recency, with the date and a sparkline
  of that lift's e1RM.

**Weekly review.** From Monday 00:00 until the user dismisses it, a card sits at the top of
Progress: last week's volume, sessions, week-over-week change, PRs, and one honest sentence.
It is dismissible, it never nags, and it is the artefact the weekly notification points at
(§16).

### 11.2 Lifts

The list: every exercise the user has ever named, sorted by most recent, with a search field.
Each row is dense: name, last-performed date, top set, and a 12-week sparkline. A user with 60
exercises should see 12 rows on screen, not 5.

Tapping pushes the **Lift detail**, which is the most data-dense screen in the app and is
allowed to be:

```
Bench Press
"bench", "bp", "potisk s prsi"                     ← their vocabulary, plainly shown

  ESTIMATED 1RM        104 kg      +6 kg / 8 weeks
  ┌──────────────────────────────────────────┐
  │            e1RM, 12 weeks, monochrome    │
  └──────────────────────────────────────────┘

  NEXT        85 kg × 8                            ← ember, if the Coach is confident
  followed 11 of the last 14

  DATE      SETS   TOP SET        VOLUME
  21 Jul     3     82.5 × 8        1,980 kg
  17 Jul     3     82.5 × 7   PR   1,897 kg
  14 Jul     4     80.0 × 8        2,240 kg
  …
```

- Header, chart, target, then the table. The table is the point; everything above it is
  context.
- Tapping a table row opens that session. Long-pressing opens the repair sheet for that entry.
- Per-exercise settings live behind a menu here: rep range, weight increment, rest duration.
  These are the only per-exercise settings that exist.

### 11.3 You

A grouped list. Nothing more elaborate is warranted.

```
  ACCOUNT        signed in as … · replay setup · sign out
  SUBSCRIPTION   plan · manage in App Store · restore purchases
  TRAINING       units · smallest plate · default rest · weekly target
  PARSING        writing language · what we send and what we don't
  YOUR DATA      export CSV · export JSON · import from Hevy/Strong · delete everything
  ABOUT          version · terms · privacy · contact
```

- **Weekly target** (sessions per week) is here and it is the only input to the streak (§15.3).
- **PARSING → what we send** is a plain-English page: the text of a workout line goes to a
  model to be structured; it is not used for training; it is never logged; here is how to turn
  it off (with an explanation that turning it off disables the card view but keeps the note).
  Writing this page well is a trust asset, not a legal chore.
- **Delete everything** is real, immediate, and irreversible after one typed confirmation.
- Export is free and always available, including on a lapsed subscription.

---

## 12. States

Every screen must have a designed answer for all five. A screen without them is unfinished,
not shipped.

### 12.1 Empty

| Screen | Empty state |
|---|---|
| Today | §8.9 — target, last session, or the self-writing demo |
| Lifts | *"Lifts appear here as you name them."* + one example line |
| Progress | *"Two more sessions and there's something to show here."* — never a zeroed chart |
| Records | *"Your first recorded set becomes your first record."* |
| Lift detail | Impossible — a Lift exists only because it was logged |

Never render an empty chart with zero axes. Never say "No data." An empty state states what
will fill it and, where possible, offers the action that fills it.

### 12.2 Loading

- **Under 400ms: show nothing.** No spinner, no skeleton, no flash. Most local reads are here.
- **400ms–2s:** the specific element pulses (`read.pulse`). Never a full-screen spinner.
- **Over 2s:** skeleton rows matching the real layout's geometry exactly, so nothing shifts
  when the content lands.
- **The Coach never blocks anything.** It computes after a session and reads from cache.
- Onboarding's one deliberate wait (§13.9) is the single exception, and it is doing real work.

### 12.3 Error

Errors state what happened and what to do, in the interface's voice, and never apologise.

- Parse failed: **nothing visible.** The line stays, retries happen, the reading row keeps
  pulsing. This is not an error to the user.
- Sync failed: a single hairline row at the bottom of Today — *"Not synced yet — everything is
  saved on this phone."* No colour, no icon, no modal.
- Auth expired: a sheet that explains and offers sign-in. Never a logout.
- Purchase failed: the real StoreKit reason, plus **Restore purchases** and a contact address.
- Never a toast for anything the user did not initiate.

### 12.4 Offline

Offline is not an error state; it is the expected state of a gym in a basement. Everything
works. Nothing warns. The only visible difference is the unsynced row above. Sync resumes
silently.

### 12.5 Lapsed subscription

Read-only, complete, and dignified: all history visible, all charts visible, full export.
Composing is disabled with one line — *"Your record is here and it's yours. Resubscribe to
keep writing."* — and a single button. No countdown, no dark pattern, no data held hostage.

---

## 13. Onboarding

### 13.1 Shape and rationale

Sixteen screens, roughly three minutes, in this order:

```
proof → questions with visible payoffs → the hero demo → setup → commitment
      → attribution → build → reveal → PAYWALL → SIGN IN
```

Three structural decisions, each grounded:

**Account last.** A signed-out first-timer goes straight into onboarding and creates an account
only at the very end, as the step that starts the trial. `index.tsx` is a dispatcher: no
session + not onboarded → `/onboarding`; no session + onboarded → `/paywall`; session +
onboarded → Today. Only the real app screens sit behind the auth guard.

**The paywall lives inside onboarding.** Onboarding paywalls with a trial produce the highest
install-to-paid conversion of any placement, and 82% of health & fitness trials start on day
zero. If someone is going to subscribe, it happens here or it does not happen.

**Every question is paid off.** Eight questions, five of which are immediately followed by a
screen that visibly uses the answer. This is Setgraph's rhythm and it is the single biggest
difference between a funnel that feels personal and one that feels like a form. A question
whose answer we do not use gets deleted, not kept "for later analytics."

Persistent rules: Back on every screen. Skip setup available on screens 3–10 (applies defaults,
jumps to 13). One decision per screen. No workout text, no import, no ledger before the
paywall. **No permission prompt anywhere in onboarding** — the microphone asks when the
microphone is tapped, notifications ask when the first rest timer starts. Progress bar from
screen 2, full by 14. Every answer persists to local `meta` immediately; a relaunch resumes at
`pref_ob_step`.

### 13.2 Screen 1 — Welcome

Left-aligned, heavy `display`. No centred hero, no illustration, no carousel.

> **Write your training the way you'd say it.**
> Recore reads it and keeps the record.

Below, a live specimen that plays once, unprompted:

```
bench 3x8 80kg, last set to failure          ← types itself, 42ms/char
──────────────────────────────────────
Bench Press                                   ← settles as a card
80 kg · 8 · 8 · 8
last set to failure
```

Four seconds. That is the whole pitch and it is unanswerable — neither competitor shows the
product at all in their entire funnel, and this one demonstrates the only thing that makes us
different before asking for anything.

`Get started` · `I already have an account`

### 13.3 Screen 2 — Name (optional)

> **What should we call you?**
> Optional. It only changes how the app talks to you.

Empty → CTA reads `Skip for now`. Filled → `Continue`. Feeds every later screen
(*"your record is ready, Marko"*). Degrades to nothing gracefully.

### 13.4 Screens 3–4 — Goal, and what it changes

**3 · Question.** *"What are you training for?"* — Strength · Hypertrophy · Both · Hybrid /
Hyrox.

**4 · Payoff**, tailored. Hypertrophy example:

> **We'll chase reps before load.**
> When you fill the top of your rep range on every set, Recore adds weight. Until then it
> asks for one more rep.
>
> ```
> Bench Press    82.5 kg · 8 · 8 · 7
> next           82.5 kg × 8            ← ember
> ```

Strength swaps the rule and the example (`+2.5 kg` when all sets hit the top). Hybrid adds a
line about runs and carries being first-class. This screen does real work: it sets the default
rep-range width and it teaches the one mechanic the user needs to trust the Coach.

### 13.5 Screens 5–6 — Current tracker, and the objection

**5 · Question.** *"How do you track today?"* — Notes or paper · Hevy · Strong · A spreadsheet ·
Nothing yet.

**6 · Payoff**, tailored per answer. This is Setgraph's *Your Notebook, Upgraded* and it is
their best screen.

- Notes/paper → **"Your notes, understood."** Same freedom to write anything. Plus: it adds up,
  it charts, and it remembers what you lifted last time.
- Hevy/Strong → **"Everything Hevy records. None of the tapping."** Import your history in the
  first minute — nothing is lost. (Preselects the import card on screen 14.)
- Spreadsheet → **"The columns fill themselves."**
- Nothing yet → **"Start with one line."**

### 13.6 Screens 7–8 — Language, and the hero demo

**7 · Question.** *"What language do you write in?"* — English · Slovenščina · Both · Other
(free text, stored verbatim, best-effort).

**8 · The hero screen.** The same live demo as screen 1, **in the language they just chose.**
Slovenian:

```
potisk s prsi 3x8 80kg
počepi 5x5 100kg
──────────────────────────────────────
Bench Press      80 kg · 8 · 8 · 8
Squat           100 kg · 5 · 5 · 5 · 5 · 5
```

> **Write in Slovenščina. Recore reads it.**
> Your words stay exactly as you typed them. The record underneath is clean.

This is the most important screen in the funnel. It is simultaneously the payoff for the
previous question, a demonstration of the wedge, and a claim no competitor in the category can
make. It must be a real parse against the real prompt, not a canned animation — if the parser
cannot do this reliably it is not ready to ship, and finding that out here is the point.

### 13.7 Screens 9–10 — Setup

**9 · Units and increment.** kg/lb segmented, then a stepper for the smallest bar jump
available (default 2.5 kg / 5 lb). Stores `plate = increment / 2`, wired into `roundToPlate`.
Skipping means repeat-only targets, and we say so in one caption.

**10 · Weekly target.** *"How many sessions in a normal week?"* — 2 / 3 / 4 / 5 / 6+.

This is the only input to the streak (§15.3) and it must be the user's own honest number, not
an aspiration. Caption: *"Pick what you actually do. You can change it any week."*

### 13.8 Screen 11 — The commitment beat

Lyfta's most effective screen, rebuilt honestly.

> **How long do you want this record to run?**
> ○ Through this training block
> ○ Through the next year
> ○ For as long as I train

The next screen does **not** show an invented bar chart. It shows something true:

> **A record is only worth what it's long enough to show.**
>
> Eight weeks of data is when your e1RM curve starts telling you something you didn't already
> know. Twelve weeks is when a stall becomes visible before it becomes a plateau.
>
> `I'm in.`

The answer is stored and used: it sets the horizon on the Progress chart and the framing of the
weekly review. This keeps the commitment-and-consistency effect — a self-declaration made
immediately before a price is shown — while refusing the fabricated evidence. The button says
what the user is agreeing to, not what we want them to feel.

### 13.9 Screens 12–13 — Attribution and the build

**12 · Attribution.** *"How did you find Recore?"* — App Store search · A friend · TikTok /
Instagram / YouTube · A search engine · Something else.

Not personalisation — marketing telemetry, and the cheapest useful question in the funnel.
With ASO-first distribution and a small Search Ads budget, self-reported source is the only
signal that survives SKAdNetwork's blurring. Placed at 12 rather than at 4 so it doesn't
interrupt the value sequence; if funnel data later shows meaningful drop-off before this
point, move it to position 5.

**13 · Building.** A short beat that is doing real work, not theatre: it seeds the exercise
table from the chosen language, applies the increment to `roundToPlate`, prepares the import
if a tracker was named, and warms the parse prompt cache. Rows echo the user's own answers:

```
  language          Slovenščina  ✓
  progression       hypertrophy  ✓
  bar increment          2.5 kg  ✓
  importing from           Hevy  ✓
  ─────────────────────────────────
  87%
```

Auto-advances. No footer, no skip. Under Reduce Motion it is a brief static hold. If the real
work finishes in 300ms, hold for 1.2s anyway — this is the only place in the app where we let
a wait exist, because anticipation before a price is worth more than 900ms.

### 13.10 Screen 14 — Ready

> **Your record is ready, Marko.**

Setup echoed as chips. Then the first-action choice, preselected from screen 5:
`Import from Hevy` / `Write my first line`. Then `See plans →`.

**Social proof:** none, until it is real. No star ratings, no invented testimonials, no "join
30,000 lifters" when there are eleven. Fabricated proof on a live App Store paywall is both
dishonest and a review risk. Until real reviews exist, the proof on this screen is the demo the
user already watched. When real reviews arrive, they appear here with the reviewer's handle and
storefront, the way Setgraph does it.

---

## 14. Paywall and pricing

### 14.1 The model

**Hard paywall.** Nothing is usable before a trial starts. The evidence is unambiguous: hard
paywalls convert at ~10.7% day-35 trial-to-paid versus ~2.1% for freemium, generate roughly 8×
the revenue per install by day 60, and retain one-year subscribers at effectively the same rate
(27% vs 28%). The cost is volume; the benefit is that every user is a real user. For a
solo-built app that needs 1,000 subscribers rather than 100,000 installs, this is the correct
trade.

### 14.2 Two changes from the current plan

**1 · The trial goes from 7 days to one month.** Trial-to-paid by length: ≤4 days 25.5%,
5–9 days 37.4%, 17–32 days 42.5%. A one-month trial converts roughly 14% better in relative
terms than the current seven days, and the mechanism is specific to this product: a lifter on a
4-day split needs more than a week to feel a training record accumulate. Health & fitness is
also one of the few categories where trial users have *higher* lifetime value than direct
buyers, because the habit needs time to form. One month is the longest Apple intro offer that
does not feel like a giveaway.

**2 · The annual price is anchored to its monthly equivalent.** Displaying "$5.00/month, billed
annually" rather than "$59.99/year" has been measured to raise trial-start rate by ~30% and
annual take rate by ~10%, with no effect on trial-to-paid. Same price, honest framing, better
outcome.

### 14.3 The screen

```
  ×                                          Restore

  Recore Pro

  Everything you write, read and kept.

  ┌──────────────────────────────────────────┐
  │ ● Annual              SAVE 44%           │  ← selected by default, raised
  │   $5.00 / month                          │
  │   billed $59.99 yearly · 1 month free    │
  ├──────────────────────────────────────────┤
  │ ○ Monthly                                │
  │   $8.99 / month                          │
  └──────────────────────────────────────────┘

  Today          full access, nothing charged
  Day 25         we remind you, in the app
  Day 30         $59.99 charged, cancel any time before

  ✓  Write in any language, any format
  ✓  Your next target, computed from your own sets
  ✓  Rest timer on your lock screen
  ✓  Every chart, every record, forever
  ✓  Export everything, free, always — even if you cancel

  ┌──────────────────────────────────────────┐
  │            Start my free month           │  ← ink fill, 52pt capsule
  └──────────────────────────────────────────┘

  No charge until 26 August. Cancel any time in Settings.
  Terms · Privacy · Already have an account? Sign in
```

Rules:

- **No colour on this screen.** Ember is for training numbers, not for selling. The CTA is an
  ink fill. This is a deliberate signal: the app does not shout at you, including when it wants
  money.
- The legal line is dynamic and names the real first-charge date.
- `Restore purchases` is visible without scrolling (App Review requires it and users need it).
- The trial timeline is shown as three literal rows. Hiding the charge date is the most common
  dark pattern in this category and we do not use it.
- Monthly exists to make annual legible, and it is priced so that it should. ~68% of health &
  fitness subscriptions are annual; expect the split to land near there.
- **No lifetime tier.** It caps LTV, complicates the maths, and the goal is recurring revenue.
- CTA leads to sign-in (§13), not to a purchase sheet — the account is what the trial attaches
  to.

### 14.4 Billing

RevenueCat, one entitlement (`pro`), two products (`recore_annual_5999`,
`recore_monthly_899`). Entitlement is checked at session start and cached; **never mid-set,
never on a write.** A network failure never blocks logging. If entitlement cannot be verified,
assume entitled and re-check later — a false positive costs one session of revenue, a false
negative costs a customer.

Requires a development build. Until RevenueCat is wired, the paywall is real UI with a stubbed
purchase, and the stub must be obviously stubbed in dev and impossible to ship.

---

## 15. Retention

The brief asked for retention mechanics without "simply adding gamification." The data says
why that instinct is right: the top cancellation reason in fitness subscriptions is **lost
motivation (38%)**, followed by cost relative to a gym membership (18%) and lack of
personalisation or progress tracking (12%). Badges do not fix lost motivation. Evidence of
progress does.

Recore's retention system is five mechanisms, in descending order of power.

### 15.1 The target (the strongest)

A reason to open the app on a training day that exists before the user has done anything.
Covered in §10. If only one retention mechanism ships, it is this one.

### 15.2 The session summary and the share card

A satisfying end to the session (§8.8) does two jobs: it makes finishing feel like completing
something rather than abandoning a text field, and it produces the one artefact worth sharing.

The share card is a monochrome PNG rendered with `react-native-view-shot`: the session's
exercises and loads set in JetBrains Mono, the totals, a PR line if there is one, and a small
wordmark that appears only during capture. No gradient, no photo, no confetti, no
achievement badge. Serious lifters share numbers, not medals — and a screenshot of clean
tabular data is more distinctive in a feed than any graphic we could design.

### 15.3 The streak — weeks, not days

**This is a deliberate departure from every competitor and it is correct.**

A daily streak in a training app punishes rest days. Rest days are training. An app that makes
a lifter feel guilty on their programmed off-day is actively working against the thing it
claims to support, and the moment they miss one, the number resets and the mechanic becomes a
reason to leave.

> **The streak counts consecutive weeks in which the user met their own weekly target.**

The target comes from onboarding screen 10 and is editable any week in You. Three sessions a
week means three sessions — Tuesday, Thursday, Sunday scores the same as Monday, Wednesday,
Friday. A week where you trained four times against a target of three is a met week, not a
bonus.

Rendered as a bare mono number with a small unit: `6 wks`. No flame, no emoji, no colour, no
badge, no celebration when it increments. It sits in the header and says nothing.

When a streak breaks, the app says nothing at all. No "you lost your streak," no re-engagement
push, no guilt copy, ever. The number simply starts again at 1. Guilt is the fastest known way
to make someone delete a fitness app.

### 15.4 The weekly review

Monday morning, one card at the top of Progress (§11.1) and one notification (§16). It
contains last week's real numbers, week-over-week change, PRs, and exactly one honest sentence
from a deterministic rule set.

This is the highest-leverage retention surface after the target, because it is the only place
the app makes an argument for its own value: *here is what you did, here is what changed, here
is the thing you couldn't have seen yourself.* A user who reads four weekly reviews has seen
their own progress four times and is very unlikely to cancel over "lost motivation."

The sentence must sometimes be unwelcome. *"Three weeks below your target — worth looking at
what changed."* An app that only ever reports good news is not a record, it is a cheerleader,
and lifters can tell the difference instantly.

### 15.5 Personal records

Detected automatically on every axis a lifter actually cares about: heaviest set, heaviest for
reps (per rep count), highest estimated 1RM, highest session volume for an exercise. Surfaced
three ways: the PR capsule on the card at the moment it happens (§7.6), the Records list in
Progress, and the Lift detail table.

Never inflate. A PR on an exercise performed twice is technically true and emotionally
worthless — suppress PR marking until an exercise has three recorded sessions.

### 15.6 What we deliberately do not build

Leaderboards. Friends. A feed. Challenges. Badges. Levels. XP. Rings to close. Daily goals.
Push notifications designed to create anxiety. A "you haven't trained in 5 days" message.

Each of these is a known retention mechanic and each is wrong for this user and this team. Our
user is not motivated by strangers' numbers; our team is one person who cannot moderate a
social product; and the entire brand argument is that Recore respects your attention. Adding a
feed would be the single fastest way to become indistinguishable from Lyfta while being worse
at it.

---

## 16. Notifications

Three, and only three, are ever sent. Notification permission is requested at the moment the
first rest timer starts, on a screen that has just explained what the timer does — never in
onboarding.

| Notification | When | Copy |
|---|---|---|
| **Rest is up** | Rest timer completes | `2:00 rest done · Bench Press` — carries a **Log the same set** action |
| **Weekly review** | Monday, at the user's usual training hour ± an hour | `Last week: 4 sessions, 12,480 kg, 1 PR.` — opens the review |
| **Training day** | Only after a stable weekly pattern exists, only if opted in, at most once a week | `You usually train Tuesdays. Bench is due — 85 × 8.` |

Rules:
- **Never a guilt notification.** No "you haven't trained," no "don't lose your streak," no
  "your muscles are waiting."
- Never more than one per day.
- The training-day nudge requires four weeks of consistent pattern before it is even offered,
  and it names a real number from the Coach or it is not sent.
- Every notification is silenceable individually in You, and the app never re-asks after a
  denial.

---

## 17. Accessibility

Not a checklist item. A lifter mid-set has sweat on the screen, a shaking hand, and 40 seconds.
Accessibility work and gym-usability work are the same work.

- **Contrast:** every text/background pair meets WCAG AA (4.5:1 body, 3:1 for ≥ 24pt). `ember`
  on `canvas` is verified in both themes; the light-theme ember is darkened specifically for
  this. Verify in CI with a token-pair test, not by eye.
- **Dynamic Type:** supported to `accessibilityLarge`. Above `xLarge`, cards reflow from
  horizontal to stacked. **Numbers never truncate and never shrink below their token size.**
- **Touch targets:** 44×44 minimum, everywhere, including the inline steppers.
- **VoiceOver:** every card is one accessible element reading as a sentence — *"Bench Press,
  82.5 kilograms, 8, 8 and 7 reps, up 2.5 kilograms from 21 July, personal record."* Not seven
  fragments. The composer announces card settles politely (`accessibilityLiveRegion="polite"`),
  never assertively.
- **Reduce Motion** (§7.5) and **Reduce Transparency** (§6.9) are both honoured, and neither
  ever removes information.
- **Colourblindness:** the design is already safe — one hue, and it always co-occurs with the
  word `next`. PR is a shape. Deltas are signed numbers. Verify with a deuteranopia simulation
  on every screen before release.
- **Left-handed use:** no action lives exclusively in a top-right corner. Everything reachable
  is in the bottom third.
- **VoiceOver + Live Activity:** the rest timer must announce completion.

---

## 18. Data

### 18.1 The invariant

> **`raw_text` is the source of truth. Structure is a projection.**

We never overwrite, clean up, or discard what the user typed. When the parser improves, bump
`parse_version` and reproject from `raw_text` — every user's history improves overnight without
them doing anything. This is the compounding advantage; protect it above all other data
decisions.

### 18.2 Tables

Deployed and additive-only. Authoritative DDL in `supabase/migrations/`, mirrored locally in
`src/lib/db/schema.ts` plus local-only `parse_cache` and `meta`.

`profiles` · `workouts` · `items` · `sets` · `exercises` · `predictions` · `corrections` ·
`alias_overrides` · `parse_rate_limits`

Invariants that must never break:

- **Superset** = shared `group_key` across items. Two is a superset, three a triset, ten a
  circuit — no schema change.
- **Dropset / myo** = `parent_set_id` chain onto the working set, arbitrary depth, never a new
  item.
- **`kind='warmup'` is excluded from every volume computation**, everywhere, without exception.
- **Aliasing:** `bench`, `bp`, `potisk s prsi` all resolve to one `exercises` row via
  `aliases[]`, consulted after `alias_overrides` and before anything else. A new exercise row is
  created only when nothing matches.
- **RLS on every table.** A user can touch only their own rows. Verified by
  `supabase/tests/`, run in CI.
- **Additive migrations only.** Never rewrite a deployed table.

### 18.3 Local-first

SQLite via `expo-sqlite` is the source of truth on device. Every write is local and synchronous
from the UI's point of view. A background loop pushes and pulls with last-write-wins on
`updated_at`, except `raw_text`, which is never overwritten by a remote value that is a strict
prefix of the local one (the classic offline-typing conflict).

Sync failures are invisible and infinitely retried. There is no "sync now" button because there
is nothing for the user to do.

### 18.4 Import and export

- **Import:** Hevy and Strong CSV, plus a generic CSV mapper. Import is a growth feature and
  belongs in onboarding's first-action step, not buried in settings.
- **Export:** CSV and JSON, complete, free forever, available on a lapsed subscription. The
  JSON export includes `raw_text` for every session — if someone leaves, they leave with
  everything, including the words.

---

## 19. Platform and stack

### 19.1 The one blocking migration

**Expo Go is no longer viable and development must move to a development build immediately.**
Every one of the following requires it, and none of them is optional in this design:

Liquid Glass tab bar · `expo-glass-effect` · Live Activities and Dynamic Island · Sign in with
Apple · Keychain entitlements · on-device speech recognition · RevenueCat.

This is a half-day of setup that has been deferred for months and is now gating six features.
Do it first: `npx expo run:ios`, then EAS Build for distribution.

### 19.2 Versions

- **Expo SDK:** upgrade to the current stable release before starting the redesign. SDK 54 is
  where `NativeTabs` was introduced in alpha; later SDKs stabilise its API (notably
  `NativeTabs.Trigger.Icon`) and ship fixes to glass rendering. Starting a large redesign on the
  oldest SDK that supports the features is the wrong end of the trade.
- **New Architecture: mandatory.** Reanimated 4 requires it. Reanimated 3 is not an acceptable
  fallback — the motion system in §7 assumes v4.
- React Native 0.81+, React 19, TypeScript `strict`, Expo Router.

### 19.3 Libraries

| Need | Choice | Note |
|---|---|---|
| Navigation | `expo-router` + `unstable-native-tabs` | System tab bar, §5.2 |
| Animation | `react-native-reanimated` v4 + `react-native-worklets` | UI thread only |
| Glass | `expo-glass-effect`, `expo-blur` fallback | §6.9 |
| Icons | `expo-symbols` (SF Symbols) | No custom set |
| Fonts | `expo-font` (JetBrains Mono) | SF Pro is system |
| DB | `expo-sqlite` | Source of truth |
| Backend | `@supabase/supabase-js` | Postgres, Auth, Edge Functions |
| State | `zustand` | One store per domain, no global god-store |
| Haptics | `expo-haptics` | §7.4 |
| Charts | `react-native-svg`, hand-drawn | No chart library — ours are four shapes |
| Live Activity | `expo-live-activity` | §8.7 |
| Voice | `expo-speech-recognition` | On-device only |
| Billing | `react-native-purchases` (RevenueCat) | §14.4 |
| Share image | `react-native-view-shot` | §15.2 |

**Do not add** a UI kit, a component library, NativeWind, a chart library, an animation
library other than Reanimated, or an analytics SDK. Every one of them would import a design
opinion that conflicts with §6.

### 19.4 Environment

`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Nothing else is public. The model
API key exists only as a Supabase secret. A key in the client is a build-blocking failure.

### 19.5 Project structure

```
src/app/            _layout · index (dispatcher) · (tabs)/{index,lifts,progress,you}
                    onboarding/ · paywall · sign-in · session/[date] · lift/[slug]
src/components/     composer/ · card/ · glass · primitives · charts · sheets/
src/lib/db/         schema · queries · migrations · insights
src/lib/parse/      client · anchor · apply · overlay · correct · types
src/lib/predict/    engine · split · adherence · data · explain
src/lib/sync/       push · pull · conflict
src/lib/theme/      color · type · space · shape · elevation · motion · scale
src/lib/import/     hevy · strong · generic
supabase/functions/ parse-workout (prompt.ts = single source of truth) · explain-prediction
supabase/migrations/ · supabase/tests/
```

---

## 20. Components

Build these once, in `src/components/primitives.tsx`, and never inline an alternative.

| Component | Purpose | Notes |
|---|---|---|
| `Screen` | Safe areas, theme background, scroll behaviour | Handles the tab-bar underlap |
| `Card` | `surface`, `radius.lg`, optional `elevation` | Lifted cards soften their border |
| `ExerciseCard` | The four-zone card | §8.3 — the most important component in the app |
| `DataValue` | A mono, tabular number with a unit | Every load, rep, distance, volume |
| `Tag` | `micro` uppercase in a hairline capsule | `RECORDED` · `PR` · `WARM-UP` |
| `Stepper` | Inline ± with long-press acceleration | §8.4 |
| `StatTile` | Big mono number + `micro` label + delta | Progress zoom 1 |
| `Sparkline` | 12-week monochrome line, no axes | Lists |
| `Chart` | Bars or line, `ink` on `rule`, no library | Progress, Lift detail |
| `Segmented` | `surfaceHigh` track, `surface` thumb | Calendar/Sessions/Records |
| `Sheet` | Detents, grabber, `radius.xxl` | All modals |
| `Glass` | The only glass constructor | §6.9 |
| `PrimaryButton` | 52pt ink-fill capsule | One per screen, maximum |
| `Field` | Text input, no radius on the composer | |
| `EmptyState` | Headline + one action | §12.1 |

Component rules:
- No component takes a `color` prop. Colour comes from semantics (`tone="muted"`), never from
  the call site.
- No component takes a `style` prop that can override spacing tokens.
- Every component that renders a number uses `DataValue`. No exceptions — this is how the type
  contract in §6.5 is enforced mechanically rather than by discipline.

---

## 21. Words

Copy is design material. The same care goes into a caption as into a corner radius.

**Rules**

- Sentence case everywhere. Never Title Case, never ALL CAPS except `micro` tags.
- Name things by what the user controls: *"smallest plate,"* not *"increment configuration."*
- A button says exactly what happens, and the same word appears afterwards: `Finish` produces
  *Recorded*, not *Saved*.
- Active voice. Present tense. No filler.
- Numbers are always specific. *"Up 2.5 kg from 21 July"* beats *"You're improving!"*
- Errors say what happened and what to do. They never apologise and they are never vague.
- Empty screens invite an action; they never report a lack.
- **Never say "AI."** The app reads, understands, computes. The mechanism is not the promise.

**Calibration**

| Never | Instead |
|---|---|
| "Great job! 💪 You crushed it!" | "5 exercises · 12,480 kg · 1 record" |
| "Oops! Something went wrong." | "Not synced yet — everything is saved on this phone." |
| "AI-powered workout suggestions" | "Your next target, from your own sets" |
| "You haven't trained in 5 days!" | *nothing* |
| "No data available" | "Two more sessions and there's something to show here." |
| "Log your workout" | "Write your training" |
| "Don't lose your 6-week streak!" | *nothing* |

---

## 22. Build order

Roughly fourteen weeks at 20–30 hours. Each phase ends shippable; none of them ends with a
half-migrated app.

**Phase 0 · Platform (≈1 week).** Development build. New Architecture. SDK upgrade. Reanimated
4. Native tabs skeleton with the four routes. Nothing visual — this is the foundation and it
is the most-deferred work in the project.

**Phase 1 · The look and the composer (≈3 weeks).** Theme tokens, both themes, the type
system with JetBrains Mono, spacing, shape, elevation, motion primitives. `ExerciseCard`
end-to-end. The Today screen: composer, cards, accessory bar, session summary, all empty
states. This is the app; everything after it is support.

**Phase 2 · The parser (≈2 weeks).** Eval set to 150 labelled lines with every group in §9.3
represented and ≥30 Slovenian. Confidence surfacing (§6.4). The repair path: inline steppers,
repair sheet, alias overrides. Personal vocabulary in the prompt suffix.
*Gate: eval passes at ≥97% and CI blocks regressions.*

**Phase 3 · The Coach (≈1.5 weeks).** Inline targets in cards. Effort-creep deload. Adherence
settlement and suppression. The Coach's own record on the Lift detail.

**Phase 4 · Lifts and Progress (≈2 weeks).** Lift list and detail with the history table and
e1RM chart. Progress with three zoom levels, the calendar, records, and the weekly review card.

**Phase 5 · Onboarding, paywall, billing (≈2 weeks).** All sixteen screens with real copy. The
live parse demo must run against the real prompt. RevenueCat wired, one-month trial, monthly
anchoring.
*Gate: a cold install reaches "trial started" in under three minutes.*

**Phase 6 · The gym (≈2 weeks).** Rest timer with Live Activity and Dynamic Island. Voice
dictation. Plate maths. Share card. The three notifications. Import.

**Phase 7 · Ship (≈1.5 weeks).** Accessibility audit against §17 in full. Deuteranopia pass.
Dynamic Type pass at `accessibilityLarge`. Reduce Motion and Reduce Transparency passes.
Offline pass in airplane mode. App Store assets, screenshots built from real sessions, ASO
copy, privacy nutrition labels.

---

## 23. Definition of done

A change is not done until all of these are true. There is no "will fix in polish."

**Every PR**
- `npm run typecheck`, `npm test`, `npm run lint` pass.
- `npx expo export --platform ios` bundles.
- No colour literal, no font-size literal, no spacing literal outside `src/lib/theme/`.
- No `console.log` of user text, anywhere, under any condition.

**Every screen**
- Empty, loading, error, offline, and lapsed states all designed and implemented (§12).
- Works at `accessibilityLarge` without truncating a number.
- Works with Reduce Motion and Reduce Transparency enabled.
- Every touch target ≥ 44×44.
- One primary action, in the largest type on the screen.
- Works in both themes, verified for contrast.

**Every parser change**
- `PARSE_VERSION` bumped.
- `npm run eval` passes with **zero regressions**, not merely a higher average.
- New cases added for whatever prompted the change.

**Every release**
- Airplane-mode session, start to finish, on a real device.
- Cold install → trial started, timed.
- A session logged one-handed while walking. If it can't be done, the composer is not finished.

---

## 24. What Recore will never be

Writing this down is a feature. Every item below has been considered and rejected, and each
rejection is what makes room for the parts that matter.

- **A social network.** No feed, friends, following, leaderboards, or challenges.
- **A programme generator.** We never tell someone what to train, only what to beat. The Coach
  progresses what the user already chose.
- **An exercise library.** No animations, no anatomy diagrams, no form videos. Your vocabulary
  is the library.
- **A chat interface.** No bubbles, no assistant persona, no conversation. Ever.
- **A nutrition tracker.** Adjacent, tempting, and a different product.
- **A gamified app.** No XP, levels, badges, rings, or daily goals.
- **A free app.** Hard paywall, and the trade-off is accepted knowingly.
- **A cross-platform-first app.** iOS is the design target; Android follows and is allowed to
  look like Android.
- **A general fitness app.** Serious lifters and hybrid athletes. Everyone else is someone
  else's user, and letting them go is the reason this can be excellent.

---

## Appendix A — Change log from v2

| v2 | v3 | Why |
|---|---|---|
| Single-screen app, no tabs | Four native tabs, Liquid Glass | Depth existed but was unreachable |
| Light theme only | Dark-first, both themes | Gyms are dark; the competition is dark |
| Monochrome + green on planned | Graphite/chalk + ember on planned | Same discipline, an identity instead of an absence |
| Predictor removed from UI | Coach returns inside the card | The retention loop cannot be dormant |
| Ghost plan card | Inline target on the named exercise | Appears when the decision is made, not before |
| Receipt mode heuristic | Summary on every finished session | Unpredictable UI is worse than plain UI |
| Streak = days | Streak = weeks vs the user's own target | Daily streaks punish rest days |
| 9 onboarding steps | 16, with payoffs after every question | Questions without payoffs feel like a form |
| 7-day trial | 1-month trial | 42.5% vs 37.4% trial-to-paid by length |
| "$59.99/year" | "$5.00/month, billed annually" | ~+30% trial starts, same price |
| No shadows → one shadow | Two, both ink-family | Calm core, rich edges |
| Expo Go | Development build, mandatory | Six features were blocked on it |
| No emoji, quiet tone | Unchanged | It was right |
| `raw_text` is truth | Unchanged | The most valuable decision in the project |
| Eval harness gates deploys | Unchanged, target raised to 150 cases | The flywheel |

## Appendix B — Open questions for the owner

Four decisions this document made that deserve an explicit yes or no:

1. **§0.1** — free text stays the primary input; taps are the repair path. Everything else
   follows from this.
2. **§10.4** — the Coach returns to the interface, inside the card rather than as a plan card.
3. **§15.3** — the streak counts weeks against the user's own target, not consecutive days.
4. **§14.2** — the trial goes from seven days to one month.