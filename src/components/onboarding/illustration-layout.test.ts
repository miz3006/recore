import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  ILLUSTRATION_LAYOUT,
  ILLUSTRATION_SLUGS,
  MAX_SAFE_SCALE,
  MAX_SCALE,
  MIN_SCALE,
  ONBOARDING_SLUGS,
  SLUGS_WITHOUT_ARTWORK,
  hasArtwork,
  layoutFor,
} from './illustration-layout.ts';

/**
 * Manifest completeness (spec §G). The point of these is that the flow's own
 * config is the input: a screen added to `STEPS` without a manifest entry fails
 * here, rather than shipping as an illustration nobody notices is missing.
 *
 * `config.ts` imports RN-only modules and cannot be loaded by the node test
 * runner, so its slugs are read out of the source text. That is on purpose —
 * reading the file keeps this test honest about the real config instead of
 * asserting a hand-kept list against itself.
 */
const CONFIG = readFileSync(path.join(import.meta.dirname, 'config.ts'), 'utf8');

function configSlugs(): string[] {
  return [...CONFIG.matchAll(/^\s*slug: '([a-z-]+)',$/gm)].map((m) => m[1]!);
}

test('every slug in the onboarding flow config has a manifest entry', () => {
  const slugs = configSlugs();
  // Fourteen since the v3 design import (18 Aug 2026) — CLAUDE.md §6 step 2's
  // "fourteen-screen personalised funnel". The floor is here to catch a regex
  // that has stopped matching the config, not to freeze the flow's length.
  assert.ok(slugs.length >= 14, `expected the whole flow, read ${slugs.length} slugs`);
  for (const slug of slugs) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(ILLUSTRATION_LAYOUT, slug),
      `config screen "${slug}" has no illustration manifest entry`,
    );
  }
});

test('the slug list and the flow config carry exactly the same screens', () => {
  assert.deepEqual([...ONBOARDING_SLUGS].sort(), [...new Set(configSlugs())].sort());
});

test('the manifest is total over every slug it declares', () => {
  for (const slug of ILLUSTRATION_SLUGS) {
    assert.ok(ILLUSTRATION_LAYOUT[slug], `manifest is missing "${slug}"`);
  }
  assert.equal(Object.keys(ILLUSTRATION_LAYOUT).length, ILLUSTRATION_SLUGS.length);
});

test('scale values stay within 0.5–1.5, and offsets are finite points', () => {
  for (const [slug, layout] of Object.entries(ILLUSTRATION_LAYOUT)) {
    assert.ok(
      layout.scale >= MIN_SCALE && layout.scale <= MAX_SCALE,
      `${slug} scale ${layout.scale} is outside ${MIN_SCALE}–${MAX_SCALE}`,
    );
    assert.ok(Number.isFinite(layout.offsetX), `${slug} offsetX is not a number`);
    assert.ok(Number.isFinite(layout.offsetY), `${slug} offsetY is not a number`);
  }
  assert.equal(MIN_SCALE, 0.5);
  assert.equal(MAX_SCALE, 1.5);
});

test('no scale may push an illustration off the screen', () => {
  // `contain` fits the artwork to the text column, so `window / column` is the
  // scale at which its edges reach the glass. Worst on the widest phone —
  // which is how `key-lift` shipped at 1.14 with its plates cut off flat on a
  // Pro Max (14 Aug 2026).
  const PAGE_PADDING = 24;
  const widest = Math.min(...[375, 393, 430].map((w) => w / (w - 2 * PAGE_PADDING)));
  assert.ok(MAX_SAFE_SCALE <= widest, `${MAX_SAFE_SCALE} clips on a ${430} pt device`);

  for (const [slug, layout] of Object.entries(ILLUSTRATION_LAYOUT)) {
    assert.ok(
      layout.scale <= MAX_SAFE_SCALE,
      `${slug} at ${layout.scale} runs past the screen edge on a wide phone`,
    );
  }
});

test('the manifest leaves `contain` alone until an asset argues otherwise', () => {
  // Nothing deviates today: scaling the two wide compositions up to band height
  // made them bigger without making their FIGURES match, and clipped one of
  // them. The fields stay for a drawing that earns them; the empty list is the
  // finding, not an oversight.
  const adjusted = Object.entries(ILLUSTRATION_LAYOUT)
    .filter(([, l]) => l.scale !== 1 || l.offsetX !== 0 || l.offsetY !== 0)
    .map(([slug]) => slug);
  assert.deepEqual(adjusted, []);
});

test('a screen that will never have artwork reserves nothing', () => {
  for (const slug of SLUGS_WITHOUT_ARTWORK) {
    assert.equal(hasArtwork(slug), false, `${slug} still draws a placeholder box`);
  }
  for (const slug of ONBOARDING_SLUGS) {
    if (SLUGS_WITHOUT_ARTWORK.includes(slug)) continue;
    assert.equal(hasArtwork(slug), true, `${slug} would render nothing at all`);
  }
  // An asset that simply has not landed yet still shows the box that says so.
  assert.equal(hasArtwork('not-a-screen'), true);
});

test('the artwork-free screens are named, so a missing asset is never a surprise', () => {
  for (const slug of SLUGS_WITHOUT_ARTWORK) {
    assert.ok(ONBOARDING_SLUGS.includes(slug), `${slug} is not a screen of the flow`);
    assert.deepEqual(layoutFor(slug), { scale: 1, offsetX: 0, offsetY: 0 });
  }
});

test('an unknown slug is drawn as-is rather than crashing the screen', () => {
  assert.deepEqual(layoutFor('not-a-screen'), { scale: 1, offsetX: 0, offsetY: 0 });
});
