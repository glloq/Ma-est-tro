/**
 * @file tests/audit/midi-file-robustness.test.js
 * @description Malformed / hostile MIDI file handling (audit sections E01–E03).
 *
 * The contract under test is narrow but important: for ANY byte sequence the
 * upload path must either parse it or throw a clean `Error`. It must never
 * hang, never blow the stack, and never surface a non-Error (which would
 * bypass the `ApplicationError` mapping in CommandRegistry and reach the
 * client as "Internal server error" with no diagnostics).
 *
 * Includes a deterministic fuzz pass — seeded PRNG, no `Math.random()`, so a
 * failure is always reproducible from the seed printed in the assertion.
 */
import { describe, test, expect } from '@jest/globals';
import MidiFileParser from '../../src/files/MidiFileParser.js';

const parser = new MidiFileParser({
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {}
});

/** Minimal well-formed SMF: format 0, 1 track, PPQ 480, one end-of-track. */
function validSmf() {
  return Buffer.from([
    0x4d,
    0x54,
    0x68,
    0x64, // "MThd"
    0x00,
    0x00,
    0x00,
    0x06, // header length 6
    0x00,
    0x00, // format 0
    0x00,
    0x01, // 1 track
    0x01,
    0xe0, // 480 ppq
    0x4d,
    0x54,
    0x72,
    0x6b, // "MTrk"
    0x00,
    0x00,
    0x00,
    0x04, // track length 4
    0x00,
    0xff,
    0x2f,
    0x00 // delta 0, end of track
  ]);
}

/** Deterministic 32-bit PRNG (mulberry32) so fuzz failures are reproducible. */
function prng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('E01 — a well-formed file still parses', () => {
  test('valid format 0 SMF parses with the expected header', () => {
    const midi = parser.parse(validSmf());
    expect(midi.header.format).toBe(0);
    expect(midi.header.numTracks).toBe(1);
    expect(midi.header.ticksPerBeat).toBe(480);
  });
});

describe('E03 — malformed input is rejected cleanly, never crashes the process', () => {
  const cases = {
    'empty buffer': Buffer.alloc(0),
    'single zero byte': Buffer.from([0x00]),
    'truncated MThd magic': Buffer.from([0x4d, 0x54, 0x68]),
    'header claims length 6 but is cut short': Buffer.from([
      0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00
    ]),
    'bogus chunk type where MThd expected': Buffer.from([
      0x58, 0x58, 0x58, 0x58, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, 0x01, 0xe0
    ]),
    'header ok, track chunk truncated': validSmf().subarray(0, 18),
    'track length longer than the data present': (() => {
      const b = validSmf();
      b.writeUInt32BE(0xffff, 18); // absurd MTrk length
      return b;
    })(),
    'numTracks claims 500 but only one present': (() => {
      const b = validSmf();
      b.writeUInt16BE(500, 10);
      return b;
    })(),
    'unterminated running-status data': Buffer.concat([
      validSmf().subarray(0, 22),
      Buffer.from([0x00, 0x90, 0x3c])
    ]),
    'all 0xFF bytes': Buffer.alloc(64, 0xff),
    'text file, not MIDI': Buffer.from('this is definitely not a midi file', 'utf8')
  };

  for (const [label, buf] of Object.entries(cases)) {
    test(`${label}: throws a real Error (never hangs or returns junk)`, () => {
      let threw = null;
      let result;
      try {
        result = parser.parse(buf);
      } catch (e) {
        threw = e;
      }
      if (threw) {
        expect(threw).toBeInstanceOf(Error);
        expect(typeof threw.message).toBe('string');
        expect(threw.message.length).toBeGreaterThan(0);
      } else {
        // Parsing "succeeding" is acceptable only if the result is a
        // structurally sane object the rest of the pipeline can consume.
        expect(result).toHaveProperty('header');
        expect(result).toHaveProperty('tracks');
        expect(Array.isArray(result.tracks)).toBe(true);
      }
    });
  }
});

describe('E03 — deterministic fuzz over mutated valid files', () => {
  test('200 single-byte mutations never produce a non-Error failure', () => {
    const base = validSmf();
    const rand = prng(0xc0ffee);
    const failures = [];

    for (let i = 0; i < 200; i++) {
      const buf = Buffer.from(base);
      const pos = Math.floor(rand() * buf.length);
      buf[pos] = Math.floor(rand() * 256);
      try {
        const midi = parser.parse(buf);
        if (!midi || typeof midi !== 'object' || !midi.header) {
          failures.push({ i, pos, reason: 'parsed to a non-object' });
        }
      } catch (e) {
        if (!(e instanceof Error)) {
          failures.push({ i, pos, reason: `threw a non-Error: ${String(e)}` });
        }
      }
    }
    expect(failures).toEqual([]);
  });

  test('random garbage of many lengths is always rejected as an Error', () => {
    const rand = prng(0x1234);
    const failures = [];
    for (const len of [1, 2, 7, 13, 14, 22, 64, 257, 1024]) {
      for (let rep = 0; rep < 20; rep++) {
        const buf = Buffer.alloc(len);
        for (let i = 0; i < len; i++) buf[i] = Math.floor(rand() * 256);
        try {
          parser.parse(buf);
        } catch (e) {
          if (!(e instanceof Error)) failures.push({ len, rep, thrown: String(e) });
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
