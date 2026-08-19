# Spec: onboarding polish + Today session flow

## A. Onboarding illustrations — static, centered, correctly sized

1. Remove ALL idle animation from onboarding illustrations. No float, no
   breathe, no scale loop, no `withRepeat` anywhere under the onboarding
   directory. Illustrations are static images.
2. A gentle one-shot entrance (fade + small rise) on screen mount is still
   allowed; it must never loop and never run again on the same screen.
3. Every illustration is optically centered inside the illustration zone.
   Artwork bounding boxes differ, so add an illustration manifest
   (`illustrations.ts`) with per-slug `scale` and `offsetX/offsetY`.
   Inspect each asset's actual content bounds and set values so all
   characters read at the same visual size and sit on the same optical
   center line across the flow. Default scale 1, offsets 0; deviations
   must be justified by the asset.
4. Responsive: the illustration zone is a percentage of available height
   with min/max clamps, verified on iPhone SE (small), 15 (standard) and
   Pro Max (large). No clipping, no overlap with headline, no scroll on
   any screen at default text size.

## B. Keyboard transition (name, key-lift, bodyweight)

Current behavior jumps. Required behavior: when the keyboard opens, the
illustration shrinks (or fades out) with a SINGLE smooth animation driven
by the keyboard event — matching iOS keyboard duration and easing curve,
using an interpolated shared value, not a layout re-render. Nothing may
pop, jump, or reflow in steps. Closing the keyboard reverses the same
animation. If a smooth shrink cannot hold 60fps, fade the illustration
out instead — but never an abrupt disappearance.

## C. Today — background

Add a very subtle animated gradient behind the Today canvas: same paper
family as #F4F5EF, extremely low contrast between stops (barely
perceptible), slow drift measured in tens of seconds, no visible banding,
no color outside the warm paper palette. It must read as "not flat",
never as "a gradient". Disable the motion when the OS reduce-motion
setting is on, falling back to a static gradient.

## D. Today — session start affordance

1. Replace the current unclear icon that suggests the last workout. It
   must be self-explanatory: an icon WITH a label (e.g. a labeled pill
   "Start a session"), not a bare glyph.
2. Tapping it opens a picker sheet listing:
   - the detected session types (Push / Pull / Legs, or Day A / Day B,
     or whatever clustering produced), with the due one marked
   - "Repeat last session"
   - "Empty session"
3. Choosing an option prefills today's canvas with that session's
   planned movements.

## E. Today — planned sets and progression

1. A prefilled session renders as a checklist of PLANNED sets. Each row:
   an unchecked circle, the set number, the recommended weight and target
   reps from the existing prescription engine, styled as planned values
   (green #547C00), never as logged values.
2. Planned sets are not part of the record: they are excluded from
   today's totals, weekly volume, streak counts and all statistics until
   they are completed.
3. Tapping a circle marks that set done, moves it into the record with
   the planned values, and it immediately counts in the totals. Long
   press (or tapping the values) opens editing so the user can log what
   they actually did instead of the plan.
4. Writing free text still works exactly as before and coexists with a
   prefilled session — the written line always wins as the source of
   truth.

## F. Constraints

- Do not change the parser, the prescription math, or the Next tab.
- Do not change existing correction/alias behavior.
- Keep the design system: paper #F4F5EF, ink #171914, blue #007AFF as
  accent, green ONLY for planned values, no emoji.
- Any connected MCP tooling may be used for animation reference; it is
  optional, not required.

## G. Tests required

- Manifest completeness: every slug in the onboarding flow config has an
  entry; scale values within 0.5–1.5.
- No looping animation in onboarding: a check asserting zero `withRepeat`
  usages under the onboarding directory.
- Keyboard transition reducer: illustration size interpolates
  monotonically from open to closed with a single animation.
- Reduce-motion: gradient animation is disabled when the flag is on.
- Planned-set state machine: planned → logged transition; planned sets
  excluded from all totals; logged sets included; editing a logged set
  keeps it logged.
- Session picker: options derive from detected session types plus
  "repeat last" and "empty".