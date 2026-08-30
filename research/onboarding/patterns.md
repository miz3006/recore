# Cal AI and Gravl, walked screen by screen

Source: Appllama MCP, 27 August 2026. Every screen of both onboarding flows was
listed; the fourteen below were pulled as images and measured. Screen ids are
durable — the media links they came from are not.

| | Cal AI | Gravl |
|---|---|---|
| id | `6480417616` | `6450921637` |
| revenue / mo | $2.0M | $400K |
| downloads | 500K | 10K |
| rating | 4.80 (356,387) | 4.89 (4,532) |
| launched | 2024-04-08 | 2023-08-15 |
| onboarding screens | 38 (+7 welcome, 3 paywall) | 32 (+3 welcome, 2 paywall) |
| annual price | $29.99 (also $19.99 tier) | $79.99 (also $59.99) |
| category rank (US H&F) | 6 | 65 |

Gravl earns **$40 per download per month** against Cal AI's $4. Its subtitle is
"Progressive Overload Tracker" — the closest analogue in the store to what this
app does, and the reason it is worth more attention than its revenue suggests.

## The two flows, in order

**Cal AI (38):** gender · workout frequency · **acquisition source (4/38)** ·
app experience · AI results explainer · height+weight · birth date · coach
question · goal · desired weight · habit insight · loss pace · AI comparison ·
motivation · diet · coaching preference · result graph · profile thank-you ·
Apple Health · calorie goal · rollover · social proof · testimonials ·
reminders · referral code · plan generation start (mascot ring) · **plan
calculation (28)** · plan ready · benefits · **sign in (31)** · email · verify ·
verified · loading · trial offer · trial reminder · **trial checkout (38)**.

**Gravl (32):** welcome · **name (3)** · **"Welcome to Gravl, Morris!" (4)** ·
reason · 3× photo interstitials · goals · experience · Apple Health · gender ·
age · height · weight ×2 · science note · frequency · **split w/ info banner
(19)** · split detail · progress consent · training place · equipment ·
**strength forecast (24)** · notifications · **referral source (26)** · **plan
generation w/ testimonial (27)** · plan preview · subscription offer · **sign
in (30)** · sign up · verification.

## What both do, independently

1. **Auth last.** Cal AI at 31/38, named *Save Progress Sign In*. Gravl at
   30/32. Neither asks for an account before it has shown you something.
2. **Attribution early or late, but always cheap.** Cal AI puts it at 4/38 —
   third question, zero effort, compliance at its peak. Gravl at 26/32.
3. **Name → immediate payoff.** Gravl takes the name at 3 and spends the whole
   of screen 4 on "Welcome to Gravl, Morris!" — logo, name, navy, no chrome, no
   button. It costs a second and it is the only screen in the flow that gives
   something back for free.
4. **Loading is a screen, not a spinner.** Cal AI: a 56 pt percent counter, a
   thin gradient bar, a crossfading caption, and a bulleted checklist with a
   black check landing on the finished row. Gravl: three labelled progress bars
   with their own percentages, then "Trusted by 100,000+ users" over a real
   review card. Both spend ~3 seconds manufacturing effort.
5. **A concrete artifact before the paywall.** Cal AI: four macro rings with an
   editable daily recommendation. Gravl: a strength forecast with a lime % score
   and a bar chart. Neither shows a twelve-week promise as the payoff.
6. **The trial is split across screens.** Cal AI: Trial Offer (36) → Trial
   Reminder (37) → Checkout (38) with a three-node vertical timeline —
   Today / In 2 Days / In 3 Days — before the price cards.

## Measured off Cal AI (393 pt device, `research/calai/*.png`)

| | value |
|---|---|
| body gutter | 24 pt |
| back circle | ~40 pt, light fill, ink arrow |
| progress rail | 4 pt, pill, beside the back circle on one centre line |
| headline | ~34 pt, weight ~800, 2 lines, tight leading |
| option row | 68 pt tall, 12 pt apart, radius ~17 |
| row icon | 37 pt white disc, 16 pt from the leading edge |
| selected row | solid black fill, white label — no border, no check |
| CTA | 56 pt, pill, full width minus gutter |
| CTA disabled | grey fill `#B8B8BE`, label stays white |
| list bottom | faded gradient into a hairline above the pinned CTA |

## What this flow took, and what it did not

Took: auth last, attribution early, name→greeting, loading-as-a-screen,
concrete-artifact-before-paywall, the disabled→awake CTA, the 68/12/24 rhythm,
the inline info banner instead of Gravl's two explainer screens.

Did not take: Cal AI's white/black/`#F4D44E` card world; its four generic
explainers ("Based on Cal AI's historical data…"); its social-proof and
testimonial screens; Gravl's testimonial in the loading dead time. The last two
are the same rule — CLAUDE.md §3 forbids invented reviews, and there are no real
ones yet, so screen 16 carries a factual line instead.
