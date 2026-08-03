/**
 * Terms of Use and the Privacy Policy, written once (PLAN A3).
 *
 * These two documents are the only two words App Review taps on a subscription
 * screen, and until 28 July they were styled as links with no handler and no
 * URL. They are content, not chrome, so they live here as data: `app/legal.tsx`
 * renders them in the app, and `scripts/build-legal-html.ts` writes the same
 * text to `docs/` as static pages for the two URL fields App Store Connect
 * requires. One source, so the hosted page and the in-app page can never say
 * different things.
 *
 * ACCURACY IS THE POINT. Every factual claim below was checked against the
 * code, in the same spirit as CLAUDE.md §0: the parse function really does
 * forward note text to Anthropic (`supabase/functions/parse-workout/index.ts`),
 * `raw_text` really is never logged (§7.3), there really is no analytics SDK
 * (§2.1), and account deletion really does delete (PLAN D1). If any of that
 * changes, this file changes in the same commit.
 *
 * The voice rule (§15 — "never say AI") is a PRODUCT rule. A privacy policy is
 * the one surface where the mechanism must be named precisely, because a user
 * deciding whether to type into this app is entitled to know exactly whose
 * servers see the sentence.
 */

// ---------------------------------------------------------------------------
// OWNER: three values below are the only things in this file that are not
// derivable from the code. Set them before the first submission.
// ---------------------------------------------------------------------------

/** OWNER: a mailbox you actually read. App Review checks that support replies. */
export const SUPPORT_EMAIL = 'support@recore.app';
/** OWNER: the entity that publishes Recore, as it should appear on an invoice. */
export const PUBLISHER = 'Recore';
/** OWNER: your jurisdiction. */
export const GOVERNING_LAW = 'Slovenia';

/** Where the hosted copies live once the owner publishes `docs/` (C4 puts the
 * same two URLs into App Store Connect). Empty until then — the in-app pages
 * are the shipped behaviour and never depend on this. */
export const HOSTED_BASE_URL = '';

/** Apple's standard EULA — acceptable for an auto-renewable subscription and
 * the smaller job than writing one (PLAN A3 step 1). */
export const APPLE_STANDARD_EULA_URL =
  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/** Where a subscription is actually cancelled. Named in both documents. */
export const MANAGE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

export const LAST_UPDATED = '29 July 2026';

/**
 * Three documents, one route. `parsing` is not a legal document — it is the
 * plain-English companion to the privacy policy that CLAUDE.md §7.3 and PLAN C3
 * ask for, and it was an `Alert` on the You screen until 28 July. It lives here
 * because it says the same things in the same words, and two files describing
 * one mechanism is how documents start disagreeing.
 */
export type LegalDocId = 'terms' | 'privacy' | 'parsing';

export interface LegalLink {
  label: string;
  /** Another document in this file… */
  doc?: LegalDocId;
  /** …or an external URL. Exactly one of the two. */
  url?: string;
}

export interface LegalSection {
  heading: string;
  /** Paragraphs. A line starting with "· " renders as a bullet; a line that is
   * a bare URL renders as a tappable link. */
  body: string[];
  /** Rendered as tappable rows under the paragraphs. */
  links?: LegalLink[];
}

export interface LegalDoc {
  id: LegalDocId;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

// --- Terms of Use --------------------------------------------------------------

const TERMS: LegalDoc = {
  id: 'terms',
  title: 'Terms of Use',
  updated: LAST_UPDATED,
  intro:
    'Recore is a training log you write in. These terms cover what you get, what a subscription costs, and what Recore does not promise. They are short on purpose.',
  sections: [
    {
      heading: 'The agreement',
      body: [
        `Recore is published by ${PUBLISHER}. By using the app you accept these terms and Apple's Standard End User License Agreement, which applies to every app licensed through the App Store:`,
        APPLE_STANDARD_EULA_URL,
        'Where the two disagree, Apple’s terms win for anything about the App Store licence itself.',
      ],
    },
    {
      heading: 'Subscription, price and renewal',
      body: [
        'Recore is a paid app. Two auto-renewable subscriptions are offered: an annual plan and a monthly plan. Both include the same free trial for subscribers who are eligible for one.',
        'The exact price, the trial length and the first charge date are always shown on the subscription screen before you buy, in your own storefront currency, exactly as the App Store reports them. This document deliberately quotes no amount: a figure written here would be wrong for most countries and would go stale the first time pricing changes.',
        'Eligibility for the free trial is decided by the App Store, once per subscription group. If you have used the trial before, the subscription screen shows you the price with no trial rather than promising one you cannot have.',
        'Payment is charged to your Apple Account when you confirm the purchase.',
        'A subscription renews automatically unless auto-renew is turned off at least 24 hours before the end of the current period. Your account is charged for the renewal within 24 hours before the period ends.',
        `You can manage or cancel a subscription at any time in your Apple Account settings: ${MANAGE_SUBSCRIPTIONS_URL}. Cancelling stops the next renewal; it does not refund the period you are in. Deleting the app does not cancel a subscription.`,
        'If you start a free trial and then buy a subscription before the trial ends, the unused part of the trial is forfeited — this is how the App Store handles trials, and it is the same everywhere.',
        'Before a trial ends, Recore shows you a reminder inside the app carrying the date, the amount and how to cancel. We do not send email.',
      ],
    },
    {
      heading: 'What happens if you stop paying',
      body: [
        'Your record is never held hostage. When a subscription lapses, Recore becomes read-only: every note, session and plan stays on your device and in your account, still browsable and still exportable. Only new logging pauses.',
        'Export is free forever and is never gated, degraded or delayed — including after a subscription ends.',
      ],
    },
    {
      heading: 'What Recore is not',
      body: [
        'Recore computes suggested loads from numbers you logged yourself. It is a record and a calculation, not coaching, and not medical, health or fitness advice.',
        'You decide what to lift. Training is physical and carries risk of injury; a suggested weight is a suggestion, and a bad day, an illness or a niggle outranks anything on this screen. If you have a medical condition, ask a doctor rather than an app.',
      ],
    },
    {
      heading: 'Your content',
      body: [
        'Your notes are yours. You keep every right you already had in them. Recore stores and processes them only to run the service for you: to read them into structure, to compute your next session, and to sync them to your own account.',
        'We do not sell your content, publish it, or use it to train models.',
      ],
    },
    {
      heading: 'Fair use',
      body: [
        'Do not use Recore to break the law, to attack the service, or to work around the rate limits that keep it running for everyone. Automated bulk use of the parsing endpoint is not permitted.',
        'We may suspend an account that does these things. If we do, your export still works.',
      ],
    },
    {
      heading: 'Availability and changes',
      body: [
        'Recore is offered as it is. The app works offline by design, so a server outage does not stop you logging — but sync and parsing need a connection, and neither is guaranteed to be available at all times.',
        'These terms may change. Material changes are shown in the app before they take effect, and the date at the top of this page always tells you which version you are reading.',
      ],
    },
    {
      heading: 'Liability',
      body: [
        'To the extent the law allows, Recore is not liable for indirect or consequential loss, for lost data where you had the ability to export it, or for injury arising from training decisions you made.',
        'Nothing here limits rights you have as a consumer under the law of your country, including statutory refund rights.',
      ],
    },
    {
      heading: 'Law and contact',
      body: [
        `These terms are governed by the law of ${GOVERNING_LAW}, without affecting mandatory consumer protections where you live.`,
        `Questions: ${SUPPORT_EMAIL}`,
      ],
      links: [
        { label: 'Privacy Policy', doc: 'privacy' },
        { label: 'Apple’s Standard EULA', url: APPLE_STANDARD_EULA_URL },
      ],
    },
  ],
};

// --- Privacy Policy --------------------------------------------------------------

const PRIVACY: LegalDoc = {
  id: 'privacy',
  title: 'Privacy Policy',
  updated: LAST_UPDATED,
  intro:
    'Recore is a training log. It holds what you typed and the record built from it, and nothing else. There is no advertising, no tracking, and no analytics SDK in this app.',
  sections: [
    {
      heading: 'What stays on your device',
      body: [
        'Everything, first. Your notes are written to a database on the phone in the same instant you type them, and the app is fully usable with no connection at all. Sync is a backup of your own data to your own account, never the place the app reads from.',
      ],
    },
    {
      heading: 'What is stored in your account',
      body: [
        'When you sign in with Apple or Google, Recore creates an account and stores:',
        '· An account identifier, your email address, and your name if the provider gives it to us. Sign in with Apple can hide your email; that works fine here.',
        '· Your training content: the text of each note, the sessions, exercises and sets read out of it, the corrections you made, your saved shorthands, your prescriptions and your plan days.',
        '· Your check-in notes: the optional few words you write after a session about how it went. They are stored with that session, in whatever language you wrote them, exactly as typed.',
        '· Your setup answers: what you train for, how long you have trained, whether you train in a gym or for a sport, the days you usually train, your units, the movement you care about most, and — only if you chose to enter them — your bodyweight and height.',
        'Bodyweight and height are optional, they are asked once with their purpose stated, and leaving them empty changes nothing else in the app. Recore never turns them into a calorie target, a body score, or any kind of health or medical judgement.',
        'A check-in note is your own record of how a session felt. Recore never reads it as training data, never turns it into a number, a chart or a score, and never treats it as a health, medical or nutritional assessment.',
        'That is the whole list. Every row is scoped to your account at the database level, so no other user can read it, and the same scoping is mirrored on the device — signing in as a different account wipes the local copy first.',
        'We do not collect your location, your contacts, your photos, your health records, or your device advertising identifier.',
      ],
    },
    {
      heading: 'What leaves your device, and why',
      body: [
        'Three things, all only when you are online:',
        '· The text of a note, to read it into structure. It goes to Recore’s own server function, which forwards it to Anthropic, the language-model provider that returns the reading. The note is sent as data, it is never written to a log, it is never attached to an error report, and Recore does not use it to train anything.',
        '· A single already-computed sentence, when Recore rephrases the reason for a prescription in your language. The weight itself is always computed on your device by code, never chosen by a model.',
        '· Your Recore account identifier, to RevenueCat, so the app can ask whether your subscription is active. No note text, no training data and no name goes with it. This happens once when you sign in, and again only when you buy or restore.',
        'Your account’s own rows also sync to your account when a connection is available. That is a copy of your data for you, not a disclosure to anyone.',
      ],
    },
    {
      heading: 'Who processes data for us',
      body: [
        '· Supabase — hosts the database, the sign-in and the server functions.',
        '· Anthropic — processes note text to return the structured reading described above, and nothing else.',
        '· Apple — handles sign-in and every payment. Recore never sees your card.',
        '· RevenueCat — records which subscription you hold, so the app can tell whether it is active on any device you sign in on. It receives your Recore account identifier and the purchase details Apple returns. It never receives your notes, your training, your name or your email.',
        'There is no fifth. We do not sell or share personal data, and we do not disclose it for advertising or cross-app tracking.',
      ],
    },
    {
      heading: 'Usage counters',
      body: [
        'Recore keeps a handful of plain counters — how far you got in setup, whether you imported a history, how many readings you corrected, whether a prescription was followed. They live in the same local database as your training, they carry no identifier and no note text, and they are included in your export so you can read exactly what they say.',
        'They exist so the product can be improved from evidence instead of guesses. There is no third-party analytics SDK in this app, and no data is sent anywhere for that purpose.',
      ],
    },
    {
      heading: 'Your data, your call',
      body: [
        '· Export — the full record, as CSV or as JSON with your original words, at any time, free forever, including after a subscription ends. The JSON also carries your setup answers, your body context and your check-in notes, so nothing Recore holds about you is left out of it.',
        '· Delete — You → Delete account removes your account and its rows, and wipes the local copy on the device, including your setup answers, body context and check-in notes. It is immediate, not a request.',
        '· Access and correction — the app itself is the access interface: every stored word is on screen and editable.',
        `If you are in the EU or UK, these cover your rights of access, portability and erasure. For anything the app cannot do for you, write to ${SUPPORT_EMAIL}.`,
      ],
    },
    {
      heading: 'How long it is kept',
      body: [
        'Until you delete it. Recore does not expire accounts or quietly prune old training, because a training log with a five-year history is the point.',
      ],
    },
    {
      heading: 'Children',
      body: [
        'Recore is not directed at children and we do not knowingly create accounts for anyone under 16.',
      ],
    },
    {
      heading: 'Changes and contact',
      body: [
        'If this policy changes in a way that affects what leaves your device, the app says so before the change takes effect. The date at the top tells you which version you are reading.',
        `${PUBLISHER} · ${SUPPORT_EMAIL}`,
      ],
      links: [
        { label: 'How parsing works', doc: 'parsing' },
        { label: 'Terms of Use', doc: 'terms' },
      ],
    },
  ],
};

// --- How parsing works ------------------------------------------------------------

const PARSING: LegalDoc = {
  id: 'parsing',
  title: 'How parsing works',
  updated: LAST_UPDATED,
  intro:
    'You write a line in your own words; Recore reads it into sets. This is exactly where that reading happens and what it costs you in privacy.',
  sections: [
    {
      heading: 'Your words are the record',
      body: [
        'What you typed is stored as you typed it and is never rewritten, tidied or replaced. The structured reading — the exercise, the sets, the weights — is a projection built on top of it, and it is rebuilt from scratch every time the note is read again.',
        'That is why a wrong reading is never destructive: the sentence you wrote is still there underneath it.',
      ],
    },
    {
      heading: 'Where the reading happens',
      body: [
        'The note text is sent to Recore’s own server function, which forwards it to Anthropic and gets the structure back. The key that call needs exists only on that server — it is not in the app, so it cannot leak from your phone.',
        'The text is treated as data, never as an instruction, and it is never written to a log or attached to an error report. Nothing about the note is kept on the server after the reading is returned.',
      ],
    },
    {
      heading: 'The numbers are not guessed',
      body: [
        'A suggested weight is computed on your device, by code, from sets you logged yourself — the same arithmetic every time, with no model involved in the decision. A model may rephrase the one-line reason in your language; it never picks the number.',
      ],
    },
    {
      heading: 'When it gets it wrong',
      body: [
        'Long-press the card and fix it. The correction lands three times: on this session now, on this line forever, and — if you renamed the exercise — as a shorthand of your own that is consulted before anything else, everywhere.',
        'A line Recore cannot read is left alone as prose. There is no error, no red underline and no toast, because a log you have to argue with is not a log.',
      ],
    },
    {
      heading: 'Offline',
      body: [
        'Writing never waits for any of this. A line is saved to your phone in the same instant you type it, and the reading catches up when there is a connection. The app is fully usable with no network at all.',
      ],
    },
    {
      heading: 'The full documents',
      body: [],
      links: [
        { label: 'Privacy Policy', doc: 'privacy' },
        { label: 'Terms of Use', doc: 'terms' },
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  terms: TERMS,
  privacy: PRIVACY,
  parsing: PARSING,
};

/** Resolve a route param to a document, defaulting to Terms rather than 404. */
export function legalDoc(id: string | undefined): LegalDoc {
  return id != null && id in LEGAL_DOCS ? LEGAL_DOCS[id as LegalDocId] : TERMS;
}
