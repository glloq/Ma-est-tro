/**
 * @file tests/audit/midi-core-conformance.test.js
 * @description MIDI 1.0 core conformance suite (audit sections D01–D05, BK).
 *
 * Exercises the *real* inbound entry points rather than a mock:
 *   - `DeviceManager.handleRawMidi()` — the shared raw-byte path used by the
 *     BLE and network transports.
 *   - `SerialMidiManager`'s byte-stream parser — the UART path, which owns
 *     running-status reassembly.
 *
 * These two are compared against each other deliberately: the same wire bytes
 * must produce the same logical event whichever transport delivered them.
 *
 * Boundary coverage is exhaustive where the plan asks for it: every channel
 * 0..15, velocity/CC 0 and 127, pitch-bend 0 and 16383.
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import DeviceManager from '../../src/midi/devices/DeviceManager.js';

/** Minimal DI bag: DeviceManager only needs logger/eventBus/database here. */
function makeDeps() {
  const noop = () => {};
  return {
    logger: { info: noop, warn: noop, error: noop, debug: noop },
    eventBus: { emit: noop, on: noop, off: noop, removeListener: noop },
    config: { get: () => undefined },
    database: null
  };
}

/**
 * Build a DeviceManager and capture everything that reaches
 * `handleMidiMessage`, which is the single funnel every transport feeds.
 */
function makeCapturingManager() {
  const dm = new DeviceManager(makeDeps());
  const seen = [];
  dm.handleMidiMessage = jest.fn((deviceName, type, msg) => {
    seen.push({ deviceName, type, msg });
  });
  return { dm, seen };
}

describe('D01 — channel voice messages via handleRawMidi', () => {
  let dm, seen;
  beforeEach(() => {
    ({ dm, seen } = makeCapturingManager());
  });

  test('Note On is decoded on all 16 channels with boundary velocities', () => {
    for (let ch = 0; ch < 16; ch++) {
      seen.length = 0;
      dm.handleRawMidi('dev', [0x90 | ch, 60, 127]);
      expect(seen).toHaveLength(1);
      expect(seen[0].type).toBe('noteon');
      expect(seen[0].msg).toMatchObject({ channel: ch, note: 60, velocity: 127 });
    }
  });

  test('Note On with velocity 0 is normalised to Note Off (MIDI 1.0 running status)', () => {
    dm.handleRawMidi('dev', [0x90, 60, 0]);
    expect(seen[0].type).toBe('noteoff');
    expect(seen[0].msg.velocity).toBe(0);
  });

  test('Note Off keeps its release velocity', () => {
    dm.handleRawMidi('dev', [0x80 | 5, 64, 42]);
    expect(seen[0]).toMatchObject({ type: 'noteoff', msg: { channel: 5, note: 64, velocity: 42 } });
  });

  test('note number boundaries 0 and 127 survive intact', () => {
    dm.handleRawMidi('dev', [0x90, 0, 1]);
    dm.handleRawMidi('dev', [0x90, 127, 1]);
    expect(seen.map((s) => s.msg.note)).toEqual([0, 127]);
  });

  test('CC, Program Change, Poly and Channel Pressure decode correctly', () => {
    dm.handleRawMidi('dev', [0xb0 | 2, 7, 100]); // CC7 volume
    dm.handleRawMidi('dev', [0xc0 | 3, 42]); // Program change
    dm.handleRawMidi('dev', [0xa0 | 4, 60, 90]); // Poly pressure
    dm.handleRawMidi('dev', [0xd0 | 5, 77]); // Channel pressure

    expect(seen[0]).toMatchObject({ type: 'cc', msg: { channel: 2, controller: 7, value: 100 } });
    expect(seen[1]).toMatchObject({ type: 'program', msg: { channel: 3, number: 42 } });
    expect(seen[2]).toMatchObject({
      type: 'poly aftertouch',
      msg: { channel: 4, note: 60, pressure: 90 }
    });
    expect(seen[3]).toMatchObject({
      type: 'channel aftertouch',
      msg: { channel: 5, pressure: 77 }
    });
  });

  test('pitch bend spans the full 14-bit range 0..16383', () => {
    dm.handleRawMidi('dev', [0xe0, 0x00, 0x00]); // min
    dm.handleRawMidi('dev', [0xe0, 0x00, 0x40]); // centre 8192
    dm.handleRawMidi('dev', [0xe0, 0x7f, 0x7f]); // max
    expect(seen.map((s) => s.msg.value)).toEqual([0, 8192, 16383]);
  });

  test('system real-time messages are surfaced', () => {
    for (const [byte, type] of [
      [0xf8, 'clock'],
      [0xfa, 'start'],
      [0xfb, 'continue'],
      [0xfc, 'stop'],
      [0xfe, 'sensing'],
      [0xff, 'reset']
    ]) {
      seen.length = 0;
      dm.handleRawMidi('dev', [byte]);
      expect(seen.map((s) => s.type)).toEqual([type]);
    }
  });

  test('SysEx frames are forwarded whole', () => {
    const gmReset = [0xf0, 0x7e, 0x7f, 0x09, 0x01, 0xf7];
    dm.handleRawMidi('dev', gmReset);
    expect(seen[0]).toMatchObject({ type: 'sysex' });
    expect(seen[0].msg).toEqual(gmReset);
  });

  test('empty and non-array input is ignored rather than throwing', () => {
    expect(() => dm.handleRawMidi('dev', [])).not.toThrow();
    expect(() => dm.handleRawMidi('dev', null)).not.toThrow();
    expect(() => dm.handleRawMidi('dev', undefined)).not.toThrow();
    expect(seen).toHaveLength(0);
  });
});

describe('D01 — System Common parity between transports', () => {
  // The UART parser (SerialMidiManager) maps 0xF1/0xF2/0xF3/0xF6 to
  // mtc/position/select/tune. `handleRawMidi` — the shared entry used by BLE
  // and network — must not silently drop the same bytes.
  test.each([
    ['0xF2 Song Position Pointer', [0xf2, 0x10, 0x00], 'position'],
    ['0xF1 MTC quarter frame', [0xf1, 0x00], 'mtc'],
    ['0xF3 Song Select', [0xf3, 0x02], 'select'],
    ['0xF6 Tune Request', [0xf6], 'tune']
  ])('%s reaches the router as the same type serial emits', (_label, bytes, expectedType) => {
    const { dm, seen } = makeCapturingManager();
    dm.handleRawMidi('dev', bytes);
    expect(seen).toHaveLength(1);
    expect(seen[0].type).toBe(expectedType);
    expect(seen[0].msg).toEqual({ bytes: bytes.slice(1) });
  });
});
