# CLAUDE.md — Recore agent guide

**Version 5.1 · 29 July 2026 · Supersedes V5 and V4 wherever they conflict.**

Recore is an iOS-first, paid training companion for people who want to see and understand their
progress. Android comes after the iOS product has proven retention and purchase flow. It is a
calm, personal record that gets more useful as a person trains — not a generic AI fitness app.

---

## 1. Authority and reading order

| Document | Role |
|---|---|
| **This file** | Operating rules, invariants, AI boundary, gates, build order. Always in context. |
| **docs/product-direction.md** | The V5.1 product and experience authority: funnel, paywall, onboarding, visual language, motion, AI experience, Progress, measurement. |
| **docs/implementation-status.md** | What is actually live. Update it in the same change as any feature work. |
| **V4 document** | Repository inventory, data guarantees, and test gates only. Not a product authority. |

When code, V4, and V5.1 disagree: implement V5.1, then update implementation-status in the same
change. Do not treat this file or the product direction as a claim that a feature already exists
in code — verify route, component, state, billing behaviour, and tests before calling anything
complete.

**Read the product direction section that matches your task before touching that surface:**

| Working on… | Read first |
|---|---|
| Billing, paywall, trial, lapsed state | product-direction §2, §6 |
| Onboarding | §5 |
| First-open walkthrough | §7 |
| Today / reflections | §8 |
| Next brief or any AI prompt/guard | §9 (all of it) |
| Progress charts | §10 |
| Profile, calendar, import | §11 |
| Copy, notifications, privacy | §12 |
| Analytics events | §13 |

---

## 2. Working rules

1. **Keep the record trustworthy.** Raw workout text is the source of truth. The app works
   offline and never blocks a keystroke or workout finish on a model, sync, purchase, or
   entitlement check.
2. **Personalise only from chosen information.** Onboarding answers, training history, and
   optional reflections may change the experience. They must never create fake history,
   achievements, testimonials, review scores, or unsupported health conclusions.
3. **A model writes language, never facts.** Loads, sets, volume, trial dates, prices, charts,
   and progression calculations come from code or stored records. The model turns permitted
   facts into useful copy and may choose a bounded check-in prompt. It never invents a number,
   chooses a plan, diagnoses a condition, or judges a food choice.
4. **Motion is allowed when it makes cause and effect clearer.** Motion that fills time or
   competes with logging is banned. Every moving element honours Reduce Motion.
5. **The subscription is real before release.** No hard paywall, trial clock, price, Restore
   Purchases, or cancellation language ships until the store integration keeps that promise.
6. **No generic praise.** Flame badges, XP, levels, streak guilt, countdown pressure, and vague
   "you are improving" copy are not Recore. Warmth is earned with specific evidence.
7. **Code, comments, and product documents are English. Reply to the owner in Slovenian.**
8. **Ask before adding a new rule to this file or the product direction.** Propose the change,
   get the owner's yes, then write it with a dated entry in the change log.

## 3. Technical invariants

- Raw workout text is the source of truth; structured data is a rebuildable projection.
- Training input is free text first. Touch controls repair, inspect, or enrich it; they never
  replace writing as the primary path.
- The AI key stays server-side. The client receives neither the key nor hidden reasoning.
- Local-first and usable offline; sync is never in the way of a workout.
- Export remains complete and ungated even after a subscription lapses.
- 44 pt targets, Dynamic Type, VoiceOver, contrast, and Reduce Motion are non-negotiable.
- No fabricated reviews, ratings, user counts, testimonials, or personalisation — anywhere,
  including placeholders. A hardcoded fake testimonial is a release blocker, not a TODO.

## 4. AI boundary (summary — full rules in product direction §9)

The model may rewrite a deterministic fact bundle into natural copy in the user's language and
select one check-in prompt from an approved set. It may not create or alter any number, date,
chart, plan, or subscription fact; prescribe programmes; diagnose anything; claim causation from
a reflection; or use hype. Every response passes a guard that validates numbers, names, dates,
and claims against source facts. On any missing, late, or rejected response, show the
deterministic composed brief instantly — no model state may delay a screen. Guard rejections are
counted and alarmed (§9.3); prompt or guard changes require the owner-run evaluation (§9.4).

## 5. Definition of done

A V5.1 feature is done only when it:

1. preserves local-first writing and the source-of-truth record;
2. works with empty history, imported history, offline use, long text, Dynamic Type, VoiceOver,
   and Reduce Motion;
3. gives a truthful loading, error, and entitlement outcome without blocking a workout;
4. contains no fabricated personalisation, unsupported health claim, or unverified billing copy;
5. passes typecheck, tests, lint, and the iOS Expo export;
6. emits its analytics events from §13 with the documented names; and
7. updates implementation-status so a future agent can separate intended experience from what is
   live.

For any prompt, response schema, model guard, or AI-summary change, the owner-run evaluation
(§9.4) is also required. Until it has run, state plainly that the change is not fully verified.

## 6. Implementation order

Do not redesign every surface in one change. Build and verify in this order:

1. Real store billing, entitlement state, account attachment, restore, cancel/manage path,
   truthful trial lifecycle, and the lapsed-state screen (§2.2).
2. Onboarding data model and the fourteen-screen personalised funnel, including the
   tracker-import fast path (§2.1).
3. First-open spotlight, Today reflection capture, and export/deletion coverage for reflections.
4. Guarded Next briefing with reflection context, deterministic fallback, and guard monitoring.
5. Progress visual update and the coloured, accessible chart system.
6. Weekly recap notification (§12.1).
7. V5.1 motion pass and device QA on iOS, including Reduce Motion.

No step authorises an unrelated redesign. Each step updates implementation-status and passes the
repository gates before the next begins.

## 7. Change log

- **5.1 (29 Jul 2026):** Split the monolithic V5 file into this agent guide plus
  docs/product-direction.md. Added: lapsed-state screen spec (§2.2), tracker-import fast path in
  the funnel (§2.1), honest annual preselection rules (§6), onboarding screen-removal criteria
  (§5), guard monitoring thresholds (§9.3), owner-run evaluation definition (§9.4), weekly recap
  as the single re-engagement mechanism (§12.1), measurable targets and action thresholds (§13),
  rule 8 (ask before adding rules), and analytics as part of definition of done.
- **5 (29 Jul 2026):** Product direction superseding V4 for intent; V4 demoted to repository
  inventory.
