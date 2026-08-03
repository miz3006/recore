# Recore product direction

**Version 5.1 · 29 July 2026 · Read together with CLAUDE.md, which holds the working rules,
technical invariants, definition of done, and implementation order.**

The goal is not a generic AI fitness app. Recore should feel like a calm, personal record that
gets more useful as a person trains. It knows the athlete's context, shows their evidence, and
asks for the small missing detail that makes the next observation more useful.

---

## 1. Product promise

**Write your training. See what is changing. Know what to pay attention to next.**

Recore begins with the athlete's context, then improves from real sessions and short
reflections. It serves people who lift for strength, muscle, general fitness, sport, or a hybrid
of these. It is especially valuable to a lifter who wants a clear record of progression without
a rigid workout-builder flow.

Recore is not a social network, leaderboard, streak game, medical or nutrition diagnosis product,
programme generator, chat interface, or free app with a hidden upgrade path.

---

## 2. Commercial model: a real hard paywall

Recore is a subscription product from its first release.

- A new eligible subscriber receives **one seven-day free trial**.
- The paywall offers **monthly** and **annual** plans. Selecting either plan starts the same
  seven-day trial; a person is charged only after that period unless they cancel through
  platform subscription controls.
- The annual plan may be preselected, under the honesty rules in §6. Most sustainable revenue in
  this category is annual; preselection is allowed, deception is not.
- The trial attaches to an account. Account creation or sign-in follows plan selection and
  happens before the trial can start.
- The paywall is hard: once the trial ends, logging and personal coaching require a valid
  entitlement.
- The price, renewal date, trial end date, legal links, Restore Purchases, and Manage
  Subscription are always truthful and reachable. Never use false scarcity, misleading
  preselection, or a close control that goes nowhere.

### 2.1 Funnel order

```
personalised onboarding (14 screens) → plan selection / paywall → account → trial start →
[tracker users: import fast path] → first-open walkthrough → Today
```

The paywall continues the individual setup, not a generic ad. Its headline reflects a real
answer, such as the chosen focus, sport, favourite lift, or training rhythm. It never implies an
outcome Recore cannot prove.

**Tracker-import fast path.** A person who said on screen 11 that they use Strong, Hevy, or
another tracker gets import as the default first action immediately after trial start, before
the walkthrough. Rationale: an empty history means an empty Progress tab on the day the trial
decision is made. Imported history is the single strongest lever on trial-to-paid conversion,
so it must not be buried in settings for these users. Skipping import is one tap and never
punished; the walkthrough then proceeds normally. Users who track nothing skip this step
entirely.

### 2.2 Lapsed state

The lapsed state is a designed screen, not an error. When a trial or subscription ends:

- The record remains fully readable: every session, chart, and reflection stays open.
- Export remains complete and ungated.
- The writing surface is replaced by a calm, specific explanation of what is closed: writing new
  sessions and the personal brief. Show the person's own real numbers — for example, the count
  of recorded sessions and the date range — never a guilt message or countdown.
- One primary action resumes the subscription; Restore Purchases and Manage Subscription are
  directly reachable.
- Before entitlement actually lapses (final trial day), the app may show one honest notice of
  the first charge date and what lapsing changes. One notice, no repetition, no dark pattern.

---

## 3. Navigation

The four-tab structure remains:

| Tab | Job |
|---|---|
| **Today** | Write, review, and finish today's training. Add a short optional reflection. |
| **Next** | Personal training brief, relevant observations, and the next useful check-in. |
| **Progress** | Colourful but evidence-led lift and training-progress charts. |
| **You** | Profile, training context, calendar/history, subscription, imports, exports, settings. |

Lifts remains a push from Progress and Today. It is the detailed record for one movement, not a
fifth competing tab.

---

## 4. Visual direction

### 4.1 Feeling

The app is warm, light, composed, and distinctly iOS-native. It should feel personal and
considered, not sterile, loud, gamer-like, or like a generic chatbot. Generous paper-like space,
clear typography, tactile selection states, modest rounded surfaces, and a small number of
intentional colours make it friendly without turning the record into a toy.

Use system typography. Let the athlete's words remain visually primary. Numbers, labels, and
charts must scan easily at a glance.

### 4.2 Colour

Keep the warm-paper light theme. **Recore blue (#007AFF) is a visible product accent**, not a
colour confined to a calendar. It may be used for selected onboarding choices, interactive
focus, active controls, walkthrough emphasis, and recorded-progress charts. It is not a reward
colour.

| Colour role | Meaning and permitted use |
|---|---|
| Ink / warm neutrals | Copy, structure, primary actions, historical values, most UI chrome. |
| Recore blue | Selected interaction, completed/trained state, recorded historical progress in charts. |
| Planned green | A concrete future prescription only, always with its label and reason. |
| Trend ember | Optional secondary comparison in a chart; never the sole indicator of good or bad. |
| Red | Destructive actions and genuine errors only. |

Charts may use colour. Prefer one clear blue series, a soft blue area or wash when it clarifies
the series, and neutral reference lines. Add a second accent only where the comparison genuinely
has another meaning. Never use a rainbow merely to decorate data, and never make colour the only
way to read a trend.

### 4.3 Motion and physical feedback

Use short, interruptible, iOS-like motion. It must confirm an action, orient the person, or make
a data change legible.

**Allowed and encouraged**

- Slight press-in and release on tappable controls.
- A selected onboarding choice lifting into place with a 160–240 ms settle.
- Directional onboarding transitions: forward arrives from the right; Back from the left.
- A progress rail advancing after an answered question.
- A bottom sheet arriving and dismissing with a controlled, interruptible spring.
- A chart line or bar revealing after data is available, without delaying readings.
- A value updating once when a workout is parsed or completed.
- The first-open spotlight gently focusing the exact target it is explaining.

**Not allowed**

- Autoplaying decoration, looping celebration, bounce cascades, confetti, fake loading, surprise
  movement while someone is typing, or motion that withholds information.
- Layout-property animation or motion that makes a value harder to read.
- More than one celebratory moment per completed session. A PR may receive restrained tactile
  emphasis, never a game-like sequence.

Use shared motion tokens. Under Reduce Motion, content appears in its final position
immediately; no information may disappear with the movement.

---

## 5. Personalised onboarding: 15 illustrated screens

*(Table revised 30 July 2026, owner's yes — the flow shipped as full-bleed illustrated screens;
company and commitment questions were considered and rejected under the removal criterion, and
language + display unit are derived from the device locale instead of asked.)*

Onboarding is a conversation, not a static questionnaire. It has fifteen illustrated screens
and personalises immediately after meaningful answers. Back is available everywhere and all
answers are editable in You after account creation.

Every question must affect a later screen, a default, a summary, a suggested check-in, or a
personalised analytics interpretation. Remove a question that does none of these.

**Screen-removal criterion.** Fifteen is a current design, not a sacred number. Once real
funnel data exists (§13): any single screen that loses more than 8 % of the people who reach it,
and whose answer does not measurably improve trial-to-paid or week-two retention, is removed or
merged in the next release. Personalisation must pay for its friction.

| # | Screen | Input | What it changes |
|---|---|---|---|
| 1 | Welcome | — | Thanks for downloading + the promise: a private training record in your own words. Get started. |
| 2 | Your name | First name, optional | Tone and salutation throughout onboarding, Today, and Next. |
| 3 | Your gender | Female, male, prefer not to say | Illustration variants and wording only. Never a different prescription. |
| 4 | What are you training for? | Strength, muscle, general fitness, both | Focus defaults, example language, progression framing, first Next brief. |
| 5 | Your training experience | New, on and off, experienced | Level of explanation and confidence of early observations. Never used to flatter or judge. |
| 6 | How Recore works | — (lesson) | Explains the written record before any more is asked. |
| 7 | Current tracking method | Strong, Hevy, notes/paper, nowhere | Import explanation and the post-sign-in import fast path (§2.1). Import itself happens only after sign-in. |
| 8 | How do you want training to feel? | Structured, flexible, a bit of both | Composer examples, vocabulary, reflection prompts. Never locks the person into a programme. |
| 9 | Which days do you usually train? | Multi-select day circles | Today/Next rhythm, calendar expectation. Never creates guilt for a missed day. |
| 10 | Your priority movement | Free text, optional | Personalised parser example, first lift to feature in Lifts, chart focus once history exists. |
| 11 | How long do you rest? | 1:00, 1:30, 2:00, 3:00 | The toolbar rest-timer default. |
| 12 | Why progression | — (lesson) | Explains gradual overload — the payoff of the questions around it. |
| 13 | Your body context | Optional typed weight + kg/lb | Baseline display and bodyweight-relative context. Never a calorie target, body-grade, or medical judgement. |
| 14 | Weekly recap? | Yes / no (intent only) | Whether the §12.1 recap is offered. The OS permission is requested later, in context. |
| 15 | Ready for your record | — | Echoes meaningful answers instantly and leads to plan selection. |

### 5.1 Personalisation rules

- After fitness is chosen, gym-specific content may follow. After sport or hybrid, language
  shifts to training load, readiness, and the activity named. Do not show the same gym screens
  to everyone.
- A named priority movement appears naturally in the parsing example and later in Progress once
  evidence exists. Never show a fake progression chart before a session is logged.
- Weight and height are optional and explain their purpose. Skipping them changes nothing
  essential.
- The flow is not a medical intake. Do not ask for diagnoses, injuries, calorie goals, or data
  not required for the first product.
- No permission prompt belongs in onboarding. Request microphone permission only for dictation;
  request notifications only after a real trial begins and their purpose is clear (§12.1).

### 5.2 Presentation

Use a restrained ink progress rail and a clear position marker. Selection rows feel touchable,
with visible selected state, immediate feedback, and room for long labels. Personalised pages
explicitly connect a previous answer to what comes next.

> "Because you train for strength, Recore will focus your first progress view on repeatable
> sets, load, and your own best lifts."

This is useful personalisation. A vague "customising your experience" loading screen is not.

---

## 6. Paywall, account, and trial start

After screen 14, show the hard paywall with two plans and a clear seven-day-trial explanation.
The user picks a plan first. The primary action opens account creation or sign-in; after
successful authentication, complete the store purchase and begin the trial. Do not create an
account before the person understands the offer, and do not mark a trial as started until the
store confirms it.

The paywall contains:

- a personalised, factual headline drawn from onboarding;
- three concrete outcomes: easier logging, visible progression, and personal training context;
- monthly and annual options with real price and renewal text;
- one seven-day trial promise, the first charge date, and concise cancellation explanation;
- Terms, Privacy, Restore Purchases, and Manage Subscription when applicable.

**Honest annual preselection.** Annual may be the default-selected plan when all of the
following hold: both plans are equally visible and equally tappable; the annual price shows its
real total and its true per-month equivalent; the stated saving is arithmetically correct
against the actual monthly price; and switching plans is one tap with no confirmation friction.
If any of these cannot be met, nothing is preselected.

It contains no review stars until real, no testimonials until real, no pseudo-science, no
"AI magic", and no claim that the app will transform someone in seven days.

---

## 7. First open: a short, useful walkthrough

The first signed-in Today screen gets a one-time spotlight walkthrough. It never blocks starting
a workout for long, can always be skipped, and never reappears after Skip or Done. For tracker
users, it runs after the import fast path (§2.1), so the tour can point at real data.

| Step | Target | What it teaches |
|---|---|---|
| 1 | Today's writing surface | Write a workout in ordinary words. This is the fastest way to log. |
| 2 | Finish and check-in | After training, add a few words about energy, fatigue, food/recovery, or anything that mattered. |
| 3 | Next | Find the short personal brief and the one thing worth watching next. |
| 4 | Progress | Review lift and training trends with their underlying sessions. |
| 5 | You / calendar | Find the training calendar, profile context, import, and settings. |

Use a spotlight only on a measurable target. Every step has one sentence. The tour must not
complete a workout, choose a plan, or pretend that the app already knows the person.

---

## 8. Today: the log and reflection

Today remains the centre of the product. The athlete writes training naturally, in their own
language. The parser structures what it understands; unclear text stays as original prose
without punishment or a noisy error.

### 8.1 End-of-session check-in

After a finished workout, invite an optional, compact reflection. It is faster to skip than to
complete and never interrupts saving the session.

Offer a free-text field first, with optional lightweight prompts:

- "How did that feel?"
- "Energy and fatigue?"
- "Recovery or food today?"
- "Anything that affected the session?"

Answers are the athlete's own notes, not a health assessment. They may write in Slovenian,
English, or another language, or skip with no penalty.

The next brief may quote or accurately summarise a recent reflection when it helps: "You marked
low energy in the last two sessions." It must not infer a diagnosis or say a meal, supplement,
injury, or sleep pattern caused the result.

---

## 9. Next: the personal training brief

Next is where Recore feels attentive. It leads with one short, well-designed briefing paragraph,
not a stack of generic status cards. The brief answers, when the record supports it:

- What training happened recently?
- What is improving, repeating, or becoming less consistent?
- Which planned session or lift is relevant next?
- Is there one recovery, energy, or reflection pattern the person themselves reported?
- What is one useful thing to watch or write down next time?

The visual form is a calm editorial card with an understated "YOUR BRIEF" label, clear facts,
and a "Based on your recent sessions" provenance line. It feels personal, not like a chat bubble
or motivational feed.

### 9.1 AI boundary

The model may rewrite and connect a deterministic fact bundle into natural, personalised copy in
the user's language. It may choose one prompt from an approved set if a reflection would add
context. It may not:

- create or alter sets, reps, weights, dates, streaks, charts, subscription facts, or scores;
- prescribe a programme or override deterministic progression logic;
- diagnose injury, overtraining, illness, or nutritional deficiency;
- claim causation from a reflection ("you performed worse because you ate poorly");
- praise, shame, or use exclamation-heavy hype.

Every response passes a guard that validates numbers, names, dates, and claims against source
facts. If the response is missing, late, or rejected, show the deterministic composed brief
instantly. No model error or loading state may delay the screen.

### 9.2 Voice examples

Good:

- "Bench press has held at 80 kg for three sessions while your top-set reps moved from 7 to 8."
- "You logged lower energy after both recent evening sessions. Add a short note after the next
  one if the pattern continues."
- "Your usual Wednesday session is next. The last completed set was 3 × 8 at 80 kg."

Not acceptable:

- "Amazing work, you are crushing it!"
- "Your nutrition is holding you back."
- "You need to train chest tomorrow."

### 9.3 Guard monitoring

The guard is only trustworthy if someone watches it. Count, per app version:

- brief requests, model responses shown, deterministic fallbacks shown, and guard rejections;
- rejection reasons in coarse categories (invented number, wrong date, banned claim, format).

Initial action thresholds, adjustable with data: a 7-day guard rejection rate above **5 %**, or
a fallback rate above **15 %**, is a defect to investigate before any new AI work ships. Log no
raw user text — categories and counts only.

### 9.4 Owner-run evaluation

The evaluation is a versioned case set in the repository (inputs: fact bundles and reflections;
expected properties: required facts present, banned content absent, language correct). It runs
with one documented command and reports pass/fail per case. A prompt, schema, or guard change
passes only when every case passes or the owner explicitly accepts a documented regression. New
failure modes found in production become new cases in the same change that fixes them.

---

## 10. Progress: colourful evidence, not decoration

Progress answers one question: **"Am I progressing, and what is the evidence?"**

The tab combines a compact overview with a card per relevant lift or training dimension:

- a factual overview of recent frequency, consistency, and lift movement;
- time ranges such as 8 weeks, 6 months, and 1 year;
- metrics appropriate to the activity: estimated 1RM, heaviest load, volume, reps at a load, or
  sport/hybrid workload where enough real data exists;
- a blue primary line or step chart with a soft contextual fill, readable axes, and neutral
  prior-best/reference marks;
- coloured but restrained hierarchy, with underlying session, sets, and date one tap away;
- empty states that say what evidence is needed: "Two more sessions of squat and this trend
  becomes useful."

Do not smooth a line between values never lifted. For strength data, use a step shape when a
weight holds across sessions and changes only on a real session. Do not rank lifts by flattery,
frame a deload as failure, or use a red/green chart to judge a person.

The per-lift detail can use a richer blue/ember comparison where it genuinely distinguishes a
current series from historical reference. Data labels and accessible text always carry meaning
without colour.

---

## 11. Profile, calendar, and context

You is the calm place for the athlete's record and controls.

- The calendar shows trained days in blue and opens the real session behind a day.
- The profile makes onboarding context editable: focus, experience, training style, usual days,
  units, body context, and priority movement.
- Preferred training days may frame expected rhythm, but never turn a rest or missed day into a
  broken streak, warning, or guilt message.
- Import remains available here at all times, in addition to the post-sign-in fast path (§2.1),
  because genuine history makes Progress and Next valuable.
- Subscription management, restore, export, privacy, and account deletion are direct and clear.

---

## 12. Copy, privacy, and safety

Recore speaks with calm specificity. The user did the work; the app observed and organised it.

- Use sentence case and plain language.
- Prefer a precise observation over a compliment.
- Explain why a prompt appears when the reason is not obvious.
- Refer to self-reported recovery, energy, and food as context, never as a verdict.
- Do not use "AI" as product marketing. It is acceptable in legal/privacy explanations where
  data-processing truth requires it.
- Emoji may appear sparingly as an onboarding choice label when they improve scanning. They do
  not appear in the log, summaries, charts, paywall, errors, or notifications.

Weight, height, reflections, and preferences are personal data. Store them with the same account
scoping, export, and deletion guarantees as workout records. Explain optional body-context
fields before asking. Include reflection notes in account export and deletion. Do not train a
model on a person's data without separately stated valid consent and policy.

### 12.1 Weekly recap: the single re-engagement mechanism

Recore sends at most one recurring notification: an optional weekly recap, offered (not forced)
after the first finished workout, when its purpose can be stated concretely.

- Content is factual and drawn from the person's own record: sessions completed, one genuine
  observation, and — only if one exists — the next planned rhythm day. Example: "3 sessions this
  week. Bench moved from 7 to 8 reps at 80 kg."
- If the week has no sessions, the recap is either skipped or states a neutral fact ("No
  sessions recorded this week."). Never guilt, never a streak warning, never "we miss you".
- One notification per week, at a user-visible and editable time, off in one tap.
- No other recurring notifications exist. Transactional notices (final trial day, §2.2) are the
  only exception.

---

## 13. Measurement

Measure locally and privacy-consciously, without a third-party tracking SDK:

- onboarding screen reached and completion;
- plan selected, paywall viewed, account created, trial started, purchase or restore state;
- import offered, started, completed, and row count bucket (no lift names);
- first workout written, first workout finished, first reflection added, first Next brief
  viewed, first Progress chart viewed;
- model brief shown, fallback shown, guard rejection categories (§9.3) — never raw user text;
- sessions during the seven-day trial and week-two return, split by imported versus
  empty-history accounts;
- weekly recap enabled, delivered, opened, and disabled.

### 13.1 Initial targets and action thresholds

These are starting points to be replaced by real data, not vanity goals. Each has an owner and a
consequence:

| Metric | Initial target | If below, the next release must address it |
|---|---|---|
| Onboarding completion (screen 1 → 14) | ≥ 70 % | Remove or merge the worst screen per §5. |
| Paywall view → trial start | ≥ 35 % | Rework paywall headline/outcomes before adding features. |
| Import completion among tracker users | ≥ 60 % | Simplify the fast path (§2.1). |
| Trial → paid conversion | ≥ 30 % | Investigate by cohort (imported vs empty) before any redesign. |
| Week-two return among paying users | ≥ 55 % | Improve Next/recap value, not notification volume. |

Use these signals to remove confusing questions and improve value delivery, not to pressure or
manipulate someone into staying subscribed.

---

## 14. Explicit overrides

### 14.1 V4 → V5 (unchanged from V5)

| V4 rule | V5 ruling |
|---|---|
| Blue is only a trained-day mark. | Blue is Recore's visible interaction and recorded-progress accent, semantically documented and accessible. |
| Progress charts are ink-only; colour belongs only in one lift sheet. | Progress charts may use a restrained blue primary series and meaningful secondary accent. |
| Onboarding asks seven questions centred on parser/predictor configuration. | Onboarding has fourteen personalised screens (§5). |
| The Next model only rephrases an existing brief and cannot respond to reflections. | It may personalise a guarded fact bundle with optional reflection context and bounded check-in prompts; it never makes facts, plans, diagnoses, or nutrition judgements. |
| Motion is narrowly limited to the old shared kit. | Purposeful iOS-like microinteractions are approved; decoration and logging-delaying motion remain banned. |
| Monthly plan has no trial. | One seven-day trial regardless of selected plan. |
| The existing code description is the product authority. | The current product direction is the authority for intent; repository inspection determines implementation status. |

### 14.2 V5 → V5.1

| V5 rule or gap | V5.1 ruling |
|---|---|
| One monolithic CLAUDE.md. | Lean CLAUDE.md (rules, invariants, gates) + this product direction. |
| Import "remains after sign-in", listed under You. | Import is a default fast-path step right after trial start for tracker users (§2.1), and stays available in You. |
| Lapsed state described in one sentence. | Lapsed state is a specified screen with real numbers, export, and honest resume path (§2.2). |
| Annual "recommended only when its price advantage is stated plainly". | Annual may be honestly preselected under the four conditions in §6. |
| Fourteen screens with no exit criterion. | Screen-removal criterion tied to drop-off and retention data (§5). |
| Guard failure handling defined, guard health unmonitored. | Rejection/fallback counting with alert thresholds (§9.3). |
| "Owner-run evaluation" named but undefined. | Versioned case set, one command, pass criteria, regression rule (§9.4). |
| No re-engagement mechanism at all. | One optional, factual weekly recap notification (§12.1); nothing else recurring. |
| Measurement listed events without targets. | Initial targets with consequences (§13.1). |
