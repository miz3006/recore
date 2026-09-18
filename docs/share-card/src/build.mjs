import { writeFileSync } from 'node:fs';

/* The Recore mark, path verbatim from src/components/brand-mark.tsx.
   495 × 594 — taller than wide; height drives, width follows. */
const MARK_PATH =
  'M168.277 0C261.214 0 336.555 75.3403 336.555 168.277C336.555 222.851 310.574 271.355 270.309 302.102L481.013 512.806C499.568 531.361 499.568 561.445 481.013 580C462.457 598.555 432.374 598.555 413.818 580L170.359 336.541C169.666 336.549 168.972 336.555 168.277 336.555C142.022 336.555 117.172 330.54 95.0273 319.816V546.406C95.0273 572.647 73.7547 593.92 47.5137 593.92C21.2726 593.92 0 572.647 0 546.406V168.277C0 75.3403 75.3403 0 168.277 0ZM168.277 100.967C131.103 100.967 100.967 131.103 100.967 168.277C100.967 205.452 131.103 235.588 168.277 235.588C205.452 235.588 235.588 205.452 235.588 168.277C235.588 131.103 205.452 100.967 168.277 100.967Z';

const mark = (h = 36, tint = '#868782') =>
  `<svg width="${(h * 495) / 594}" height="${h}" viewBox="0 0 495 594"><path fill-rule="evenodd" clip-rule="evenodd" d="${MARK_PATH}" fill="${tint}"/></svg>`;

const grain = `<svg class="grain" xmlns="http://www.w3.org/2000/svg"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`;

/* The signature — the ONE lockup that pairs the mark WITH the word, for the
   reason session-receipt.tsx already states: this image lands in front of
   people who have never heard the name. */
const sig = `<div class="foot"><div class="sig">${mark(36)}<span class="word">Recore</span></div><div class="date">recore.app</div></div>`;

const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8">
<title>${title}</title><link rel="stylesheet" href="base.css"></head>
<body><div class="page">${grain}${body}</div></body></html>`;

/* groupThousands() from src/lib/parse/estimate.ts — COMMAS, not spaces. */
const kg = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/* Hero never wraps; the size steps down with the character count instead. */
const heroClass = (s) => (s.length >= 6 ? 'hero d6' : s.length >= 5 ? 'hero d5' : 'hero');

/* setsLineText()'s voice, from src/lib/parse/receipt.ts: LOAD first, then the
   reps of every working set separated by "·" — never a collapsed top set. */
const sets = (load, reps) =>
  `${load} kg <span class="x">×</span> ${reps.join('<span class="x">·</span>')}`;

/* ══════════════════════════════════════════════════════════════════
   A — THE SESSION.  One training, printed.
   volume/sets → ReceiptData · rows → ReceiptData.rows · minutes →
   workouts.created_at→updated_at · PR → getAllTimePRs (isBaseline guarded) ·
   the comparison → getStatsSummary · the quote → getReflection(workoutId).
   ══════════════════════════════════════════════════════════════════ */
writeFileSync(
  'a-session.html',
  page(
    'Session',
    `
  <div class="eyebrow">Recorded &nbsp;<span class="dim">·</span>&nbsp; Tue 15 Sep</div>

  <div>
    <div class="${heroClass(kg(7640))}">${kg(7640)}<span class="unit">kg</span></div>
    <div class="body-line">Your heaviest session on record.<br>
      The one it passed, in June, was <b>${kg(7010)} kg</b>.</div>
  </div>

  <div>
    <div class="rule"></div>
    <div class="record" style="margin-top:52px">
      <div class="row"><span class="name">Back Squat</span>
        <span class="pr">Personal record</span>
        <span class="val">${sets(100, [5, 5, 5])}</span></div>
      <div class="row"><span class="name">Bench Press</span>
        <span class="val">${sets(80, [8, 8, 8])}</span></div>
      <div class="row"><span class="name">Barbell Row</span>
        <span class="val">${sets(70, [10, 10, 10])}</span></div>
      <div class="row"><span class="name">Romanian Deadlift</span>
        <span class="val">${sets(90, [8, 8, 8])}</span></div>
    </div>
    <div class="rule" style="margin-top:52px"></div>
    <div class="stats" style="margin-top:48px">
      <div class="stat"><div class="n">12</div><div class="l">working sets</div></div>
      <div class="stat"><div class="n">4</div><div class="l">lifts</div></div>
      <div class="stat"><div class="n">58</div><div class="l">minutes</div></div>
    </div>
  </div>

  <div class="quote">“Bar moved fast on all three sets. Could have taken 105.”
    <span class="who">Your check-in, 18:59</span></div>

  ${sig}`,
  ),
);

/* ══════════════════════════════════════════════════════════════════
   B — THE WEEK.  getStatsSummary() gives all of it.
   ══════════════════════════════════════════════════════════════════ */
const week = [
  { d: 'M', v: 0 },
  { d: 'T', v: 7640, peak: true },
  { d: 'W', v: 0 },
  { d: 'T', v: 5980 },
  { d: 'F', v: 6420 },
  { d: 'S', v: 0 },
  { d: 'S', v: 5230 },
];
const max = Math.max(...week.map((w) => w.v));
const bars = week
  .map(
    (w) =>
      `<div class="bar ${w.peak ? 'peak' : w.v === 0 ? 'rest' : ''}">
       <div class="fill" style="height:${w.v === 0 ? 8 : Math.round((w.v / max) * 372)}px"></div>
       <div class="d">${w.d}</div></div>`,
  )
  .join('');

writeFileSync(
  'b-week.html',
  page(
    'Week',
    `
  <div class="eyebrow">Week of &nbsp;<span class="dim">·</span>&nbsp; 8–14 Sep</div>

  <div>
    <div class="${heroClass(kg(25270))}">${kg(25270)}<span class="unit">kg</span></div>
    <div class="body-line">Across <b>4 sessions</b>, in 3 h 41 min.<br>
      Up <b>12%</b> on the week before.</div>
  </div>

  <div class="bars">${bars}</div>

  <div>
    <div class="rule"></div>
    <div class="record" style="margin-top:48px">
      <div class="row"><span class="name">Back Squat</span>
        <span class="pr">Personal record</span>
        <span class="val">${sets(100, [5, 5, 5])}</span></div>
      <div class="row quiet"><span class="name">Heaviest day</span>
        <span class="val">Tuesday <span class="x">·</span> ${kg(7640)} kg</span></div>
    </div>
  </div>

  ${sig}`,
  ),
);

/* ══════════════════════════════════════════════════════════════════
   C — THE MONTH.  getLoggedDayKeys() + getAllTimePRs().
   The most scroll-stopping of the four, and the cheapest to compute.
   ══════════════════════════════════════════════════════════════════ */
// 1 Sep 2026 is a Tuesday → one leading pad cell. 30 days.
const trained = new Set([1, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19, 21, 22, 24, 26, 28, 29]);
const prDays = new Set([15, 26]);
let cells = '<div class="cell pad"></div>';
for (let d = 1; d <= 30; d++) {
  cells += `<div class="${prDays.has(d) ? 'cell pr' : trained.has(d) ? 'cell on' : 'cell'}"></div>`;
}

writeFileSync(
  'c-month.html',
  page(
    'Month',
    `
  <div class="eyebrow">September &nbsp;<span class="dim">·</span>&nbsp; 2026</div>

  <div>
    <div class="hero small">17<span class="unit">days trained</span></div>
    <div class="body-line">Out of 30. Your steadiest month<br>
      since you started in <b>March</b>.</div>
  </div>

  <div>
    <div class="gridhead"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>
    <div class="grid">${cells}</div>
    <div class="legend"><span class="key"><i class="sw on"></i>trained</span>
      <span class="key"><i class="sw pr"></i>personal record</span></div>
  </div>

  <div>
    <div class="rule"></div>
    <div class="stats" style="margin-top:48px">
      <div class="stat"><div class="n">${kg(104900)}</div><div class="l">kg moved</div></div>
      <div class="stat"><div class="n">2</div><div class="l">personal records</div></div>
    </div>
  </div>

  ${sig}`,
  ),
);

/* ══════════════════════════════════════════════════════════════════
   D — THE LIFT.  getAllTimePRs() + getE1rmSeries(). The brag card —
   and the only one that spends the blue.
   ══════════════════════════════════════════════════════════════════ */
const series = [92, 95, 95, 97.5, 100, 100, 102.5, 105, 105, 107.5, 110, 115];
const W = 888,
  H = 260,
  lo = Math.min(...series),
  hi = Math.max(...series);
const pts = series.map((v, i) => [
  (i / (series.length - 1)) * W,
  H - 20 - ((v - lo) / (hi - lo)) * (H - 46),
]);
const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
const last = pts[pts.length - 1];

writeFileSync(
  'd-lift.html',
  page(
    'Lift',
    `
  <div class="eyebrow">Personal record &nbsp;<span class="dim">·</span>&nbsp; 15 Sep 2026</div>

  <div>
    <div class="lift-name">Back Squat</div>
    <div class="hero">115<span class="unit">kg × 3</span></div>
    <div class="body-line">The <b>110 kg</b> had stood since <b>4 May</b>.<br>
      Four months, eleven sessions, five kilos.</div>
  </div>

  <div>
    <div class="eyebrow" style="margin-bottom:26px">Estimated 1RM &nbsp;<span class="dim">·</span>&nbsp; 12 sessions</div>
    <svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <path d="${d}" fill="none" stroke="#007AFF" stroke-width="6"
            stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="13" fill="#007AFF"/>
    </svg>
  </div>

  <div>
    <div class="rule"></div>
    <div class="stats" style="margin-top:48px">
      <div class="stat"><div class="n">92 → 115</div><div class="l">kg, since March</div></div>
      <div class="stat"><div class="n">+25%</div><div class="l">in six months</div></div>
    </div>
  </div>

  ${sig}`,
  ),
);

console.log('4 cards written');
