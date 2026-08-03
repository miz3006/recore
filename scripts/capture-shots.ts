/**
 * Capture the three onboarding screenshots from a running simulator
 * (CLAUDE.md §11.0.1c, `src/lib/onboarding-shots.ts`).
 *
 * That file spells out the procedure by hand: run the app, put it in a state,
 * take a capture, save it under the right name, uncomment a `require`. Every
 * step of that except *putting the app in the state* is mechanical, and the
 * mechanical part is where a stale or mis-shaped picture comes from — a wrong
 * device, an iPad ratio, a file in the wrong place, a `require` left commented
 * so the funnel silently keeps rendering the live fallback.
 *
 * So this script owns the mechanical part and NOTHING else:
 *
 *     node scripts/capture-shots.ts                 # status — what exists, what doesn't
 *     node scripts/capture-shots.ts compose         # capture, validate, wire up
 *     node scripts/capture-shots.ts plan --delay 8  # 8s to navigate before the shutter
 *     node scripts/capture-shots.ts ready --device "iPhone 17 Pro"
 *
 * WHAT IT WILL NOT DO. It never invents a picture. §11.0.1c's two rules for the
 * capture itself — a real session and nothing personal in frame — are the
 * owner's to keep, because they are about what is ON the screen and this script
 * cannot know that. These images sit one step from the paywall whose fabricated
 * proof was deleted on 28 July (§12.1); a staged screenshot would put it back.
 *
 * WHY iOS 26 BY DEFAULT. The tab bar in frame is the system Liquid Glass bar
 * (§4), which only exists on iOS 26. A capture from an iOS 18 runtime shows a
 * flat bar the shipped app does not have, which makes the picture a lie about
 * the product in the most boring possible way.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

// TYPE-ONLY, and that is load-bearing: the moment a shot is wired,
// `onboarding-shots.ts` contains a live `require`, which node cannot evaluate in
// an ES module — so importing it for its VALUES would make this script crash
// exactly when a capture exists, including on `--clear`, the one command that
// undoes it. Metro compiles that `require` fine; node does not. Wiring is read
// out of the source text below instead.
import type { OnboardingShot } from '../src/lib/onboarding-shots.ts';

const OUT_DIR = 'assets/onboarding';
const SHOTS_MODULE = 'src/lib/onboarding-shots.ts';
const BUNDLE_ID = 'com.recore.app';

/** The runtime the shipped tab bar actually looks like, and a good phone on it. */
const PREFERRED_DEVICE = 'iPhone 17 Pro';
const PREFERRED_RUNTIME = /iOS-26/;

/** `DeviceFrame`'s `SHOT_ASPECT` — 9:19.5. A capture wider than this is an iPad
 * or a landscape shot and will be cropped into nonsense by `resizeMode="cover"`. */
const TARGET_ASPECT = 9 / 19.5;
const ASPECT_TOLERANCE = 0.02;

/** What each shot has to be showing. Printed before the shutter, every time. */
const BRIEF: Record<OnboardingShot, string> = {
  compose:
    'Today, mid-session: three or four settled cards, the readings on the right, ' +
    'the keyboard UP so the glass accessory bar is in frame. ' +
    'Turn OFF I/O → Keyboard → Connect Hardware Keyboard (⇧⌘K) first — with it on, ' +
    'the software keyboard never draws and the glass bar has nothing behind it to ' +
    'refract (§5.5b), which is the one thing this shot is for.',
  plan: 'Next, with a real briefing: the paragraph, and prescribed values in green.',
  ready: 'A finished session — the receipt, with its counted exercises, sets and load.',
};

const ORDER: OnboardingShot[] = ['compose', 'plan', 'ready'];

function simctl(...args: string[]): string {
  return execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8' });
}

/** Width/height straight out of the PNG's IHDR — no image library needed. */
function pngSize(path: string): { w: number; h: number } | null {
  const b = readFileSync(path);
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

interface Device {
  udid: string;
  name: string;
  state: string;
  runtime: string;
}

function devices(): Device[] {
  const json = JSON.parse(simctl('list', 'devices', 'available', '-j')) as {
    devices: Record<string, { udid: string; name: string; state: string }[]>;
  };
  return Object.entries(json.devices).flatMap(([runtime, list]) =>
    list.map((d) => ({ ...d, runtime })),
  );
}

/** A booted simulator wins — if the owner already has the app open in one, that
 * is the one they are looking at. Otherwise boot the preferred phone. */
function resolveDevice(wanted: string | null): Device {
  const all = devices();
  const booted = all.filter((d) => d.state === 'Booted' && !/iPad/i.test(d.name));

  if (wanted) {
    const match = all.find((d) => d.name === wanted && PREFERRED_RUNTIME.test(d.runtime))
      ?? all.find((d) => d.name === wanted);
    if (!match) throw new Error(`No available simulator named "${wanted}".`);
    return match;
  }
  if (booted.length === 1) return booted[0]!;
  if (booted.length > 1) {
    throw new Error(
      `More than one simulator is booted:\n` +
        booted.map((d) => `  · ${d.name} (${d.udid})`).join('\n') +
        `\nPass --device "<name>" so the shutter cannot pick the wrong screen.`,
    );
  }
  const fresh =
    all.find((d) => d.name === PREFERRED_DEVICE && PREFERRED_RUNTIME.test(d.runtime)) ??
    all.find((d) => PREFERRED_RUNTIME.test(d.runtime) && !/iPad/i.test(d.name));
  if (!fresh) {
    throw new Error(
      'No iOS 26 iPhone simulator is available. Install one in Xcode → Settings → Components, ' +
        'or pass --device with a phone you do have (the tab bar will not be Liquid Glass).',
    );
  }
  return fresh;
}

function boot(d: Device): void {
  if (d.state !== 'Booted') {
    process.stdout.write(`Booting ${d.name}…\n`);
    simctl('boot', d.udid);
  }
  execFileSync('open', ['-a', 'Simulator', '--args', '-CurrentDeviceUDID', d.udid]);
}

function appInstalled(d: Device): boolean {
  try {
    simctl('get_app_container', d.udid, BUNDLE_ID);
    return true;
  } catch {
    return false;
  }
}

/**
 * Flip one entry in `onboarding-shots.ts` between `null` and its `require`.
 *
 * It has to be an edit rather than a runtime lookup because Metro resolves
 * `require` statically — a path built at runtime does not bundle, and a
 * `require` of a file that is not there breaks the build. So the file carries
 * both lines and exactly one of them is live.
 */
function setWired(key: OnboardingShot, on: boolean): void {
  const src = readFileSync(SHOTS_MODULE, 'utf8');
  const req = `require('../../assets/onboarding/${key}.png')`;
  // Either shape, whichever the file is currently in.
  const block = new RegExp(
    `[ \\t]*(?://[ \\t]*)?${key}: (?:null|require\\([^)]*\\)),\\n(?:[ \\t]*(?://[ \\t]*)?${key}: (?:null|require\\([^)]*\\)),\\n)?`,
  );
  if (!block.test(src)) {
    throw new Error(`Could not find the "${key}" entry in ${SHOTS_MODULE} — edit it by hand.`);
  }
  const next = on
    ? `  ${key}: ${req},\n`
    : `  // ${key}: ${req},\n  ${key}: null,\n`;
  writeFileSync(SHOTS_MODULE, src.replace(block, next));
}

/** Is this key's `require` the live line, rather than the commented one? */
function isWired(key: OnboardingShot): boolean {
  const src = readFileSync(SHOTS_MODULE, 'utf8');
  return new RegExp(`^[ \\t]*${key}: require\\(`, 'm').test(src);
}

function status(): void {
  process.stdout.write('\nonboarding shots\n');
  for (const key of ORDER) {
    const file = `${OUT_DIR}/${key}.png`;
    const onDisk = existsSync(file);
    const size = onDisk ? pngSize(file) : null;
    const wired = isWired(key);
    const mark = onDisk && wired ? '●' : onDisk ? '◐' : '○';
    const detail = !onDisk
      ? 'no capture — the step renders its live composition'
      : `${size ? `${size.w}×${size.h}` : 'unreadable'}${wired ? '' : ' — ON DISK BUT NOT WIRED'}`;
    process.stdout.write(`  ${mark} ${key.padEnd(8)} ${detail}\n`);
  }
  process.stdout.write(
    `\n  ● wired  ◐ on disk only  ○ none\n` +
      `  node scripts/capture-shots.ts <${ORDER.join('|')}> [--delay N] [--device "name"]\n\n`,
  );
}

function sleep(seconds: number): void {
  if (seconds > 0) execFileSync('sleep', [String(seconds)]);
}

/**
 * Delete a shot and put the entry back to `null` — the way out of a bad capture.
 *
 * It exists because the shutter has no undo otherwise: a mistimed shot is
 * written AND wired in one go, and a wrong picture wired into the funnel is
 * worse than no picture, which is the whole premise of the `null` fallback.
 * Also the honest tool for the §11.0.1c case where a screen was redesigned and
 * the old capture should go dark until someone retakes it.
 */
function clear(key: OnboardingShot): void {
  const file = `${OUT_DIR}/${key}.png`;
  if (existsSync(file)) {
    rmSync(file);
    process.stdout.write(`Deleted ${file}\n`);
  } else {
    process.stdout.write(`No ${file} to delete.\n`);
  }
  setWired(key, false);
  process.stdout.write(
    `${key} is back to null — step renders its live composition again.\n`,
  );
}

function capture(key: OnboardingShot, delay: number, wanted: string | null): void {
  const device = resolveDevice(wanted);
  boot(device);

  if (!appInstalled(device)) {
    process.stdout.write(
      `\nRecore is not installed on ${device.name}.\n` +
        `  Run it once first:  npx expo run:ios --device "${device.name}"\n\n`,
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `\n${device.name} · ${device.runtime.replace(/.*SimRuntime\./, '')}\n` +
      `\nPut this on screen:\n  ${BRIEF[key]}\n` +
      `\nAnd keep §11.0.1c's two rules: a real session, nothing personal in frame.\n`,
  );
  if (delay > 0) process.stdout.write(`\nShutter in ${delay}s…\n`);
  sleep(delay);

  mkdirSync(OUT_DIR, { recursive: true });
  const file = `${OUT_DIR}/${key}.png`;
  simctl('io', device.udid, 'screenshot', file);

  const size = pngSize(file);
  if (!size) throw new Error(`${file} is not a readable PNG.`);
  const aspect = size.w / size.h;
  const off = Math.abs(aspect - TARGET_ASPECT);
  process.stdout.write(`\nWrote ${file} — ${size.w}×${size.h}\n`);
  if (size.w > size.h) {
    process.stdout.write('  ✗ Landscape. The frame is a portrait window; recapture.\n');
    process.exitCode = 1;
    return;
  }
  if (off > ASPECT_TOLERANCE) {
    process.stdout.write(
      `  ! Ratio ${aspect.toFixed(4)} vs the frame's ${TARGET_ASPECT.toFixed(4)}. ` +
        `"cover" will crop the difference — fine for a near miss, wrong for an iPad.\n`,
    );
  }

  setWired(key, true);
  process.stdout.write(`  Wired up in ${SHOTS_MODULE}.\n`);
  process.stdout.write(
    `\nNow: npm run typecheck && npx expo export --platform ios\n` +
      `Recapture this shot whenever the screen in it is redesigned (§11.0.1c).\n\n`,
  );
}

// --- args ---------------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name: string): string | null => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? (argv[i + 1] ?? null) : null;
};
const positional = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const key = positional[0] as OnboardingShot | undefined;

if (!key) {
  status();
} else if (!ORDER.includes(key)) {
  process.stderr.write(`Unknown shot "${key}". One of: ${ORDER.join(', ')}\n`);
  process.exitCode = 1;
} else if (argv.includes('--clear')) {
  clear(key);
} else {
  capture(key, Number.parseInt(flag('delay') ?? '0', 10) || 0, flag('device'));
}
