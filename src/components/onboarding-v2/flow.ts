/**
 * THE EIGHTEEN SCREENS, AS DATA.
 *
 * `docs/onboarding-v2-spec.md` §2: "The screen list below is fixed: do not add,
 * remove, merge or reorder screens." So the list lives in one array, in order,
 * and the route renders `FLOW[step - 1]`. Reordering the flow means editing
 * this file and nothing else; adding to it means going back to the owner first.
 *
 * Each entry carries the copy, the option set, and the analytics id. The rule
 * every screen had to pass is quoted on it, because in six months the useful
 * question about any of these will be "why does this exist" and the answer
 * should not require the spec to be open beside the code.
 */

export type ScreenKind =
  | 'welcome'
  | 'single'
  | 'multi'
  | 'text'
  | 'demo'
  | 'reading'
  | 'greeting'
  | 'lifts'
  | 'explainer'
  | 'commit'
  | 'building'
  | 'reveal'
  | 'insight';

export interface Option {
  id: string;
  label: string;
  /**
   * THE FLOW CONTAINS NO EMOJI.
   *
   * It carried up to 44 across nine screens; the audit of 28 August 2026 cut
   * that to two, and the owner then removed those as well because they would
   * not sit centred. That is not a fixable defect: a colour emoji is a bitmap
   * on a text baseline with its own internal padding and its own off-centre
   * mass, so centring one means a hard-coded per-glyph nudge that the next
   * iOS release can invalidate.
   *
   * What replaced them is `icon` — drawn paths, one stroke weight, centred by
   * geometry, tintable, and scaling with Dynamic Type for free.
   *
   * The rules that eliminated the other 42 still stand and are still asserted
   * in `characters.test.ts`, because they are what any future glyph has to
   * pass: one semantic family per screen, all-or-none per list, consistent
   * visual weight checked RENDERED, denote rather than decorate, nothing for
   * numbers or durations or abstract states, and never a skin tone, gendered
   * figure, body part, flag or keycap.
   */
  /**
   * A LEADING MARK — a system symbol, or a drawn brand silhouette on the one
   * screen that needs one. Resolved by `Mark.tsx`; never an emoji.
   *
   * Cal AI ships an `Icon Option List` on its own attribution screen (position
   * 4/38) for a reason that generalises: 🎵 is not TikTok and ✖️ is not X, and
   * an approximation of a logo is worse than no logo. The brand marks are drawn
   * as monochrome ink paths in `BrandIcon.tsx`; every other mark in the flow is
   * an SF Symbol, which is what guarantees the shared visual weight that the
   * hand-drawn set could only be checked for by eye.
   *
   * A screen carries marks on ALL of its listed options or on none of them,
   * and it carries them only where the option names something a symbol can
   * honestly denote. Numbers, durations and abstract states get none — see the
   * tests, which pin exactly which screens those are.
   */
  icon?: MarkName;
  /** A second line inside the row, where the option needs one. */
  sub?: string;
  /**
   * THIS OPTION DECLINES THE QUESTION — "nowhere", "other", "no thanks", "I
   * don't follow one".
   *
   * It is still a real answer and still tappable; it is not one of the things
   * the question is enumerating. It renders as a ghost row BELOW the list
   * rather than as a peer inside it (`GhostRow`), which is what lets the list
   * above it carry a complete semantic family — an absence cannot be denoted
   * without reaching for a UI negation glyph, and 🚫 among pictographs is
   * precisely the incoherence this whole pass is removing.
   *
   * Declared here as data so the pattern is one component and one flag rather
   * than a special case written twice (owner, 28 Aug 2026).
   */
  optOut?: boolean;
  /**
   * SELECTING THIS OPTION TURNS ON A DISTINCT CODE PATH.
   *
   * The line between this and `optOut` is not "does it decline the question" —
   * it is **does the app get anything from it**. "Other", "No thanks" and "I
   * don't log anywhere" leave the app exactly where it was: nothing is
   * enabled, nothing is scheduled, a default stands. "I don't follow a split"
   * switches the clustering engine into flat mode, which is a whole second
   * behaviour that has to be reachable and has to be exercised.
   *
   * An option marked this way may never be `optOut` — a branch that is visually
   * demoted is a branch that gets under-selected, and a branch that gets
   * under-selected is a branch that ships under-tested. Asserted in
   * `characters.test.ts`.
   */
  drivesBranch?: boolean;
}

/**
 * THE MARKS THE FLOW CAN DRAW — see `Mark.tsx`, which is the one component that
 * resolves them.
 *
 * Two sources, and they never appear on the same screen:
 *
 *   · **Drawn paths** (`BrandIcon.tsx`) for the attribution screen's six brand
 *     marks, because SF Symbols contains no third-party logos and an
 *     approximation of a logo is the one thing a mark must not be.
 *   · **System symbols** for everything else — Apple's own set, at one weight,
 *     tinted to the label beside them.
 */
export type MarkName =
  // Screen 5, attribution — drawn silhouettes.
  | 'tiktok'
  | 'instagram'
  | 'x'
  | 'youtube'
  | 'appstore'
  | 'friend'
  // Screen 20, weekly recap — time of day.
  | 'evening'
  | 'morning'
  // Screen 2, where the record lives today — objects.
  | 'notes'
  | 'trackerapp'
  | 'notebook'
  | 'spreadsheet';

export interface ScreenDef {
  /** 1-based, matching the spec's numbering and the route segment. */
  step: number;
  kind: ScreenKind;
  /** Stable analytics id. Never renumber these — a renamed step is a broken
   * funnel, and per-screen drop-off is the whole reason the flow is
   * instrumented (§0, Analytics). */
  id: string;
  headline: string;
  subline?: string;
  options?: readonly Option[];
  /** Multi-select cap. Screen 3 is "up to 2". */
  max?: number;
  /** Screen 12's inline info banner, which replaces Gravl's separate explainer
   * screen at its positions 18–19 (§2, screen 12). */
  banner?: string;
  /**
   * THIS SCREEN ASKS iOS FOR SOMETHING REAL.
   *
   * Screen 18 and nothing else. The recap screen asks *when* the weekly read
   * should land, and until 28 August 2026 nothing ever asked the OS whether it
   * could be delivered at all — so a person could pick "Sunday evening" and
   * receive nothing, for ever. Cal AI asks for real at 25/38 and Fitbod at
   * 7/15; v1 Recore has asked since 23 August.
   *
   * Declared here rather than branched on in the screen, so the one place that
   * says "this flow touches a system permission" is the flow definition.
   */
  requestsNotifications?: boolean;
  /** What the screen changes, from §2's table. Shown nowhere; kept so the next
   * person can tell a question that earns its place from a survey. */
  why: string;
}

export const FLOW: readonly ScreenDef[] = [
  {
    step: 1,
    kind: 'welcome',
    id: 'welcome',
    headline: "Write it like you'd say it.",
    subline: 'Recore reads your session from one line. No forms, no tapping through sets.',
    why: 'No question. A live ledger demo that writes and parses itself.',
  },
  {
    step: 2,
    kind: 'single',
    id: 'tracker',
    headline: 'Where do you log your training now?',
    subline: "If you already have history, you can bring it with you.",
    options: [
      // STILL NO EMOJI, AND NOW A COMPLETE FAMILY (owner, 9 Sep 2026).
      //
      // The 28 Aug audit left this screen bare on a reason that was sound about
      // emoji and unsound about marks in general: "📱 is not Hevy" is true, and
      // it does not follow that the row must be empty. Each of these four names
      // an OBJECT a record lives in today, and Apple's set denotes all four
      // exactly — a page of notes, a barbell, a closed book, a grid of cells.
      // One family, all four, no approximation of anybody's brand.
      { id: 'notes', label: 'Notes app', icon: 'notes' },
      { id: 'app', label: 'Hevy or Strong', icon: 'trackerapp' },
      { id: 'paper', label: 'Paper notebook', icon: 'notebook' },
      { id: 'excel', label: 'A spreadsheet', icon: 'spreadsheet' },
      { id: 'memory', label: "I don't log anywhere", optOut: true },
    ],
    why: 'Decides whether CSV import is offered later.',
  },
  {
    step: 3,
    kind: 'multi',
    id: 'obstacles',
    headline: 'What gets in the way?',
    subline: 'Pick up to two. This decides what Recore shows you first.',
    max: 2,
    options: [
      // No emoji: these are frustrations, not things. The set that was here
      // ran ⌨️ 🔀 🤔 ❓ 📉 — an object, a UI square, a face, a UI glyph and a
      // chart, which is four visual weights and three families in five rows.
      { id: 'typing', label: 'Too much tapping between sets' },
      { id: 'supersets', label: "Supersets and dropsets don't fit" },
      { id: 'forget', label: 'I forget what I did last time' },
      { id: 'whatnext', label: 'I never know what weight to use next' },
      { id: 'quit', label: 'I stop after a few weeks' },
    ],
    why: 'Decides which value prop leads on the reveal and the paywall.',
  },
  {
    step: 4,
    kind: 'insight',
    id: 'obstacle-insight',
    headline: '',
    why: 'Says what the app does about the specific thing they just picked. Cal AI runs two of these (12/38, 14/38); this one carries no claim about anybody else.',
  },
  {
    step: 5,
    kind: 'single',
    id: 'attribution',
    headline: 'Where did you hear about us?',
    subline: 'One tap. Nothing in the app changes.',
    options: [
      // Marks, not emoji. 🎵 is not TikTok and ✖️ is not X; an approximation
      // of a logo reads worse than no logo at all.
      { id: 'tiktok', label: 'TikTok', icon: 'tiktok' },
      { id: 'instagram', label: 'Instagram', icon: 'instagram' },
      { id: 'x', label: 'X', icon: 'x' },
      { id: 'youtube', label: 'YouTube', icon: 'youtube' },
      { id: 'appstore', label: 'App Store', icon: 'appstore' },
      { id: 'friend', label: 'A friend', icon: 'friend' },
      { id: 'other', label: 'Other', optOut: true },
    ],
    why: 'Changes nothing in-product; the only way to know which channel works.',
  },
  {
    step: 6,
    kind: 'demo',
    id: 'demo',
    headline: 'Try it.',
    subline: "Write one line, the way you'd write it in a notebook.",
    why: 'The aha moment. Neither reference app can show its magic in three seconds.',
  },
  {
    step: 7,
    kind: 'reading',
    id: 'reading',
    headline: "Here's the read.",
    subline: 'Your words stay exactly as you wrote them.',
    why: 'No question. The parsed table from screen 5.',
  },
  {
    step: 8,
    kind: 'text',
    id: 'name',
    headline: "What's your name?",
    subline: 'First name is enough.',
    why: 'Name, immediately before the payoff screen (Gravl: name at 3, greeting at 4).',
  },
  {
    step: 9,
    kind: 'greeting',
    id: 'greeting',
    headline: 'Hello,',
    why: 'No question. The character’s screen. 1.5 s, auto-advances.',
  },
  {
    step: 10,
    kind: 'single',
    id: 'goal',
    headline: 'What are you training for?',
    subline: 'This picks the progression model.',
    options: [
      // Abstract states. 💪 🏋️ ⚖️ 📅 🔥 was a body part, a gendered figure,
      // an object, an object and a mood — four families and a vibe.
      { id: 'hypertrophy', label: 'Muscle' },
      { id: 'strength', label: 'Strength' },
      { id: 'both', label: 'Both' },
      { id: 'consistency', label: 'Just being consistent' },
      { id: 'hybrid', label: 'Hyrox or hybrid' },
    ],
    why: 'Selects the progression model.',
  },
  {
    step: 11,
    kind: 'single',
    id: 'experience',
    headline: 'How long have you been training?',
    subline: 'This sets how big each step up is.',
    options: [
      // Durations. There is no honest emoji for "2–5 let".
      { id: 'under6m', label: 'Less than 6 months' },
      { id: '6m2y', label: '6 months to 2 years' },
      { id: '2y5y', label: '2 to 5 years' },
      { id: 'over5y', label: 'More than 5 years' },
    ],
    why: 'Sets progression increment size.',
  },
  {
    step: 12,
    kind: 'single',
    id: 'frequency',
    headline: 'How many sessions a week?',
    subline: "That's how many Recore will plan for.",
    options: [
      // Numbers. The keycaps that were here (2️⃣…6️⃣) are not pictographs at
      // all — they are flat UI squares, a different class of object from every
      // other glyph in the flow, and on some render paths they do not draw.
      // They were the only keycap sequences in `src/`.
      { id: '2', label: 'Two' },
      { id: '3', label: 'Three' },
      { id: '4', label: 'Four' },
      { id: '5', label: 'Five' },
      { id: '6', label: 'Six or more' },
    ],
    why: 'Feeds Next-tab clustering and weekly volume.',
  },
  {
    step: 13,
    kind: 'insight',
    id: 'year-insight',
    headline: '',
    why: 'The first moment the flow has a number worth multiplying. Arithmetic on their own answer, never a statistic about other people.',
  },
  {
    step: 14,
    kind: 'single',
    id: 'split',
    headline: 'Which split do you train on?',
    banner: "Your split decides which lifts Recore groups into one session. If you don't follow one, it schedules by lift instead.",
    options: [
      // Abstract training schemes; nothing denotes a split.
      { id: 'ppl', label: 'Push / Pull / Legs' },
      { id: 'upperlower', label: 'Upper / Lower' },
      { id: 'fullbody', label: 'Full body' },
      { id: 'bro', label: 'Bro split' },
      // A PEER ROW, NOT A GHOST (owner, 28 Aug 2026 — reversing the ruling of
      // the day before). It looks like an opt-out and it is not one: it is the
      // only route into flat clustering mode, so it changes app behaviour more
      // than any other answer on this screen. See `drivesBranch`.
      {
        id: 'flat',
        label: "I don't follow a split",
        sub: 'Recore schedules by lift, not by day.',
        drivesBranch: true,
      },
    ],
    why: 'Drives the clustering engine. The last option routes to flat mode.',
  },
  {
    step: 15,
    kind: 'lifts',
    id: 'lifts',
    headline: 'Your key lifts, and what you lift now.',
    subline: "Pick the ones you watch most. Use today's working weight.",
    why: 'Fuel for both the projection and the first-session targets.',
  },
  {
    step: 16,
    kind: 'explainer',
    id: 'overload',
    headline: 'Why progressive overload works.',
    why: 'No question. One chart, one sentence — built from HIS numbers.',
  },
  {
    step: 17,
    kind: 'commit',
    id: 'commit',
    headline: 'The commitment.',
    subline: 'Hold until the circle closes.',
    why: 'Hold-to-commit.',
  },
  {
    step: 18,
    kind: 'building',
    id: 'building',
    headline: 'Building your plan.',
    why: 'The one screen that should feel like real work. 2.5–3.5 s.',
  },
  {
    step: 19,
    kind: 'reveal',
    id: 'reveal',
    headline: 'Your first session.',
    subline: 'You can change these now or any time later.',
    why: 'A number you use today, not a promise about three months out.',
  },
  {
    step: 20,
    kind: 'single',
    id: 'recap',
    headline: 'Weekly recap.',
    subline: 'One short read on your week. When should it land?',
    requestsNotifications: true,
    options: [
      // One family: the time of day each option names. Both denote literally.
      { id: 'sunday', label: 'Sunday evening', icon: 'evening' },
      { id: 'monday', label: 'Monday morning', icon: 'morning' },
      { id: 'never', label: 'No thanks', optOut: true },
    ],
    why: 'Ask WHEN, not whether. Cal AI does the same with a segmented control.',
  },
];

export const LAST_STEP = FLOW.length;

/**
 * WHERE THE PROGRESS RAIL IS, for a given step.
 *
 * §3: "On every question screen. Reaches 100% at the reveal, not at the
 * paywall." Welcome has no rail at all (it asks nothing and is not progress
 * yet), everything up to the reveal fills towards 1, and the recap sits at 1
 * because the work was already finished behind it.
 *
 * Keyed off the reveal's POSITION rather than a hard-coded 17, so inserting a
 * screen moves the denominator with it.
 */
export function railProgress(id: string): number | null {
  const here = FLOW.findIndex((s) => s.id === id);
  const reveal = FLOW.findIndex((s) => s.id === 'reveal');
  if (here <= 0) return null;
  if (here >= reveal) return 1;
  return here / reveal;
}

/** Position lookup, by id. Nothing in the flow does arithmetic on a screen
 * NUMBER any more — inserting a screen used to move the mascot and the rail
 * onto whichever screen inherited the old position. */
export function screenById(id: string): ScreenDef | undefined {
  return FLOW.find((s) => s.id === id);
}

/**
 * THE PROGRESSION INCREMENT, in kilograms, from the experience answer.
 *
 * Deterministic and stated on screen wherever it is used (screen 17 prints
 * "+2,5 kg glede na to, kar si vpisal"). CLAUDE.md §2 rule 3: loads and
 * progression calculations come from code, never from a model.
 */
export function incrementKg(experience: string | null): number {
  switch (experience) {
    case 'under6m':
      return 5;
    case '6m2y':
      return 2.5;
    case '2y5y':
      return 2.5;
    case 'over5y':
      return 1.25;
    default:
      return 2.5;
  }
}

/** How often that increment lands, in sessions. A novice adds every session; a
 * five-year lifter adds every fourth. Used by screen 14's chart and by nothing
 * else. */
export function sessionsPerStep(experience: string | null): number {
  switch (experience) {
    case 'under6m':
      return 1;
    case '6m2y':
      return 2;
    case '2y5y':
      return 3;
    case 'over5y':
      return 4;
    default:
      return 2;
  }
}

/**
 * The lifts offered on screen 13. No emoji, and there is no near miss here:
 * every candidate was a gendered human figure (🏋️ 🚣 🧗 🙆), a body part (🦵)
 * or a pun (🛋️ for "bench"). Barbell training has no emoji.
 */
export const KEY_LIFTS: readonly { id: string; label: string }[] = [
  { id: 'Bench press', label: 'Bench press' },
  { id: 'Squat', label: 'Squat' },
  { id: 'Deadlift', label: 'Deadlift' },
  { id: 'Overhead press', label: 'Overhead press' },
  { id: 'Barbell row', label: 'Barbell row' },
  { id: 'Pull-ups', label: 'Pull-ups' },
];

export const MAX_KEY_LIFTS = 3;

/**
 * STARTING POINTS FOR THE STEPPER — not claims about anybody.
 *
 * A load nobody has typed yet has to start somewhere, and starting every row at
 * the same number costs more taps than it saves. These are the rounded middle of
 * a barbell's usable range, they are visibly editable, and nothing reads them
 * until the person has seen them. A lift their own demo line mentioned overrides
 * them entirely.
 *
 * Lifted out of `screens/LiftsScreen.tsx` on 28 August 2026, when Profile's key-
 * lifts editor needed the same defaults. Two copies of a number a person can see
 * on screen is exactly the kind of drift `flow.ts` exists to prevent.
 */
export const START_KG: Readonly<Record<string, number>> = {
  'Bench press': 60,
  Squat: 80,
  Deadlift: 100,
  'Overhead press': 40,
  'Barbell row': 60,
  'Pull-ups': 20,
};

/** The stepper's fallback when a lift is not in `START_KG` at all. */
export const FALLBACK_START_KG = 40;

/**
 * THE SMALLEST PLATE IN THEIR GYM — screen 13, under the loads.
 *
 * Screen 17 prescribes `what you typed + your increment`, and for a two-year
 * lifter that is +2.5 kg, which lands on 82.5. **82.5 kg is not loadable in a
 * gym whose smallest plate is 2.5** — you would need a 1.25 a side. So the
 * prescription was quietly unachievable for anyone without small plates, which
 * is a correctness problem in the number rather than a gap in the funnel.
 *
 * It is asked here rather than on a screen of its own because the screen list
 * is fixed at eighteen (§2) and this is the screen that already talks about
 * loads. `null` is a first-class answer: the row offers a skip, the copy says
 * it can be added later, and screen 17 changes what it prints rather than
 * pretending to know.
 *
 * `lib/plates.ts` already does the arithmetic and already takes
 * `smallestPlateKg`; nothing new was invented for this.
 */
export const PLATE_OPTIONS: readonly { id: string; label: string; kg: number }[] = [
  { id: '1.25', label: '1.25 kg', kg: 1.25 },
  { id: '2.5', label: '2.5 kg', kg: 2.5 },
  { id: '5', label: '5 kg', kg: 5 },
];

/** The bar this flow assumes. Not asked — a 20 kg Olympic bar is the default
 * everywhere else in the app (`prefs.DEFAULT_BAR_KG`) and asking about it would
 * cost a row to change nothing for almost everyone. */
export const ASSUMED_BAR_KG = 20;
