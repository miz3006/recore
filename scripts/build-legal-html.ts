/**
 * Write the legal documents to `docs/` as static HTML (PLAN A3 step 2).
 *
 * App Store Connect requires a PUBLIC privacy-policy URL in the metadata and a
 * terms/EULA URL on the subscription, and neither field accepts "it's a screen
 * in the app". So the same text `app/legal.tsx` renders is written out here,
 * from the same source (`src/lib/legal.ts`), and the owner publishes `docs/`
 * as a GitHub Pages site (Settings → Pages → main /docs).
 *
 * ONE SOURCE, TWO SURFACES. If these were written twice they would disagree,
 * and a privacy policy that disagrees with itself is worse than none.
 *
 *     node scripts/build-legal-html.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';

import { LEGAL_DOCS, type LegalDoc } from '../src/lib/legal.ts';

const OUT = 'docs';

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Same paper and ink as `src/lib/theme/color.ts`. Light only, like the app. */
const CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 48px 24px 96px;
    background: #F4F5EF;
    color: #171914;
    font: 400 17px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  main { max-width: 40rem; margin: 0 auto; }
  h1 { font-size: 2rem; line-height: 1.15; letter-spacing: -0.02em; margin: 0 0 .25rem; }
  .updated {
    font: 600 .75rem/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: .12em; text-transform: uppercase; color: #9AA093; margin: 0 0 2rem;
  }
  .intro { font-size: 1.0625rem; color: #171914; margin: 0 0 3rem; }
  h2 {
    font: 600 .75rem/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: .12em; text-transform: uppercase; color: #687064;
    margin: 3rem 0 .75rem;
  }
  p, li { color: #687064; margin: 0 0 .9rem; }
  ul { margin: 0 0 .9rem; padding-left: 1.1rem; }
  a { color: #171914; }
  nav { margin-top: 4rem; padding-top: 1.5rem; border-top: 1px solid #D4D7CC; }
  nav a { display: inline-block; margin-right: 1.25rem; padding: .5rem 0; font-size: .9375rem; }
  footer { margin-top: 3rem; font-size: .8125rem; color: #9AA093; }
`;

function renderBody(doc: LegalDoc): string {
  const out: string[] = [];
  for (const section of doc.sections) {
    out.push(`<h2>${escapeHtml(section.heading)}</h2>`);
    let bullets: string[] = [];
    const flushBullets = () => {
      if (bullets.length === 0) return;
      out.push(`<ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>`);
      bullets = [];
    };
    for (const line of section.body) {
      if (line.startsWith('· ')) {
        bullets.push(escapeHtml(line.slice(2)));
        continue;
      }
      flushBullets();
      if (line.startsWith('http')) {
        const url = escapeHtml(line);
        out.push(`<p><a href="${url}">${url}</a></p>`);
      } else {
        out.push(`<p>${escapeHtml(line)}</p>`);
      }
    }
    flushBullets();
    for (const link of section.links ?? []) {
      const href = link.url ? escapeHtml(link.url) : `./${link.doc}.html`;
      out.push(`<p><a href="${href}">${escapeHtml(link.label)} →</a></p>`);
    }
  }
  return out.join('\n');
}

function page(doc: LegalDoc): string {
  const others = Object.values(LEGAL_DOCS).filter((d) => d.id !== doc.id);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Recore — ${escapeHtml(doc.title)}</title>
<style>${CSS}</style>
</head>
<body>
<main>
  <h1>${escapeHtml(doc.title)}</h1>
  <p class="updated">Recore · last updated ${escapeHtml(doc.updated)}</p>
  <p class="intro">${escapeHtml(doc.intro)}</p>
  ${renderBody(doc)}
  <nav>${others.map((d) => `<a href="./${d.id}.html">${escapeHtml(d.title)}</a>`).join('')}</nav>
  <footer>These pages are generated from the app's own source, so they say exactly what the app says.</footer>
</main>
</body>
</html>
`;
}

function index(): string {
  const links = Object.values(LEGAL_DOCS)
    .map((d) => `<p><a href="./${d.id}.html">${escapeHtml(d.title)} →</a></p>`)
    .join('\n  ');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Recore</title>
<style>${CSS}</style>
</head>
<body>
<main>
  <h1>Recore</h1>
  <p class="updated">A training log you write in</p>
  <p class="intro">Open it, type what you did in your own words, and it keeps the record.</p>
  ${links}
</main>
</body>
</html>
`;
}

mkdirSync(OUT, { recursive: true });
for (const doc of Object.values(LEGAL_DOCS)) {
  writeFileSync(`${OUT}/${doc.id}.html`, page(doc));
  console.log(`wrote ${OUT}/${doc.id}.html`);
}
writeFileSync(`${OUT}/index.html`, index());
console.log(`wrote ${OUT}/index.html`);
