import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';

import { APP_ENV, SENTRY_DSN } from '@/lib/env';

/**
 * CRASH REPORTING, AND THE FENCE AROUND IT (owner, 21 Aug 2026).
 *
 * Until now a crash in a release build left nothing behind: the app closed,
 * and the only report that could reach us was a sentence typed from memory.
 * That is survivable while the owner is the only user and indefensible the
 * moment strangers are testing — a tester cannot send a stack trace they never
 * saw. So one SDK is installed, for one purpose: the error and where in the
 * code it happened.
 *
 * ## Everything here is a fence, not a feature
 *
 * The privacy policy now states exactly what a crash report carries
 * (`lib/legal.ts` → "If Recore crashes"), and this file is what makes that
 * sentence true rather than aspirational:
 *
 *  · **No identity.** `sendDefaultPii` is off and `Sentry.setUser` is called
 *    nowhere in `src/`. A report is not attached to an account, an email or a
 *    name, which also means two reports from one person cannot be joined.
 *  · **No console breadcrumbs.** `devLog` is `__DEV__`-only, but a breadcrumb
 *    trail that echoes console output is exactly the channel a stray log of
 *    note text would escape through. Dropped at the source instead of trusted.
 *  · **No user, request or extra payloads**, stripped in `beforeSend` after
 *    every integration has had its turn — the last word belongs to this file.
 *  · **No sessions and no tracing.** Session tracking would send an event every
 *    time Recore opened, and performance tracing would send one per screen;
 *    both are traffic about a person who has not crashed. `tracesSampleRate: 0`
 *    and `enableAutoSessionTracking: false` keep the promise narrow: something
 *    broke, or nothing is sent.
 *
 * ## It is off unless a DSN is compiled in
 *
 * `EXPO_PUBLIC_SENTRY_DSN` empty — the default in `.env.example` — means
 * `init` never runs and every export below returns immediately. Nothing about
 * the app changes, nothing is queued, and no network call is made. The
 * `environment` tag carries `EXPO_PUBLIC_ENV`, so a developer can point a dev
 * build at the same project and still tell the two apart.
 *
 * Nothing in this file may ever block a screen, a keystroke or a workout
 * finish (CLAUDE.md §2 invariant 1): every call is fire-and-forget, and the
 * failure mode of the whole module is silence.
 */

let ready = false;

/**
 * Start crash reporting. Called once, at module scope in `app/_layout.tsx`, so
 * an error thrown while the first screen renders is already covered.
 */
export function initCrashReporting(): void {
  if (ready || SENTRY_DSN.length === 0) return;
  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: APP_ENV,
      sendDefaultPii: false,
      enableAutoSessionTracking: false,
      tracesSampleRate: 0,
      maxBreadcrumbs: 30,
      beforeBreadcrumb: (breadcrumb) => (breadcrumb.category === 'console' ? null : breadcrumb),
      beforeSend: (event) => {
        delete event.user;
        delete event.request;
        delete event.extra;
        return event;
      },
    });
    ready = true;
  } catch {
    // A reporter that breaks the app it reports on is worse than no reporter.
  }
}

/** Is a report actually going anywhere? Read by the honesty of nothing else. */
export function isCrashReportingReady(): boolean {
  return ready;
}

/**
 * Report an error the app already handled — today, the one the root
 * `ErrorBoundary` caught. React swallows a render error into the boundary, so
 * the global handler never sees it; without this call the one crash a user
 * actually looks at would be the one crash we never hear about.
 */
export function reportCrash(error: unknown, where: string): void {
  if (!ready) return;
  try {
    Sentry.captureException(error, { tags: { where } });
  } catch {
    // ignored — see the header
  }
}

/**
 * Wrap the root component so unhandled JS errors and native crashes are
 * attributed to this app rather than to an anonymous bundle. A pass-through
 * when there is no DSN, so an unconfigured build has no extra layer in its
 * tree at all.
 */
export function wrapRoot(Component: ComponentType): ComponentType {
  return ready ? (Sentry.wrap(Component) as ComponentType) : Component;
}
