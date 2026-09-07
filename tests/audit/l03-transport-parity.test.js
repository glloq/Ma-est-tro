/**
 * @file tests/audit/l03-transport-parity.test.js
 * @description Lot L03 — **systematic** inter-transport decode parity.
 *
 * The previous audit found F-08 by hand: `DeviceManager.handleRawMidi()`
 * dropped the System Common messages that `SerialMidiManager` handled, so the
 * SAME BYTES ON THE WIRE behaved differently depending on the cable. One case
 * was fixed; the class was never swept.
 *
 * This suite sweeps it. A single table of wire-byte streams is injected into
 * **every** decode path the product actually runs:
 *
 *   | Path   | Code under test                                            |
 *   |--------|------------------------------------------------------------|
 *   | USB    | `easymidi.Input` events → `DeviceManager.addInput()`        |
 *   | Serial | `SerialMidiManager._handleData()` byte-stream parser        |
 *   | BLE    | `BluetoothManager._handleIncomingMidi()` → `handleRawMidi()`|
 *   | RTP    | `RtpMidiSession.parseMidiPayload()` → `NetworkManager`      |
 *
 * Every path is terminated at the SAME funnel — `DeviceManager.handleMidiMessage`
 * — which is where routing, WS broadcast and the EventBus read from. Two
 * transports agree only when that funnel sees the same `(type, payload)`.
 *
 * The USB path cannot use the real `easymidi` here (no ALSA headers in CI, see
 * CLAUDE.md), so it is driven through a mocked module whose parser is a verbatim
 * replica of the installed `node_modules/easymidi/index.js`. A guard test reads
 * that file and fails if the replica ever drifts from it.
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

// ---------------------------------------------------------------------------
// easymidi mock (USB path). Records the events DeviceManager subscribes to.
// ---------------------------------------------------------------------------
const usbInputs = [];
class FakeEasymidiInput {
  constructor(name) {
    this.name = name;
    this.listeners = new Map();
    usbInputs.push(this);
  }
  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
  }
  emit(event, msg) {
    for (const fn of this.listeners.get(event) || []) fn(msg);
  }
  /** Event names DeviceManager actually wired up. */
  subscribed() {
    return new Set(this.listeners.keys());
  }
  close() {}
  removeAllListeners() {
    this.listeners.clear();
  }
}
jest.unstable_mockModule('easymidi', () => ({
  default: {
    getInputs: () => ['USB-DEV'],
    getOutputs: () => ['USB-DEV'],
    Input: FakeEasymidiInput,
    Output: class {
      send() {}
      close() {}
    }
  }
}));

const { default: DeviceManager } = await import('../../src/midi/devices/DeviceManager.js');
const { default: SerialMidiManager } = await import('../../src/transports/SerialMidiManager.js');
const { default: BluetoothManager } = await import('../../src/transports/BluetoothManager.js');
const { default: InMemoryBleAdapter } = await import(
  '../../src/midi/adapters/InMemoryBleAdapter.js'
);
const { default: NetworkManager } = await import('../../src/transports/NetworkManager.js');
const { default: RtpMidiSession } = await import('../../src/transports/RtpMidiSession.js');

// ---------------------------------------------------------------------------
// easymidi's own parser, replicated from node_modules/easymidi/index.js.
// (see the guard test `easymidi replica matches the installed package`)
// ---------------------------------------------------------------------------
const EASYMIDI_INPUT_TYPES = {
  0x08: 'noteoff',
  0x09: 'noteon',
  0x0a: 'poly aftertouch',
  0x0b: 'cc',
  0x0c: 'program',
  0x0d: 'channel aftertouch',
  0x0e: 'pitch'
};
const EASYMIDI_EXTENDED_TYPES = {
  0xf0: 'sysex',
  0xf1: 'mtc',
  0xf2: 'position',
  0xf3: 'select',
  0xf6: 'tune',
  0xf7: 'sysex end',
  0xf8: 'clock',
  0xfa: 'start',
  0xfb: 'continue',
  0xfc: 'stop',
  0xfe: 'activesense',
  0xff: 'reset'
};
function easymidiParse(bytes) {
  const msg = {};
  let type = 'unknown';
  if (bytes[0] >= 0xf0) {
    type = EASYMIDI_EXTENDED_TYPES[bytes[0]];
  } else {
    type = EASYMIDI_INPUT_TYPES[bytes[0] >> 4];
    msg.channel = bytes[0] & 0x0f;
  }
  if (type === 'noteoff' || type === 'noteon') {
    msg.note = bytes[1];
    msg.velocity = bytes[2];
  }
  if (type === 'cc') {
    msg.controller = bytes[1];
    msg.value = bytes[2];
  }
  if (type === 'poly aftertouch') {
    msg.note = bytes[1];
    msg.pressure = bytes[2];
  }
  if (type === 'channel aftertouch') msg.pressure = bytes[1];
  if (type === 'program') msg.number = bytes[1];
  if (type === 'pitch' || type === 'position') msg.value = bytes[1] + bytes[2] * 128;
  if (type === 'sysex') msg.bytes = bytes;
  if (type === 'select') msg.song = bytes[1];
  if (type === 'mtc') {
    msg.type = (bytes[1] >> 4) & 0x07;
    msg.value = bytes[1] & 0x0f;
  }
  return { type, msg };
}

// ---------------------------------------------------------------------------
// Shared plumbing
// ---------------------------------------------------------------------------
const noop = () => {};
const makeDeps = () => ({
  logger: { info: noop, warn: noop, error: noop, debug: noop },
  eventBus: { emit: noop, on: noop, off: noop, removeListener: noop },
  config: { get: () => undefined },
  database: null
});

/** DeviceManager whose single funnel is captured instead of executed. */
function capturingManager() {
  const dm = new DeviceManager(makeDeps());
  const seen = [];
  dm.handleMidiMessage = jest.fn((deviceName, type, msg) => {
    // Reproduce the ONE normalisation the real funnel performs before routing,
    // so parity is compared on what the router/UI actually receives.
    if (type === 'noteon' && msg && msg.velocity === 0) type = 'noteoff';
    seen.push({ type, msg });
  });
  return { dm, seen };
}

/** Split a byte stream into complete MIDI messages (for the framed paths). */
function frameMessages(bytes) {
  const out = [];
  let i = 0;
  let running = 0;
  const dataLen = (status) => {
    const hi = status & 0xf0;
    if (hi === 0xc0 || hi === 0xd0) return 1;
    if (hi < 0xf0) return 2;
    if (status === 0xf1 || status === 0xf3) return 1;
    if (status === 0xf2) return 2;
    return 0;
  };
  while (i < bytes.length) {
    const b = bytes[i];
    if (b >= 0xf8) {
      out.push([b]);
      i++;
      continue;
    }
    if (b === 0xf0) {
      const start = i;
      i++;
      while (i < bytes.length && bytes[i] !== 0xf7) i++;
      if (i < bytes.length) i++;
      out.push(bytes.slice(start, i));
      running = 0;
      continue;
    }
    let status;
    if (b >= 0x80) {
      status = b;
      i++;
      running = status <= 0xef ? status : 0;
    } else if (running) {
      status = running;
    } else {
      i++;
      continue;
    }
    const n = dataLen(status);
    out.push([status, ...bytes.slice(i, i + n)]);
    i += n;
  }
  return out;
}

// ---- USB -------------------------------------------------------------------
async function decodeUsb(bytes) {
  usbInputs.length = 0;
  const { dm, seen } = capturingManager();
  dm.addInput('USB-DEV');
  const input = usbInputs[usbInputs.length - 1];
  for (const frame of frameMessages(bytes)) {
    const { type, msg } = easymidiParse(frame);
    if (!type || type === 'unknown') continue;
    // RtMidi/easymidi only emits events; a listener that was never registered
    // means the message never reaches the application at all.
    input.emit(type, msg);
  }
  return seen;
}

/** The set of easymidi event names DeviceManager.addInput() subscribes to. */
function usbSubscribedEvents() {
  usbInputs.length = 0;
  const { dm } = capturingManager();
  dm.addInput('USB-DEV');
  return usbInputs[usbInputs.length - 1].subscribed();
}

// ---- Serial ----------------------------------------------------------------
function decodeSerial(bytes, chunks = null) {
  const { dm, seen } = capturingManager();
  const mgr = Object.create(SerialMidiManager.prototype);
  mgr.logger = makeDeps().logger;
  mgr.deviceManager = dm;
  mgr.openPorts = new Map([['/dev/ttyAMA0', { parserState: mgr._createParserState() }]]);
  for (const chunk of chunks || [bytes]) {
    mgr._handleData('/dev/ttyAMA0', Buffer.from(chunk));
  }
  return seen;
}

// ---- BLE -------------------------------------------------------------------
/** Wrap a byte stream in Apple BLE-MIDI framing (header + per-message ts). */
function bleFrame(bytes) {
  const pkt = [0x80];
  for (const msg of frameMessages(bytes)) {
    pkt.push(0x80, ...msg);
  }
  return Buffer.from(pkt);
}
async function decodeBle(bytes, packets = null) {
  const { dm, seen } = capturingManager();
  const ble = new BluetoothManager(
    { logger: makeDeps().logger },
    { port: new InMemoryBleAdapter() }
  );
  // Exactly the wiring Application.initialize installs.
  ble.on('midi:data', ({ address, data }) => dm.handleRawMidi(address, data));
  for (const pkt of packets || [bleFrame(bytes)]) {
    ble._handleIncomingMidi('AA:BB', Buffer.from(pkt));
  }
  await ble.cleanup();
  return seen;
}

// ---- RTP / network ---------------------------------------------------------
/** RFC 6295 MIDI command section: short header (Z=0), one full-status run. */
function rtpPayload(bytes) {
  return Buffer.from([bytes.length & 0x0f, ...bytes]);
}
function decodeRtp(bytes, payloads = null) {
  const { dm, seen } = capturingManager();
  const session = Object.create(RtpMidiSession.prototype);
  const nm = Object.create(NetworkManager.prototype);
  nm.logger = makeDeps().logger;
  nm.emit = ({ data, type, address } = {}) => {}; // replaced below
  const emitted = [];
  nm.emit = (_evt, payload) => emitted.push(payload);
  for (const p of payloads || [rtpPayload(bytes)]) {
    for (const cmd of session.parseMidiPayload(p)) {
      nm.handleMidiData('10.0.0.7', cmd);
    }
  }
  // Application.initialize's network wiring.
  for (const { type, data } of emitted) {
    if (Array.isArray(data)) dm.handleRawMidi('10.0.0.7', data);
    else if (type) dm.handleMidiMessage('10.0.0.7', type, data);
  }
  return seen;
}

// ---------------------------------------------------------------------------
// Guard: the replica must track the installed easymidi.
// ---------------------------------------------------------------------------
describe('L03 — harness integrity', () => {
  test('easymidi replica matches the installed package tables', () => {
    const src = readFileSync(path.join(REPO, 'node_modules/easymidi/index.js'), 'utf8');
    for (const [byte, name] of Object.entries(EASYMIDI_EXTENDED_TYPES)) {
      const hex = Number(byte).toString(16).toUpperCase().padStart(2, '0');
      expect(src).toMatch(new RegExp(`0x${hex}:\\s*'${name}'`, 'i'));
    }
    for (const [nibble, name] of Object.entries(EASYMIDI_INPUT_TYPES)) {
      const hex = Number(nibble).toString(16).toUpperCase().padStart(2, '0');
      expect(src).toMatch(new RegExp(`0x${hex}:\\s*'${name}'`, 'i'));
    }
  });
});

// TEMP PROBE 3
describe('probe3', () => {
  test('edge cases', async () => {
    const show = (x) => JSON.stringify(x);
    const out = {};
    const { dm, seen } = capturingManager();
    dm.handleRawMidi('d', [0x90, 60]);            // truncated
    out.raw_trunc = show(seen.splice(0));
    dm.handleRawMidi('d', [0x90, 60, 100, 0x90, 62, 100]); // two messages in one array
    out.raw_multi = show(seen.splice(0));
    dm.handleRawMidi('d', [0xf0, 0x43, 0x10]);    // unterminated sysex
    out.raw_sysex_open = show(seen.splice(0));
    dm.handleRawMidi('d', [0x90, 200, 300]);      // out-of-range data bytes
    out.raw_oob = show(seen.splice(0));
    dm.handleRawMidi('d', [0xf4]);
    dm.handleRawMidi('d', [0xf5]);
    dm.handleRawMidi('d', [0xf9]);
    dm.handleRawMidi('d', [0xfd]);
    dm.handleRawMidi('d', [0xf7]);
    out.raw_undef = show(seen.splice(0));
    out.ser_undef = show(decodeSerial([0xf4, 0xf5, 0xf9, 0xfd, 0xf7]));
    out.ser_undef_cancels_rs = show(decodeSerial([0x90, 60, 100, 0xf4, 62, 100]));
    out.ble_undef = show(await decodeBle(null, [[0x80, 0x80, 0xf4, 0x80, 0xf5, 0x80, 0xf9]]));
    // RPN + 14-bit CC + bank select (pure CC pass-through)
    const rpn = [
      0xb0, 101, 0, 0xb0, 100, 0, 0xb0, 6, 12, 0xb0, 38, 0,
      0xb0, 101, 127, 0xb0, 100, 127
    ];
    out.rpn_serial = show(decodeSerial(rpn).map((e) => [e.msg.controller, e.msg.value]));
    out.rpn_ble = show((await decodeBle(rpn)).map((e) => [e.msg.controller, e.msg.value]));
    out.rpn_usb = show((await decodeUsb(rpn)).map((e) => [e.msg.controller, e.msg.value]));
    out.rpn_rtp = show(decodeRtp(rpn).map((e) => [e.msg.controller, e.msg.value]));
    const bank = [0xb0, 0, 1, 0xb0, 32, 3, 0xc0, 40];
    out.bank_serial = show(decodeSerial(bank));
    out.bank_usb = show(await decodeUsb(bank));
    console.log(JSON.stringify(out, null, 1));
    expect(true).toBe(true);
  });
});
