/**
 * @file tests/audit/l01-ws-contract.test.js
 * @description Audit L01 — WebSocket contract regressions.
 *
 * Every test here encodes a defect that was reproduced live against a running
 * server on 2026-09-07 (see docs/audit/2026-09-07/01_API_CONTRACT.md).
 */
import { jest } from '@jest/globals';
import EventBus from '../../src/core/EventBus.js';
import JsonValidator from '../../src/utils/JsonValidator.js';
import { register as registerLighting } from '../../src/api/commands/LightingCommands.js';

/** Minimal registry standing in for CommandRegistry. */
function makeRegistry() {
  const handlers = {};
  return { handlers, register: (name, fn) => (handlers[name] = fn) };
}

/** Application facade with a REAL EventBus — the point of the F-18 test. */
function makeApp() {
  return {
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    eventBus: new EventBus(),
    lightingManager: {
      effectsEngine: { setBpm: () => {}, getBpm: () => 120, tapTempo: () => 120 },
      drivers: new Map(),
      reloadRules: () => {}
    },
    lightingRepository: {
      findAllRules: () => [],
      findAllDevices: () => [],
      findDeviceById: () => null
    }
  };
}

describe('L01 / F-18 — lighting_midi_learn must not crash the process', () => {
  // EventBus exposes on/off/once/emit — NOT the Node EventEmitter
  // `removeListener`. The handler used to call `removeListener`, so the
  // 10 s timeout callback threw a TypeError from a timer: uncatchable by
  // the dispatcher, escalated to `uncaughtException`, and Application's
  // handler shut the whole server down. One WS frame = remote kill.
  it('EventBus does not implement removeListener (the trap)', () => {
    const bus = new EventBus();
    expect(typeof bus.off).toBe('function');
    expect(bus.removeListener).toBeUndefined();
  });

  it('resolves with a timeout result instead of throwing from the timer', async () => {
    jest.useFakeTimers();
    const app = makeApp();
    const registry = makeRegistry();
    registerLighting(registry, app);

    const promise = registry.handlers['lighting_midi_learn']({});
    // Fire the 10 s one-shot timeout. If the callback throws, Jest surfaces it.
    expect(() => jest.advanceTimersByTime(10_000)).not.toThrow();
    await expect(promise).resolves.toMatchObject({ success: false, error: 'timeout' });
    // The one-shot listener must actually be detached.
    expect(app.eventBus.listenerCount('midi_message')).toBe(0);
    jest.useRealTimers();
  });

  it('detaches the listener on the happy path too (no leak on the MIDI hot path)', async () => {
    jest.useFakeTimers();
    const app = makeApp();
    const registry = makeRegistry();
    registerLighting(registry, app);

    const promise = registry.handlers['lighting_midi_learn']({});
    expect(app.eventBus.listenerCount('midi_message')).toBe(1);
    app.eventBus.emit('midi_message', { data: { type: 'noteon', note: 60, channel: 0 } });
    await expect(promise).resolves.toMatchObject({ success: true });
    expect(app.eventBus.listenerCount('midi_message')).toBe(0);
    jest.useRealTimers();
  });
});

describe('L01 / F-03 — validateByCommand fails open', () => {
  it('accepts any payload for a command that has no registered schema', () => {
    // Documented baseline: 184 of 270 registered commands land here.
    for (const cmd of [
      'lighting_rule_add',
      'playback_set_tempo',
      'playlist_create',
      'system_logs',
      'string_instrument_create'
    ]) {
      expect(JsonValidator.validateByCommand(cmd, { anything: [1, 2, 3] })).toEqual({
        valid: true,
        errors: []
      });
    }
  });

  it('an entirely unknown command name is also accepted at the validation layer', () => {
    expect(JsonValidator.validateByCommand('no_such_command_xyz', { x: 1 })).toEqual({
      valid: true,
      errors: []
    });
  });
});
