import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { dayWorkoutId, sha1, uuidv5 } from './day-id.ts';

/**
 * A hand-written hash is only worth anything if it is checked against somebody
 * else's. These vectors come from FIPS 180-1 and RFC 4122, and the last test
 * compares against Node's own SHA-1 over random input — so a bug in the padding
 * or in the 64-byte block boundary cannot hide behind three short strings.
 */

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const utf8 = (s: string) => Uint8Array.from(Buffer.from(s, 'utf8'));

test('sha1 matches the FIPS 180-1 vectors', () => {
  assert.equal(toHex(sha1(utf8('abc'))), 'a9993e364706816aba3e25717850c26c9cd0d89d');
  assert.equal(
    toHex(sha1(utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))),
    '84983e441c3bd26ebaae4aa1f95129e5e54670f1',
  );
  assert.equal(toHex(sha1(utf8(''))), 'da39a3ee5e6b4b0d3255bfef95601890afd80709');
});

test('sha1 matches node across every padding case around a block boundary', () => {
  // 55/56/57 and 63/64/65 are where a length field spills into an extra block.
  for (const len of [0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 128, 1000]) {
    const bytes = Uint8Array.from({ length: len }, (_, i) => (i * 37 + 11) & 0xff);
    assert.equal(
      toHex(sha1(bytes)),
      createHash('sha1').update(Buffer.from(bytes)).digest('hex'),
      `length ${len}`,
    );
  }
});

test('uuidv5 matches the published DNS-namespace vector', () => {
  const DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  assert.equal(uuidv5('www.example.com', DNS), '2ed6657d-e927-568b-95e1-2665a8aea6a2');
});

test('uuidv5 sets version 5 and the RFC 4122 variant', () => {
  const id = uuidv5('anything at all');
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('uuidv5 survives non-ascii names', () => {
  // The day key and a user id are ascii, but a total function is cheaper to
  // keep than a comment saying it is not.
  assert.equal(uuidv5('trener ž 🏋'), uuidv5('trener ž 🏋'));
  assert.notEqual(uuidv5('trener ž 🏋'), uuidv5('trener z 🏋'));
});

test('one person and one day always name the same row', () => {
  const user = '48f9a486-6fd7-48d6-9eff-572decfeb411';
  assert.equal(dayWorkoutId(user, '2026-09-10'), dayWorkoutId(user, '2026-09-10'));
});

test('a different day, or a different person, is a different row', () => {
  const a = '48f9a486-6fd7-48d6-9eff-572decfeb411';
  const b = 'f4517373-45b8-467e-8201-44182881974e';
  assert.notEqual(dayWorkoutId(a, '2026-09-10'), dayWorkoutId(a, '2026-09-11'));
  assert.notEqual(dayWorkoutId(a, '2026-09-10'), dayWorkoutId(b, '2026-09-10'));
});

test('a thousand people over a year collide with nobody', () => {
  // The point of the id is that two DEVICES agree; the point of this test is
  // that two DAYS never do.
  const seen = new Set<string>();
  const users = Array.from({ length: 50 }, () => randomUUID());
  for (const u of users) {
    for (let d = 1; d <= 28; d++) {
      seen.add(dayWorkoutId(u, `2026-02-${String(d).padStart(2, '0')}`));
    }
  }
  assert.equal(seen.size, 50 * 28);
});
