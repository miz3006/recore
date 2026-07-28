# §11 — Onboarding, expanded

**Drop-in replacement for §11 of CLAUDE.md v4 · researched 28 July 2026**

This changes a standing ruling in §0.1 ("Nine onboarding steps"). Record it in Appendix C
before merging, or do not merge it.

---

## Why longer, and the condition attached

The 2026 benchmark data supports a longer flow, but every source attaches the same condition,
and it is the condition that matters more than the length:

- Personalised onboarding is worth roughly **+8.5% trial starts and +17% paid conversion**
  (higher in North America). It is one of the highest-leverage surfaces in a subscription app.
- The single most-cited failure is **asking personalisation questions that change nothing.** If
  the post-onboarding experience is identical for every user, the questions are decorative, and
  the user reads them as a toll booth.
- Five to seven questions is normal in health and fitness **specifically because each answer
  visibly shapes what the user gets.** The count is not the licence; the payoff is.
- Mirroring an onboarding answer in the paywall headline outperforms most layout experiments.
  Plain string replacement is enough. A headline that names something the user built beats one
  that names something being sold.
- Bounded flows ("step 4 of 13") complete better than unbounded ones, and every answer must be
  editable by going back.
- Explaining *why* a question is asked measurably improves completion in health apps.

So: more screens, on one condition. **Every question in this flow changes a later screen, a
default in the engine, or a line on the paywall. A question that does not is deleted, not kept
for analytics.** The one deliberate exception is attribution (step 12), which is labelled as
telemetry rather than dressed up as personalisation.

Counterweight, recorded honestly: at least one published case removed a loading beat and saw
trial conversion rise. Step 13 survives only because it does real work. Instrument every step
and be prepared to delete two of them.

---

## The flow — thirteen steps, account still last

```
onboarding (13 steps) → paywall → sign-in → the app
```

Persistent rules: **Back on every screen**, and every answer editable in place. A progress bar
from step 2, full at 13. One decision per screen. Every answer persists to the meta KV
immediately; a relaunch resumes at `pref_ob_step`. **No permission prompt anywhere in this
flow** — the microphone asks when the microphone is tapped. Emoji are permitted here and only
here, one per option, per §5.7.

| # | Screen | New? | What it changes |
|---|---|---|---|
| 1 | Welcome — the settling specimen | — | nothing; it is the claim |
| 2 | **What this replaces** | **new** | nothing; it is the explanation |
| 3 | Name (optional) | — | how later screens address them |
| 4 | Training focus | — | rep-range width in the engine |
| 5 | **What that focus changes** | **new** | payoff for 4 |
| 6 | Current tracker | — | the import branch |
| 7 | **The objection answered** | **new** | payoff for 6 |
| 8 | Writing language | — | parser vocabulary + the demo |
| 9 | How it works — live parse | — | payoff for 8 |
| 10 | **The lift you care about most** | **new** | the demo line, the ready ghost, Lifts' first row |
| 11 | Sessions in a normal week | **new** | the streak target and the weekly line on Progress |
| 12 | Units + smallest increment | — | `roundToPlate` |
| 13 | **How did you find Recore** | **new** | telemetry, honestly labelled |
| 14 | Building — the working beat | — | seeds exercises, applies increment, prepares import, warms the prompt cache |
| 15 | Ready | — | echoes every answer; hands off to the paywall |

Thirteen decisions across fifteen screens. Two of the fifteen ask nothing.

---

## The new screens

### 2 · What this replaces

The screen the owner asked for: an explanation, not a feature list. It follows the specimen so
the user has already seen the thing being explained.

Two columns, mono, no illustration:

```
IN A FORM APP                    HERE

search "bench press"             bench 3x8 80kg
tap add exercise
tap +, set 1, weight, reps
tap +, set 2, weight, reps
tap +, set 3, weight, reps
tap finish

six taps a set                   one line a session
```

One line under it: *no picker, no routine builder, no plus button.* Nothing else. This screen
is the only place in the product where a competitor's shape is drawn, and it is drawn without
naming one.

### 5 · What that focus changes

The payoff for step 4, and it does real work: focus sets the default rep-range width the
engine reads (§8.1). Tailored per answer, shown as a real card in the app's own visual
language.

Hypertrophy:

> **Reps first, then load.**
> Fill the top of your range on every set and Recore adds weight. Until then it asks for one
> more rep.
>
> ```
> Bench Press    82.5 kg · 8 · 8 · 7
> next           82.5 kg × 8
> ```

Strength swaps the rule and the numbers (`+2.5 kg` once every set hits the top). Hybrid adds
one line: runs, carries and holds are recorded as themselves, not as broken lifting data.

### 7 · The objection answered

The payoff for step 6, tailored per tracker. This is the screen that earns the import.

- **Hevy / Strong** → *Everything it recorded. None of the tapping.* Your history comes over in
  the first minute and nothing is lost. Preselects import at step 14.
- **Notes or paper** → *Your notes, understood.* The same freedom to write anything, except it
  adds up, it charts, and it remembers what you lifted last time.
- **A spreadsheet** → *The columns fill themselves.*
- **Nothing yet** → *Start with one line.*

### 10 · The lift you care about most

The most personal question in the flow and the cheapest to honour. Free text with four
suggestions (bench · squat · deadlift · something else), resolved through the real
`findExerciseByName`, never creating a row.

It changes three things, all visible:

1. Step 9's demo uses that lift instead of a generic one.
2. The ready screen's ghost is computed for that lift where history allows it.
3. It seeds `pref_primary_lift`, which puts that exercise first in Lifts on the first open.

If the name does not resolve, the app says nothing and moves on — §1.1 invariant 6 applies to
onboarding too.

### 11 · Sessions in a normal week

`2 / 3 / 4 / 5 / 6+`. The only input to the streak, and the weekly target line on Progress.

Caption, and it is doing work: *pick what you actually do, not what you'd like to do. You can
change it any week.* A target the user inflates here is a target they fail in week two, and a
failed target is the "lost motivation" churn reason arriving early.

**This screen is blocked on §16.2.** If the streak keeps counting consecutive days, this
question changes nothing and must not ship — it becomes exactly the decorative question the
research warns about. Resolve the streak's unit first.

### 13 · How did you find Recore

`App Store search · a friend · TikTok / Instagram / YouTube · a search engine · somewhere else`

Not personalisation, and it is not dressed as personalisation. It is marketing telemetry, and
with ASO-first distribution and a small Search Ads budget it is the only attribution signal
that survives SKAdNetwork. Placed at 13 so it does not interrupt the value sequence. If
step-drop data later shows people leaving here, move it after the paywall rather than deleting
it.

---

## What this changes outside §11

**The paywall headline mirrors an answer.** This is the highest-value finding in the research
and it costs a string interpolation. The first line of `paywall.tsx` is computed, in priority
order:

1. Imported → the real numbers now on the device: `412 sessions · 61 exercises · 14 months`.
2. A primary lift named → *Your bench, from here on, in one line a session.*
3. Neither → the exercises the user's own demo line just produced.

Never a claim about Recore. Always a statement about what the user already has. This replaces
the deleted social proof (§12.1) rather than leaving a hole.

**Instrumentation.** `onboarding_step_reached` already exists and is now load-bearing: record
the last step reached for every install, and read it weekly. A step that loses more than ~10%
of the people who reach it is a step to cut, not to redesign. Two of the five new screens are
expected to die this way, and that is the flow working.

**§0.1 and Appendix C.** The nine-step ruling is superseded. Record the date and the reason.
