import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  applyResult,
  blockLines,
  EMPTY_BLOCK,
  LINE_PAUSE_MS,
  matchLocale,
  splitOnPauses,
  stripStopPhrase,
  type VoiceSegment,
} from './voice-lines.ts';

/** Words at a normal speaking pace — ~120 ms of sound, ~80 ms between them. */
function say(words: string[], from: number): { segments: VoiceSegment[]; end: number } {
  let at = from;
  const segments = words.map((text) => {
    const seg = { startMs: at, endMs: at + 120, text };
    at += 200;
    return seg;
  });
  return { segments, end: at - 200 + 120 };
}

test('a phrase spoken without pauses is one line', () => {
  const { segments } = say(['bench', 'press', '100', 'times', '5'], 0);
  assert.deepEqual(splitOnPauses(segments), ['bench press 100 times 5']);
});

test('a pause between exercises breaks the line — the reported bug', () => {
  // This is the owner's complaint in miniature: the second exercise used to be
  // appended to the first line because the recogniser hands back one transcript.
  const first = say(['bench', '100', 'times', '5'], 0);
  const second = say(['squat', '140', 'times', '3'], first.end + LINE_PAUSE_MS + 200);
  assert.deepEqual(splitOnPauses([...first.segments, ...second.segments]), [
    'bench 100 times 5',
    'squat 140 times 3',
  ]);
});

test('a gap shorter than the threshold does not break the line', () => {
  const first = say(['bench', '100'], 0);
  const second = say(['times', '5'], first.end + LINE_PAUSE_MS - 100);
  assert.deepEqual(splitOnPauses([...first.segments, ...second.segments]), ['bench 100 times 5']);
});

test('segments with no usable timings degrade to one line, never invented breaks', () => {
  const segments = ['bench', '100', 'times', '5'].map((text) => ({
    startMs: 0,
    endMs: 0,
    text,
  }));
  assert.deepEqual(splitOnPauses(segments), ['bench 100 times 5']);
});

test('empty and blank segments are dropped', () => {
  assert.deepEqual(splitOnPauses([]), []);
  assert.deepEqual(splitOnPauses([{ startMs: 0, endMs: 100, text: '   ' }]), []);
});

test('"done" on its own line ends the session and is not written down', () => {
  const out = stripStopPhrase(['bench 100 times 5', 'Done.']);
  assert.equal(out.stopped, true);
  assert.deepEqual(out.lines, ['bench 100 times 5']);
});

test('"that\'s it" ends the session, curly apostrophe included', () => {
  for (const said of ["That's it", 'That’s it.', 'that is it']) {
    const out = stripStopPhrase(['squat 140', said]);
    assert.equal(out.stopped, true, said);
    assert.deepEqual(out.lines, ['squat 140'], said);
  }
});

test('the spoken exit works in the languages people here train in', () => {
  const said = [
    // Slovene — the owner's own, and the one Apple cannot dictate at all
    'Konec.',
    'to je to',
    'Končaj',
    'zaključi',
    'ustavi snemanje',
    // Croatian / Serbian
    'završi',
    'gotovo',
    'kraj',
    // German
    "Das war's",
    'fertig',
    'Aufnahme stoppen',
    // Italian
    'basta così',
    'ho finito',
    'fatto',
  ];
  for (const word of said) {
    const out = stripStopPhrase(['bench 100 times 5', word]);
    assert.equal(out.stopped, true, word);
    assert.deepEqual(out.lines, ['bench 100 times 5'], word);
  }
});

test('a recogniser that drops the diacritics still hears the exit', () => {
  // An English recogniser transcribing Slovene will not produce "č" — the
  // whole point of folding, since Slovene has no recogniser of its own.
  for (const word of ['koncaj', 'zakljuci', 'zavrsi', 'basta cosi', 'KONEC']) {
    assert.equal(stripStopPhrase(['squat 140', word]).stopped, true, word);
  }
});

test('ordinary workout words are NOT exits, however close they sound', () => {
  // Left out of the list on purpose: the record is the source of truth, and a
  // remark cut short costs more than a command the button can give instead.
  for (const line of ['to je bilo dovolj', 'dosta', 'bilo je gotovo enostavno prelahko']) {
    const out = stripStopPhrase(['bench 100', line]);
    assert.equal(out.stopped, false, line);
    assert.deepEqual(out.lines, ['bench 100', line], line);
  }
});

test('a command keeps the rest of its line intact, accents and all', () => {
  const out = stripStopPhrase(['počep 140 krat 3, težko — konec']);
  assert.equal(out.stopped, true);
  assert.deepEqual(out.lines, ['počep 140 krat 3, težko —']);
});

test('a command at the end of a real line is cut off, and the line keeps its casing', () => {
  const out = stripStopPhrase(['Bench Press 100 times 5 done']);
  assert.equal(out.stopped, true);
  assert.deepEqual(out.lines, ['Bench Press 100 times 5']);
});

test('a lift whose name merely contains a stop word keeps dictating', () => {
  const out = stripStopPhrase(['bench 100 times 5', 'done 3 sets of squats']);
  assert.equal(out.stopped, false);
  assert.deepEqual(out.lines, ['bench 100 times 5', 'done 3 sets of squats']);
});

test('interim results replace the live utterance instead of stacking', () => {
  let block = applyResult(EMPTY_BLOCK, { lines: ['bench'], final: false });
  block = applyResult(block, { lines: ['bench 100'], final: false });
  block = applyResult(block, { lines: ['bench 100 times 5'], final: false });
  assert.deepEqual(blockLines(block), ['bench 100 times 5']);
});

test('a final result settles the utterance and the next one starts a new line', () => {
  let block = applyResult(EMPTY_BLOCK, { lines: ['bench 100 times 5'], final: true });
  block = applyResult(block, { lines: ['squat 140'], final: false });
  assert.deepEqual(blockLines(block), ['bench 100 times 5', 'squat 140']);
  block = applyResult(block, { lines: ['squat 140 times 3'], final: true });
  assert.deepEqual(blockLines(block), ['bench 100 times 5', 'squat 140 times 3']);
});

test('the closing result on older iOS repeats the session and must not print it twice', () => {
  // iOS 17 in continuous mode never finalises until stop(), then hands back the
  // whole session again. Appending it would write the workout out a second time.
  let block = applyResult(EMPTY_BLOCK, { lines: ['bench 100', 'squat 140'], final: true });
  block = applyResult(block, { lines: ['bench 100', 'squat 140', 'row 60'], final: true });
  assert.deepEqual(blockLines(block), ['bench 100', 'squat 140', 'row 60']);
});

test('an empty final result leaves what was already settled alone', () => {
  let block = applyResult(EMPTY_BLOCK, { lines: ['bench 100'], final: true });
  block = applyResult(block, { lines: ['   '], final: true });
  assert.deepEqual(blockLines(block), ['bench 100']);
});

/**
 * The 63 locales iOS 26.5 actually reported on 17 September 2026. Slovene is
 * not among them and that is the point of every test below.
 */
const APPLE = `ar-SA ca-ES cs-CZ da-DK de-AT de-CH de-DE el-GR en-AE en-AU en-CA en-GB en-ID en-IE
en-IN en-NZ en-PH en-SA en-SG en-US en-ZA es-419 es-CL es-CO es-ES es-MX es-US fi-FI fr-BE fr-CA
fr-CH fr-FR he-IL hi-IN hi-IN-translit hi-Latn hr-HR hu-HU id-ID it-CH it-IT ja-JP ko-KR ms-MY
nb-NO nl-BE nl-NL pl-PL pt-BR pt-PT ro-RO ru-RU sk-SK sv-SE th-TH tr-TR uk-UA vi-VN wuu-CN yue-CN
zh-CN zh-HK zh-TW`.split(/\s+/);

test('Apple has no Slovene recogniser, so a Slovene phone gets no match', () => {
  assert.equal(APPLE.length, 63);
  assert.equal(matchLocale('sl-SI', APPLE), null);
  assert.equal(matchLocale('sl', APPLE), null);
});

test('a supported language is used even when the region is not the exact one', () => {
  // A phone set to de-LU is a German phone; de-AT is a better recogniser for it
  // than English is, and Apple lists no de-LU.
  assert.equal(matchLocale('de-LU', APPLE), 'de-AT');
  assert.equal(matchLocale('hr-HR', APPLE), 'hr-HR');
  assert.equal(matchLocale('en-GB', APPLE), 'en-GB');
  assert.equal(matchLocale('sl', APPLE), null);
});

test('underscores and casing from the platform do not defeat the match', () => {
  assert.equal(matchLocale('pt_BR', APPLE), 'pt-BR');
  assert.equal(matchLocale('IT-it', APPLE), 'it-IT');
});

test('nothing supported and nothing nonsensical matches', () => {
  assert.equal(matchLocale('xx-YY', APPLE), null);
  assert.equal(matchLocale('', APPLE), null);
  assert.equal(matchLocale('en-US', []), null);
});
