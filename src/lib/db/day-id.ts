/**
 * THE ID OF A TRAINING DAY — deterministic, so two devices cannot invent two
 * sessions for one day.
 *
 * ## The bug this exists to end
 *
 * `workouts` is one row per person per LOCAL DAY. `saveRawText` enforces that
 * by looking the day up first and updating what it finds — and it can only look
 * in SQLITE. A device that has not pulled yet finds nothing, mints a random
 * uuid, and pushes a SECOND row for a day that already had one. Nothing rejects
 * it: the table has no uniqueness on (user, day), and `upsert` matches on `id`,
 * which is exactly the thing that differed.
 *
 * Measured on the hosted project, 10 September 2026: the development account
 * carried **six** rows for 9 September and two each for five other days, and a
 * client's coach saw one bench-press session listed three times. The person's
 * own app hid it, because `getWorkoutForDay` takes the first row it finds —
 * so the record their coach read was not the record they were shown.
 *
 * ## Why a hash and not a constraint
 *
 * A unique index on (user_id, date(performed_at)) would reject the second write
 * — with a 409 that lands in `pushWorkouts`, which throws, which stops the whole
 * sync pass for every table behind it. A person would lose sync to fix a
 * duplicate they cannot see. Deriving the id instead means the second write is
 * simply the SAME row: `upsert` updates it, and the two devices converge with
 * no error to handle and no migration to run.
 *
 * UUIDv5 (RFC 4122 §4.3) is the standard way to say "this name, in this
 * namespace, always means this id". The namespace below is Recore's own,
 * generated once and frozen — changing it would re-key every future day.
 *
 * ## Why SHA-1 is written out here
 *
 * `expo-crypto` has no synchronous digest, and this call sits on the writing
 * path: `saveRawText` lands raw text in SQLite **in the same tick as the
 * keystroke** (CLAUDE.md §2 invariant 1), so it cannot await anything. Sixty
 * lines of a fully specified 1995 hash, checked against the RFC's own vectors
 * in `day-id.test.ts`, is the cost of keeping that promise.
 *
 * SHA-1 is used here as UUIDv5 specifies it — as a naming function, never as a
 * security primitive. Nothing about this id is secret or authenticating.
 */

/** Recore's own UUIDv5 namespace. Frozen: it is part of every id derived below. */
const NAMESPACE = 'b6b0f9a2-4a1b-4b7e-9a3f-6c1d2e8f7a50';

/** UTF-8 bytes of a string. Written out rather than assumed: Hermes has had
 *  `TextEncoder` for a while, and this file must not depend on when. */
function utf8(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    // A surrogate pair is one code point; fold it before encoding.
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const next = s.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else
      out.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 0x3f),
        0x80 | ((c >> 6) & 0x3f),
        0x80 | (c & 0x3f),
      );
  }
  return Uint8Array.from(out);
}

/** SHA-1 of a byte string, as twenty bytes. FIPS 180-1, no shortcuts. */
export function sha1(msg: Uint8Array): Uint8Array {
  const total = Math.ceil((msg.length + 9) / 64) * 64;
  const buf = new Uint8Array(total);
  buf.set(msg);
  buf[msg.length] = 0x80;

  // The length goes in as a 64-bit big-endian COUNT OF BITS. A note has never
  // been near 2^32 bits, but writing only the low word is the kind of shortcut
  // that is correct until it silently is not.
  const bits = msg.length * 8;
  const hi = Math.floor(bits / 0x100000000);
  const lo = bits >>> 0;
  buf[total - 8] = (hi >>> 24) & 0xff;
  buf[total - 7] = (hi >>> 16) & 0xff;
  buf[total - 6] = (hi >>> 8) & 0xff;
  buf[total - 5] = hi & 0xff;
  buf[total - 4] = (lo >>> 24) & 0xff;
  buf[total - 3] = (lo >>> 16) & 0xff;
  buf[total - 2] = (lo >>> 8) & 0xff;
  buf[total - 1] = lo & 0xff;

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);

  for (let i = 0; i < total; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] =
        ((buf[i + 4 * j]! << 24) |
          (buf[i + 4 * j + 1]! << 16) |
          (buf[i + 4 * j + 2]! << 8) |
          buf[i + 4 * j + 3]!) >>>
        0;
    }
    for (let j = 16; j < 80; j++) {
      const n = (w[j - 3]! ^ w[j - 8]! ^ w[j - 14]! ^ w[j - 16]!) >>> 0;
      w[j] = ((n << 1) | (n >>> 31)) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let j = 0; j < 80; j++) {
      let f: number;
      let k: number;
      if (j < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (j < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (j < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[j]!) >>> 0;
      e = d;
      d = c;
      // `c` takes b ROTATED, and `b` takes a. Getting this pair the wrong way
      // round still produces a plausible-looking 160-bit digest that matches
      // nothing — which is the entire argument for the RFC vectors next door.
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = t;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const out = new Uint8Array(20);
  [h0, h1, h2, h3, h4].forEach((h, n) => {
    out[4 * n] = (h >>> 24) & 0xff;
    out[4 * n + 1] = (h >>> 16) & 0xff;
    out[4 * n + 2] = (h >>> 8) & 0xff;
    out[4 * n + 3] = h & 0xff;
  });
  return out;
}

const hex = (b: number) => b.toString(16).padStart(2, '0');

/** The sixteen bytes of a canonical uuid string. */
function uuidBytes(uuid: string): Uint8Array {
  const clean = uuid.replace(/-/g, '');
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = parseInt(clean.slice(2 * i, 2 * i + 2), 16);
  return out;
}

/** RFC 4122 §4.3 — the name-based uuid of `name` inside `namespace`. */
export function uuidv5(name: string, namespace = NAMESPACE): string {
  const ns = uuidBytes(namespace);
  const n = utf8(name);
  const input = new Uint8Array(ns.length + n.length);
  input.set(ns);
  input.set(n, ns.length);

  const h = sha1(input).slice(0, 16);
  h[6] = (h[6]! & 0x0f) | 0x50; // version 5
  h[8] = (h[8]! & 0x3f) | 0x80; // RFC 4122 variant

  const s = Array.from(h, hex).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/**
 * The id of one person's one training day. Same person, same day, same id —
 * on every device, offline, for ever.
 *
 * The day key is the LOCAL day (`dayKeyOf`), which is what "a training day"
 * means everywhere else in this app. Two devices in different time zones
 * therefore disagree about which day a late-night session belongs to, exactly
 * as they already disagree about which row `getWorkoutForDay` returns; this
 * function does not make that better or worse.
 */
export function dayWorkoutId(userId: string, day: string): string {
  return uuidv5(`${userId}:${day}`);
}
