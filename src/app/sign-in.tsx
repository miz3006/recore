import * as AppleAuthentication from 'expo-apple-authentication';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand-mark';
import { Icon, type IconName } from '@/components/icon';
import { FadeSlideIn, PressableScale, Stagger } from '@/components/motion';
import { Eyebrow } from '@/components/primitives';
import { AppleSignInButton, GoogleSignInButton } from '@/components/provider-button';
import { isDevSignInAvailable } from '@/lib/auth/dev-door';
import { signInAsDeveloper } from '@/lib/auth/dev-sign-in';
import {
  signInWithApple,
  signInWithGoogle,
  SignInCancelledError,
} from '@/lib/auth/sign-in';
import { canSell } from '@/lib/billing/store';
import { isSupabaseConfigured } from '@/lib/env';
import type { LegalDocId } from '@/lib/legal';
import { devLog } from '@/lib/log';
import { getName } from '@/lib/prefs';
import {
  color,
  hairline,
  HIT,
  MAX_FONT_SCALE,
  moderateScale,
  osFontScale,
  shadow,
  spacing,
  textRoom,
  type,
} from '@/lib/theme';

/**
 * A BUILD WITH NO SHOP HAS NO TRIAL TO START (`canSell`, `billing/store.ts`),
 * and this screen is the step straight after the paywall — which, in exactly
 * those builds, has just said that nothing is charged and nothing is running
 * down. "Create your free account to start the trial" would contradict the
 * screen before it and promise a clock no store is running (CLAUDE.md §2 rule
 * 5), so the two screens read the SAME function rather than each deciding for
 * itself. Read once at module scope, like the paywall's `TESTER_PASS`.
 */
const NOTHING_TO_PAY = !canSell();

/**
 * Whether the development row may be drawn at all — a development build whose
 * owner has actually configured an account. Read once at module scope: both
 * halves of the answer are build-time constants, so asking per render would be
 * asking a question that cannot change. See `lib/auth/dev-door.ts`.
 */
const DEV_DOOR = isDevSignInAvailable();

/**
 * Sign in — the LAST step of the funnel (2026-07-23 redesign), not the front
 * door. The user has personalised their ledger and picked a plan; this screen
 * turns that into a real account so the trial can start and the setup is backed
 * up. Framed as reward, never a toll gate. Providers are the real ones wired
 * today: Apple and Google.
 *
 * ## The 16 September 2026 pass: a composition, not a column of paragraphs
 *
 * (owner — *"naj bo dejansko lepši dizajn ... lepo strukturiraj"*.)
 *
 * The screen was correct and plain. Everything it had to say, it said in prose:
 * a 28 pt ink `R`, an eyebrow, a headline, a four-line subline paragraph, and
 * then a second three-line caption under the buttons repeating most of the
 * first one. Two grey paragraphs stacked around two controls is not a layout —
 * it is a page with the controls placed on it. Ten shipping sign-in screens
 * were read for this pass through Appllama (Notability, Photoroom, Poke Genie,
 * Bring!, Widgetable, Smule, RNI Films, Friends, Find What Feels Good, Voice
 * Dream), and the two things every good one does that this did neither:
 *
 * **1. It shows you the app you are signing into.** Photoroom, Poke Genie and
 * Bring! all lead with the APP ICON at 56–72 pt — not a glyph, the actual
 * install-screen artwork — because a sign-in screen's first job is recognition.
 * So the top slot is the icon now: the `R` in white on a brand-blue squircle,
 * at Apple's own icon corner ratio, which is `assets/brand/app-icon-1024.png`
 * reproduced in two tokens. It does NOT reopen the ruling earlier the same day
 * that replaced the "Recore" wordmark with the mark — it is that same mark,
 * wearing the lockup the person has already tapped once today.
 *
 * **2. It breaks the promises out of the paragraph.** Notability's sign-in puts
 * its reassurance in short scannable lines rather than a block. The subline is
 * one sentence now (what the account is FOR), and the three things a person
 * actually wants to know before handing over an identity — it syncs, there is
 * no password, the record stays exportable — are three glyph rows. Nothing new
 * is claimed: every line is a promise this repository already keeps (§3's
 * export invariant, `sign-in.ts`'s provider list, the sync loop), and the old
 * caption that used to repeat two of them under the buttons is deleted rather
 * than left to drift out of agreement with them.
 *
 * The rhythm is the funnel's, unchanged: left-aligned eyebrow → headline →
 * supporting copy, exactly as `OnboardingScreen` and the paywall set it, so the
 * last step reads as the same flow rather than as a new screen.
 *
 * ## It scrolls, and that is load-bearing (9 September 2026)
 *
 * The device this app is reviewed on runs iOS at `AccessibilityXL`. At that
 * setting the old fixed-height column overflowed in BOTH directions: the
 * eyebrow printed on top of the wordmark, the subline was sliced in half by the
 * Apple button, and the development block ran off the bottom with no way to
 * reach it. None of it was visible at the default text size, which is why it
 * shipped. One `ScrollView` with `flexGrow: 1` and `space-between` keeps the
 * roomy layout when there is room and becomes a scrolling page when there is
 * not. A screen that can overflow is a scroll view, always.
 *
 * ## The Apple button is Apple's button (9 September 2026)
 *
 * It is the real `ASAuthorizationAppleIDButton` — see
 * `components/provider-button.tsx`. The mark, the metrics and the LANGUAGE come
 * from the OS instead of from an English literal, which matters on the
 * Slovenian device this is reviewed on.
 *
 * ## Apple and Google are the whole list, and that is a decision, not a gap.
 *
 * There is no email/password path and none is required: App Store guideline
 * 4.8 asks that an app offering a third-party login (Google) also offer a
 * privacy-equivalent one, and Sign in with Apple IS that option — it does not
 * ask for a second one on top. Every iPhone that can install this app is signed
 * into an Apple ID, so "I have neither account" is close to unreachable in
 * practice. The one real hole is an Apple ID without two-factor, which Sign in
 * with Apple refuses; those people still have Google. If that hole ever needs
 * closing, close it with an email magic link (Supabase already speaks OTP) —
 * never a password, because "No passwords" in the assurance rows is a promise
 * this screen keeps.
 *
 * ## The Apple button is allowed to be absent. It is not allowed to be SILENT.
 *
 * (owner, on a device, 4 September 2026 — *"appla sploh ni kot možnost"*.)
 *
 * `AppleAuthentication.isAvailableAsync()` is a probe of the NATIVE module, and
 * `expo-apple-authentication` resolves through `requireOptionalNativeModule`:
 * when the module is not in the running binary it hands back a stub whose
 * `isAvailableAsync` returns `false` forever. **Expo Go does not carry it**, so
 * inside Expo Go the probe answers no, the button was dropped from the tree,
 * and the screen offered Google alone with nothing said about why. That is not
 * "Apple is unavailable", it is a screen that looks broken, and the same
 * silence would hide a genuinely misconfigured build.
 *
 * So availability is a THREE-state — probing, present, absent — and the absent
 * state prints a line where the button would have been. `probing` renders
 * nothing rather than a placeholder — the native call answers in a frame or two,
 * and a note that flashes and vanishes is worse than a moment of nothing.
 *
 * ## Legal attribution
 *
 * The near-universal shape on every reference screen is provider buttons in a
 * bottom stack over one line of terms-and-privacy microcopy. `/legal` has
 * carried both documents since PLAN A3; they are linked here, which is also
 * what App Review looks for on the screen that creates an account.
 *
 * A fabricated `<Rating score={4.9} countLabel="loved by early lifters" />` sat
 * under the subline until 28 July. There are no real reviews (§12.1), so it was
 * deleted here for the same reason it was deleted from the paywall and the
 * onboarding ready screen. The space is not refilled.
 */
export default function SignIn() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  /**
   * WHERE TO GO ONCE THE SESSION LANDS, and only the paywall's DEV·SKIP sets it.
   *
   * This screen sits behind `guard={session === null}` (`app/_layout.tsx`), so
   * signing in removes it and reveals whatever pushed it. That is deliberate
   * for the paywall's CTA — the paywall is still mounted underneath and its
   * `pendingPurchase` effect resumes the purchase on exactly that return. It is
   * wrong for every other entrance, which has nothing to resume and would just
   * put the user back on the screen they came from.
   *
   * So the caller says. Absent the parameter, the old behaviour is unchanged.
   */
  const { next } = useLocalSearchParams<{ next?: string }>();
  const name = getName();
  /**
   * `probing` until the native call answers; `absent` is a REPORTED state, not
   * an empty slot. Anything that is not iOS starts at `absent` and stays there:
   * Sign in with Apple does not exist off the platform, which is a fact about
   * the platform rather than a fault to explain, so the note below is iOS-only.
   */
  const [apple, setApple] = useState<'probing' | 'present' | 'absent'>(
    Platform.OS === 'ios' ? 'probing' : 'absent',
  );
  const [busy, setBusy] = useState<null | 'apple' | 'google' | 'dev'>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => setApple(ok ? 'present' : 'absent'))
      .catch((err) => {
        // A rejected probe is still an answer, and swallowing it whole is how
        // this went unexplained for as long as it did.
        devLog('apple availability probe failed:', err instanceof Error ? err.message : err);
        setApple('absent');
      });
  }, []);

  const run = async (which: 'apple' | 'google' | 'dev', fn: () => Promise<void>) => {
    if (busy) return;
    setError(null);
    setBusy(which);
    try {
      await fn();
      // Hand the decision back to the dispatcher, which is the only thing that
      // can see onboarding, session and entitlement at once. It has to UNWIND
      // on the way, or the funnel this screen was reached through stays
      // underneath and a back swipe from Today lands on the paywall.
      //
      // The development door always goes home: it has no purchase to resume,
      // and getting past this screen is the entire reason it was pressed.
      //
      // ONE `dismissTo`, NOT `dismissAll()` + `replace('/')` (10 September
      // 2026). That pair is what printed "The action 'POP_TO_TOP' was not
      // handled by any navigator" in development, and the reason is timing:
      // `dismissAll` queues a RAW `POP_TO_TOP`, which expo-router dispatches
      // when the routing queue FLUSHES — one render later — while
      // `canDismiss()` answered from the state as it was at CALL time.
      // Signing in is exactly the moment those two disagree. The session lands,
      // the `Stack.Protected` guards in `app/_layout.tsx` flip in the same
      // commit, `sign-in` is unregistered and `(tabs)` registered, and the root
      // stack is rewritten under the queued action — which then arrived at a
      // stack with nothing left to pop.
      //
      // `dismissTo` queues a ROUTER_LINK instead. expo-router resolves those
      // against the LIVE tree at flush time and aims them at the navigator that
      // actually owns `/`, so it pops back to the dispatcher when the funnel is
      // still underneath and replaces the current screen with it when the guard
      // has already taken the funnel away. Same destination either way, and no
      // action that can go unhandled.
      if (next === 'home' || which === 'dev') {
        router.dismissTo('/');
      }
    } catch (err) {
      if (!(err instanceof SignInCancelledError)) {
        const detail = err instanceof Error ? err.message : String(err);
        devLog('sign-in error:', detail);
        // One sentence for the athlete, the provider's own words for whoever is
        // building it. A redirect the Supabase project has not allow-listed and
        // a missing native module both used to read as the same four words.
        setError(__DEV__ ? `Sign-in failed. ${detail}` : 'Sign-in failed. Try again.');
      }
    } finally {
      setBusy(null);
    }
  };

  const openLegal = (doc: LegalDocId) => router.push({ pathname: '/legal', params: { doc } });

  return (
    <ScrollView
      style={styles.root}
      // The whole reason this is a scroll view: at an accessibility text size
      // the content is taller than the window, and the old fixed column dealt
      // with that by overlapping itself. `flexGrow` keeps the roomy layout when
      // there IS room; `space-between` is what pins the buttons low without a
      // second, absolutely-positioned tree.
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl },
      ]}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      <View style={styles.top}>
        <FadeSlideIn>
          <AppIconLockup />
        </FadeSlideIn>

        <View style={styles.hero}>
          <Stagger initialDelay={120} step={80} distance={14}>
            <Eyebrow tone="secondary">Last step</Eyebrow>
            {/* No hard line break any more. A `\n` set the shape of this
                headline at one text size and one name length and broke it at
                every other — "Save your ledger,⏎Aleksander." at
                AccessibilityXL is three lines, one of them a lone full stop. */}
            <Text style={styles.headline} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {name ? `Save your ledger, ${name}.` : 'Save your ledger for good.'}
            </Text>
            <Text style={styles.sub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {NOTHING_TO_PAY
                ? 'One free account keeps everything you just set up — and nothing is charged while Recore is being tested.'
                : 'One free account starts the trial and keeps everything you just set up.'}
            </Text>
          </Stagger>
        </View>

        <FadeSlideIn delay={360} distance={14}>
          <View style={styles.assurances}>
            {assurances(apple === 'present').map((a) => (
              <Assurance key={a.glyph} glyph={a.glyph} text={a.text} />
            ))}
          </View>
        </FadeSlideIn>
      </View>

      <View style={styles.bottom}>
        <View style={styles.buttons}>
          {apple === 'present' ? (
            <AppleSignInButton
              onPress={() => void run('apple', signInWithApple)}
              disabled={busy !== null}
              loading={busy === 'apple'}
            />
          ) : null}

          {/* Where the button would be, once the probe has actually answered.
              `absentNote` returns null for the one case that needs no
              explanation — see the header. */}
          {apple === 'absent' && absentNote() ? (
            <Text style={styles.unavailable} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {absentNote()}
            </Text>
          ) : null}

          <GoogleSignInButton
            label="Continue with Google"
            onPress={() => void run('google', signInWithGoogle)}
            disabled={busy !== null}
            loading={busy === 'google'}
          />
        </View>

        {error ? (
          <Text
            style={styles.error}
            accessibilityLiveRegion="polite"
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {error}
          </Text>
        ) : null}

        {/* The line every reference screen carries. Both documents already
            exist at `/legal`; nothing here is a new promise. */}
        <Text style={styles.legal} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          By continuing you agree to the{' '}
          <LegalLink label="Terms of Use" onPress={() => openLegal('terms')} />
          {' and '}
          <LegalLink label="Privacy Policy" onPress={() => openLegal('privacy')} />.
        </Text>

        {/* THE DEVELOPMENT DOOR, and it is behind TWO gates now (16 September
            2026, owner: it must not be in production).

            `__DEV__` is spelled here literally rather than folded into the
            constant beside it, and that is the point: Metro replaces it with
            `false` in a release bundle, so this whole branch is DELETED from
            the app anyone installs rather than merely evaluated to nothing in
            it. `DEV_DOOR` is the second gate — a development build whose owner
            has actually configured an account (`lib/auth/dev-door.ts`, and it
            has a test, which the rule never had before). Until today only the
            first gate existed, so every checkout of this repository without a
            local `.env` drew a labelled control under the Apple and Google
            buttons whose entire behaviour was to fail.

            See `lib/auth/dev-sign-in.ts` for why it signs in FOR REAL rather
            than pretending, and what the three `SIMPASS` markers cost when they
            pretended. Under a rule and labelled, because a door nobody can see
            is how those survived. */}
        {__DEV__ && DEV_DOOR ? (
          <View style={styles.devBlock}>
            <View style={styles.devRule} />
            <PressableScale
              onPress={() => void run('dev', signInAsDeveloper)}
              activeScale={0.98}
              disabled={busy !== null}
              accessibilityRole="button"
              accessibilityLabel="Sign in as the development account"
              style={styles.devRow}>
              <Text style={styles.devLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {busy === 'dev' ? 'Signing in…' : 'Development sign-in'}
              </Text>
            </PressableScale>
            <Text style={styles.devNote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              A real session on the dev account. Never in a release build.
            </Text>
          </View>
        ) : null}

        {!isSupabaseConfigured() ? (
          <Text style={styles.configHint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Supabase is not configured. Copy .env.example to .env and fill in
            EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

/**
 * THE APP ICON, redrawn in two tokens.
 *
 * `assets/brand/app-icon-1024.png` is the white `R` centred on a brand-blue
 * field, so this is `color.brand` and `color.onInk` and nothing else — no
 * imported bitmap, which would have to be kept in step with the export by hand
 * and would go soft at a large text size instead of redrawing at it.
 *
 * **`0.2237` is Apple's icon corner ratio**, not `radius.md`. Every other
 * rounded rectangle in the app comes off the four-value scale and this one may
 * not: it is a reproduction of a specific piece of artwork, and the artwork is
 * masked by iOS with a continuous superellipse at that fraction of the side. At
 * 60 pt it lands on 13.4 — close enough to `radius.md` that guessing would have
 * looked almost right, which is exactly the near-miss that reads as cheap.
 *
 * It takes Dynamic Type through `osFontScale` for the same reason the bare mark
 * that preceded it did: an `Svg` is a view, so it ignores the reader's text
 * setting unless it is told, and it would be the one thing on the screen that
 * does.
 *
 * It floats on `shadow.card` like every other surface on the canvas. A filled
 * blue tile does not strictly need an edge to be visible, but the app's rule is
 * that a surface on the canvas gets a border or a shadow, and a shadow is the
 * one that says "this is the icon, sitting on the page".
 */
const TILE = moderateScale(60) * osFontScale;
/** The `R`'s share of the icon's height, measured off the 1024 pt export. */
const TILE_MARK = TILE * 0.58;

function AppIconLockup() {
  return (
    <View style={styles.tile}>
      <BrandMark size={TILE_MARK} tint={color.onInk} />
    </View>
  );
}

/**
 * THE ASSURANCE PILL'S GEOMETRY, and the two things a screenshot caught.
 *
 * **It is a VIEW, so it takes the reader's text size itself** (`textRoom`, the
 * helper that exists for exactly this). Left at a flat `moderateScale(30)` it
 * stayed a 30 pt circle beside a 23 pt line at `AccessibilityXL` — the one
 * element on the screen not growing with everything around it.
 *
 * **The lift is NEGATIVE, and the first draft clamped it to zero.** Centring a
 * mark on the first line of a paragraph is `(lineHeight − mark) / 2`, which is
 * what `BetaPass` does with its check — but that check is 15 pt inside a 22 pt
 * line, so the offset is positive and pushes the mark DOWN inside the row. This
 * pill is 30 pt against a 21 pt line, so the same arithmetic is −4.5 and the
 * pill has to be lifted OUT of the top of the row instead. A
 * `Math.max(0, …)` guard turned that into 0 and left the pill sitting 3.2 pt
 * low at every text size — measured off the simulator, invisible in the source.
 *
 * Both scale by the same factor, so the ratio the two were designed at survives
 * every Dynamic Type step rather than only the default one.
 */
const DOT = textRoom(moderateScale(30));
const DOT_LIFT = (textRoom(type.subhead.lineHeight ?? DOT) - DOT) / 2;

/**
 * THE THREE THINGS A PERSON WANTS TO KNOW BEFORE HANDING OVER AN IDENTITY.
 *
 * Each is a promise the repository already keeps, which is the only reason any
 * of them is allowed on the screen (CLAUDE.md §3 — no unsupported claim,
 * anywhere, including a placeholder):
 *
 *  · sync — `lib/sync.ts` runs against the account this screen creates;
 *  · no password — the provider list IS the whole list, by the decision in the
 *    header, and this line is why a password path may never be added quietly;
 *  · export — §3's invariant, verbatim: "export remains complete and ungated
 *    even after a subscription lapses".
 *
 * The middle one follows the Apple button's REAL availability, because the
 * caption it replaces promised Face ID and a hidden email on screens where the
 * Apple button was not in the tree at all. It no longer mentions the hidden
 * email: Apple's own sheet offers that in Apple's own words two taps later, and
 * carrying it here cost a third line that ended on the single word "browser."
 *
 * All three are WRITTEN TO THE COLUMN, which is the part a copy deck cannot
 * check. The first draft left two of the three rows ending on a one-word line
 * ("to.", "time.") — measured on the simulator, where the column holds about
 * 42 characters at the default text size. Same facts, broken so the last line
 * of each row carries at least three words.
 */
function assurances(hasApple: boolean): { glyph: IconName; text: string }[] {
  return [
    { glyph: 'refresh', text: 'Backed up, and waiting on every iPhone you sign in to.' },
    {
      glyph: 'lock',
      text: hasApple
        ? 'No passwords — Face ID with Apple, or your browser with Google.'
        : 'No passwords — Google opens in your browser.',
    },
    { glyph: 'download', text: 'Your writing stays yours — export every word, any time.' },
  ];
}

/**
 * One assurance: a glyph in a small white pill, then the sentence.
 *
 * The pill is the app's floating-chrome language at accessory scale (design
 * skill §Structure — "the colour is on the glyph, never on the circle"), and it
 * is what turns three grey sentences into a column the eye can scan by shape
 * before it reads a word. A hairline rather than a shadow: three shadows in a
 * 200 pt stack reads as three cards, and these are not cards.
 *
 * The glyph is drawn in INK and the sentence in secondary, which is the
 * opposite of the settings rows' arrangement and deliberate — `glyph.*` tints
 * are wayfinding for a long list, and three rows is not a list to navigate.
 * One ink, so the column reads as one voice.
 */
function Assurance({ glyph, text }: { glyph: IconName; text: string }) {
  return (
    <View style={styles.assurance} accessible accessibilityRole="text">
      <View style={styles.assuranceDot}>
        <Icon name={glyph} size={DOT / 2} tint={color.textPrimary} />
      </View>
      <Text style={styles.assuranceText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {text}
      </Text>
    </View>
  );
}

/**
 * One legal document, as a link inside a running sentence.
 *
 * A nested `Pressable` would break the line box, so this is a `Text` with its
 * own `onPress` — which is what keeps "Terms of Use" wrapping with the words
 * around it instead of becoming an island. `hitSlop` buys back the target the
 * HIG asks for without setting a line height nobody wants: the text is 13 pt
 * and the tappable area around it is not.
 */
function LegalLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Text
      style={styles.legalLink}
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      suppressHighlighting={false}>
      {label}
    </Text>
  );
}

/**
 * WHY THERE IS NO APPLE BUTTON, in the words that are true here.
 *
 * The probe reports one fact and one only: the native module did not answer.
 * It cannot say WHY, so neither does this — "missing from this runtime" is
 * what was measured, and "a development build carries it" is the action that
 * follows from it whatever the cause. Naming a specific client would be a
 * guess printed as a diagnosis.
 *
 * Off iOS there is nothing to explain to a user — Sign in with Apple is an
 * Apple-platform API and its absence on Android is not a fault — so the note
 * is developer-only there, and `null` in a release build keeps it off a screen
 * where it would be noise.
 */
function absentNote(): string | null {
  if (Platform.OS !== 'ios') return __DEV__ ? 'Sign in with Apple is iOS only.' : null;
  return __DEV__
    ? 'Sign in with Apple is missing from this runtime — a development build carries it.'
    : 'Sign in with Apple is not available on this device.';
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // The canvas — this was the last full-screen `surface` in the app, and a
    // white page beside a cream one is the seam v6 exists to remove.
    backgroundColor: color.canvas,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    // Breathing room between the hero and the buttons once the page is tall
    // enough to scroll and `space-between` has nothing left to distribute.
    gap: spacing.xxl,
  },
  top: {
    gap: spacing.xl,
  },
  /** The app icon. See `AppIconLockup` for why the radius is not on the scale. */
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: TILE * 0.2237,
    borderCurve: 'continuous',
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  hero: {
    gap: spacing.md,
  },
  headline: {
    ...type.display,
    color: color.textPrimary,
  },
  sub: {
    ...type.body,
    color: color.textSecondary,
  },
  assurances: {
    gap: spacing.md,
  },
  /** `flex-start`, not `center`: the sentence wraps to two and three lines at
   * the larger Dynamic Type steps, and a centred pill then floats in the gap
   * between them instead of marking the line it belongs to. */
  assurance: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  assuranceDot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: color.surface,
    borderWidth: hairline,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
    // Optically centred on the FIRST line of the sentence beside it, computed
    // from the type scale rather than nudged by eye — so it holds at every
    // text size instead of only at the default one. See `DOT_LIFT` for why it
    // is negative and why clamping it to zero was wrong.
    marginTop: DOT_LIFT,
  },
  assuranceText: {
    ...type.subhead,
    color: color.textSecondary,
    flex: 1,
  },
  bottom: {
    gap: spacing.md,
  },
  buttons: {
    gap: spacing.md,
  },
  /** Sits inside `buttons`, in the gap the Apple button would have filled. It
   * CARRIES INFORMATION — why a control the user expected is not here — so it
   * is secondary ink rather than muted, which the skill reserves for what the
   * eye may skip. Centred, because it stands in for a full-width control. */
  unavailable: {
    ...type.footnote,
    color: color.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  error: {
    ...type.caption,
    color: color.error,
  },
  legal: {
    ...type.caption,
    color: color.textMuted,
    marginTop: spacing.xs,
  },
  /** Brand blue, the one colour that means "this is a link" app-wide. */
  legalLink: {
    ...type.caption,
    color: color.brand,
    fontWeight: '600',
  },
  /** Development only, and it looks it: below everything, behind a rule, in
   * muted ink. It is a tool, not a third way to sign in. */
  devBlock: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  devRule: {
    height: hairline,
    backgroundColor: color.border,
    marginBottom: spacing.sm,
  },
  devRow: {
    minHeight: HIT,
    justifyContent: 'center',
  },
  devLabel: {
    ...type.footnote,
    fontWeight: '600',
    color: color.textSecondary,
  },
  devNote: {
    ...type.caption,
    color: color.textMuted,
  },
  configHint: {
    ...type.caption,
    color: color.textMuted,
    textAlign: 'center',
  },
});
