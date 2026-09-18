# The share card — research and design proposal

**17 September 2026 · a proposal, not a ruling. Nothing here has shipped.**

Four story-format cards (1080 × 1920, rendered at 2×) that turn a recorded session,
week, month or personal record into something a person can post. The PNGs beside
this file are the design; `src/` regenerates them.

---

## 1. What exists today

Three share surfaces are already written, and **all three are unreachable**:

| File | Share mechanism | Reached from |
|---|---|---|
| `src/components/session-receipt.tsx` | `captureRef` of the receipt → `Sharing.shareAsync` | nothing |
| `src/components/week-recap-card.tsx` | `captureRef` of the recap card | nothing |
| `src/components/session-summary-sheet.tsx` | `captureRef` of the sheet | `summary-pill.tsx`, itself unreachable since 18 Aug 2026 |

So the feature does not exist in the shipped app, and the dependencies it needs
(`react-native-view-shot` 5.1.0, `expo-sharing` ~57, `react-native-svg`,
`expo-linear-gradient`) are all already installed.

All three share the same design flaw: **they capture an in-app card.** That
produces a screen-shaped image — roughly 3:4, in app chrome, with a "Share card"
button sometimes still in frame. Dropped into a 9:16 story it is letterboxed
with whatever colour Instagram picks. A share card has to be *designed for the
format it lands in*, which is what this proposal does.

## 2. What the competition ships (Appllama, 8 screens studied)

| App | Revenue/mo | What their card says |
|---|---|---|
| Strong | $500K | ⭐ confetti + "Great Job!" + "That's your 1st workout!" · duration / volume / PR count |
| JEFIT | $100K | "**0 lbs** lifted, that's like **0 Elephants**" · duration / exercises / records · 5 card styles in a picker, Stories first |
| STNDRD | $300K | volume as hero, then exercises / sets / reps · dark |
| Lyfta | $300K | insight grid: split, PRs, volume-over-time, "Strength Level" |
| Pacer | — | dark card, circular gauge, day strip, big number |

Three conclusions:

1. **The single best idea in the set is JEFIT's.** Nobody has intuition for
   "12,450 kg". Giving the number a *body* is what makes it postable.
2. **JEFIT also shows the failure mode**: it ships "0 lbs lifted, that's like
   0 Elephants" on an empty session. A comparison from a stock joke list has no
   floor.
3. **Everyone celebrates and nobody states.** Stars, confetti, "Great Job!".
   CLAUDE.md §6 bans all of it, which is not a handicap here — it is the
   differentiation. On a feed of dark-mode neon gym screenshots, warm paper and
   black ink is what stops the scroll.

## 3. What is actually worth seeing

Ranked by how likely a person is to post it:

1. **A personal record.** Specific, earned, and the only one someone *wants* to
   say out loud. `getAllTimePRs()` — and it must keep `isBaseline` out, or a
   first-ever lift ships as a "record".
2. **Consistency.** The month grid is the most format-native artifact in
   fitness (the contribution-graph shape), the cheapest to compute
   (`getLoggedDayKeys`), and the one that reads at thumbnail size.
3. **Tonnage, but only with a body.** Alone it is trivia.
4. **The session itself** — the lifts, printed. No competitor card carries the
   actual lines, and the raw note is the whole premise of this product.

### The comparison line, done honestly

JEFIT's elephants are a fabrication-adjacent gimmick. Recore's version draws the
comparison **from the person's own record**, so it cannot invent anything and it
degrades to silence:

- "Your heaviest session on record. The one it passed, in June, was 7,010 kg."
- "The 110 kg had stood since 4 May."
- "Your steadiest month since you started in March."
- With no history to compare against: **print nothing.** No floor case, no
  "0 Elephants".

## 4. The four cards

| | Card | Hero | Data it needs |
|---|---|---|---|
| A | `a-session.png` | session volume | `ReceiptData` · `workouts.created_at→updated_at` · `getAllTimePRs` · `getStatsSummary` · `getReflection` |
| B | `b-week.png` | week volume + 7 bars | `getStatsSummary()` alone |
| C | `c-month.png` | days trained + grid | `getLoggedDayKeys` · `getAllTimePRs` · `buildPeriod` |
| D | `d-lift.png` | the PR | `getAllTimePRs` · `getE1rmSeries` |

**C is the strongest** and the cheapest to build. **D is the one people post.**
A is the most Recore-specific — it prints the record and quotes the check-in.

### Rules the cards keep

- Canvas, ink ladder and the one blue are the live `color.ts` values verbatim
  (`#F4F5EF` / `#171914` / `#007AFF`), not the skill doc's — the two have drifted.
- Number and unit are typographically two things; thousands use `groupThousands`'
  comma; sets use `setsLineText`'s voice (`100 kg × 5·5·5`), not a re-invented one.
- The PR label is the app's neutral outlined label. No colour, no badge, no trophy.
- The blue is spent **once per card** — the PR dot on C, the e1RM line on D — and
  never alone: the legend names the dot in words.
- Bare rows, no cards, no hairline between two records.
- No confetti, no praise, no streak, no emoji, no green (`signal` is planned-only
  and nothing here is planned).
- **The grain is the one thing an app surface may not have.** A share card is an
  exported artifact, not chrome, so it carries paper tooth at 5.5%. If that reads
  as a liberty, delete `.grain` — nothing else depends on it.
- Content sits between 228 px and 1704 px so Instagram's profile row and reply
  bar do not cover it.

## 5. Open questions for the owner

1. **Which cards ship**, and is the card a *picker* (JEFIT's pattern — five
   styles, tap to choose) or one card per surface?
2. **The grain** — keep or cut?
3. **Card B's "in 3 h 41 min"** is a sum of per-session spans, and
   `session-receipt.tsx` only trusts a span between 10 and 360 minutes. Summing
   partly-untrusted spans needs a rule, or the line goes.
4. **A 4:5 feed variant** (1080 × 1350) is the same layout with a shorter middle
   band. Worth it, or story-only?
5. Where does it open from — the receipt, Progress, You, or all three?

## 6. Regenerating

```sh
cd docs/share-card/src
node build.mjs                                   # HTML from the data
swift shot.swift a-session.html ../a-session.png 1080 1920
```

`shot.swift` renders through WebKit at 2× (2160 × 3840). Chrome's headless mode
is sandboxed off on this machine, which is why WebKit rather than
`--screenshot`. These are **design mocks with example data** — the real card is
a React Native component captured with `react-native-view-shot`, and building it
is the next step, not part of this proposal.
