// tests/frontend/midi-editor-program-change.test.js
//
// Audit D MD2 (combo Part 2): mid-song program changes must round-trip through
// the editor. On load, MidiEditorSequence retains every programChange with its
// tick in `modal.programChangeEvents`; on save, MidiEditorMidiWriter re-emits
// them verbatim for channels that still carry more than one distinct program,
// instead of collapsing every channel to a single programChange at tick 0.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const writerSource = readFileSync(
  resolve(__dirname, '../../public/js/features/midi-editor/MidiEditorMidiWriter.js'),
  'utf8'
);
const fileOpsSource = readFileSync(
  resolve(__dirname, '../../public/js/features/midi-editor/MidiEditorFileOps.js'),
  'utf8'
);
const sequenceSource = readFileSync(
  resolve(__dirname, '../../public/js/features/midi-editor/MidiEditorSequence.js'),
  'utf8'
);
const channelOpsSource = readFileSync(
  resolve(__dirname, '../../public/js/features/midi-editor/MidiEditorChannelOps.js'),
  'utf8'
);
const rendererSource = readFileSync(
  resolve(__dirname, '../../public/js/features/midi-editor/MidiEditorRenderer.js'),
  'utf8'
);

new Function(writerSource)();
new Function(fileOpsSource)();
new Function(sequenceSource)();
new Function(channelOpsSource)();
new Function(rendererSource)();

const MidiEditorFileOps = /** @type {any} */ (globalThis.window.MidiEditorFileOps);
const MidiEditorSequence = /** @type {any} */ (globalThis.window.MidiEditorSequence);
const MidiEditorChannelOps = /** @type {any} */ (globalThis.window.MidiEditorChannelOps);
const MidiEditorRenderer = /** @type {any} */ (globalThis.window.MidiEditorRenderer);

function makeModal(overrides = {}) {
  return {
    fullSequence: [],
    channels: [],
    ccEvents: [],
    tempoEvents: [],
    programChangeEvents: [],
    tempo: 120,
    midiData: { header: { ticksPerBeat: 480 } },
    selectedInstrument: 0,
    log: vi.fn(),
    getInstrumentName: (p) => `Program${p}`,
    ...overrides
  };
}

// Re-derive absolute ticks from the delta-encoded track so tests can assert on
// event timing (the writer only exposes deltaTime).
function withAbsoluteTicks(events) {
  let t = 0;
  return events.map((e) => {
    t += e.deltaTime;
    return { ...e, absTick: t };
  });
}

describe('MidiEditorMidiWriter — mid-song program changes on save (audit D MD2)', () => {
  const run = (modal) => new MidiEditorFileOps(modal).convertSequenceToMidi();

  it('preserves every program change at its tick for a multi-program channel', () => {
    const modal = makeModal({
      fullSequence: [
        { t: 0, g: 120, n: 60, c: 0, v: 100 },
        { t: 5000, g: 120, n: 67, c: 0, v: 100 }
      ],
      channels: [{ channel: 0, program: 40 }],
      programChangeEvents: [
        { ticks: 0, channel: 0, program: 0 },
        { ticks: 5000, channel: 0, program: 40 }
      ]
    });

    const pcs = withAbsoluteTicks(run(modal).tracks[0]).filter((e) => e.type === 'programChange');
    expect(pcs.length).toBe(2);
    expect(pcs[0]).toMatchObject({ absTick: 0, programNumber: 0, channel: 0 });
    expect(pcs[1]).toMatchObject({ absTick: 5000, programNumber: 40, channel: 0 });
  });

  it('collapses to a single tick-0 program change when only one distinct program remains', () => {
    // e.g. after the user re-instrumented the channel (its PCs were dropped and
    // one single-program entry remains) — must NOT emit a mid-song change.
    const modal = makeModal({
      fullSequence: [{ t: 0, g: 120, n: 60, c: 0, v: 100 }],
      channels: [{ channel: 0, program: 40 }],
      programChangeEvents: [{ ticks: 0, channel: 0, program: 40 }]
    });
    const pcs = withAbsoluteTicks(run(modal).tracks[0]).filter((e) => e.type === 'programChange');
    expect(pcs.length).toBe(1);
    expect(pcs[0]).toMatchObject({ absTick: 0, programNumber: 40 });
  });

  it('falls back to one tick-0 program change from channel.program when no PCs are retained', () => {
    // Back-compat: programChangeEvents empty (e.g. channel created by an edit).
    const modal = makeModal({
      fullSequence: [{ t: 0, g: 120, n: 60, c: 0, v: 100 }],
      channels: [{ channel: 0, program: 24 }],
      programChangeEvents: []
    });
    const pcs = withAbsoluteTicks(run(modal).tracks[0]).filter((e) => e.type === 'programChange');
    expect(pcs.length).toBe(1);
    expect(pcs[0]).toMatchObject({ absTick: 0, programNumber: 24 });
  });

  it('still works when programChangeEvents is undefined (legacy modal state)', () => {
    const modal = makeModal({
      fullSequence: [{ t: 0, g: 120, n: 60, c: 0, v: 100 }],
      channels: [{ channel: 0, program: 5 }],
      programChangeEvents: undefined
    });
    const pcs = run(modal).tracks[0].filter((e) => e.type === 'programChange');
    expect(pcs.length).toBe(1);
    expect(pcs[0].programNumber).toBe(5);
  });

  it('never emits a program change on channel 9, even with retained drum-channel PCs', () => {
    const modal = makeModal({
      fullSequence: [{ t: 0, g: 120, n: 36, c: 9, v: 100 }],
      channels: [{ channel: 9, program: 0 }],
      programChangeEvents: [
        { ticks: 0, channel: 9, program: 0 },
        { ticks: 1000, channel: 9, program: 5 }
      ]
    });
    const pcs = run(modal).tracks[0].filter((e) => e.type === 'programChange');
    expect(pcs.length).toBe(0);
  });

  it('clamps out-of-range mid-song program and tick values', () => {
    const modal = makeModal({
      fullSequence: [
        { t: 0, g: 120, n: 60, c: 0, v: 100 },
        { t: 5000, g: 120, n: 67, c: 0, v: 100 }
      ],
      channels: [{ channel: 0, program: 0 }],
      programChangeEvents: [
        { ticks: -10, channel: 0, program: 0 },
        { ticks: 5000, channel: 0, program: 999 }
      ]
    });
    const pcs = withAbsoluteTicks(run(modal).tracks[0]).filter((e) => e.type === 'programChange');
    expect(pcs.length).toBe(2);
    expect(pcs.every((p) => p.programNumber >= 0 && p.programNumber <= 127)).toBe(true);
    expect(pcs[0].absTick).toBe(0); // -10 clamped up to 0
    expect(pcs[1].programNumber).toBe(127); // 999 clamped down to 127
  });
});

describe('MidiEditorSequence — retains program changes on load (audit D MD2)', () => {
  function makeLoadModal(tracks) {
    return {
      midiData: { header: { ticksPerBeat: 480 }, tracks },
      log: vi.fn(),
      t: (k) => k,
      getInstrumentName: (p) => `Program${p}`,
      ccOps: { extractCCAndPitchbend: vi.fn(), updateDynamicCCButtons: vi.fn() },
      activeChannels: new Set()
    };
  }

  it('captures every programChange with its absolute tick', () => {
    const modal = makeLoadModal([
      {
        events: [
          { deltaTime: 0, type: 'programChange', channel: 0, programNumber: 0 },
          { deltaTime: 0, type: 'noteOn', channel: 0, noteNumber: 60, velocity: 100 },
          { deltaTime: 480, type: 'noteOff', channel: 0, noteNumber: 60, velocity: 0 },
          { deltaTime: 0, type: 'programChange', channel: 0, programNumber: 40 },
          { deltaTime: 0, type: 'noteOn', channel: 0, noteNumber: 67, velocity: 100 },
          { deltaTime: 480, type: 'noteOff', channel: 0, noteNumber: 67, velocity: 0 }
        ]
      }
    ]);

    new MidiEditorSequence(modal).convertMidiToSequence();

    expect(modal.programChangeEvents).toEqual([
      { ticks: 0, channel: 0, program: 0 },
      { ticks: 480, channel: 0, program: 40 }
    ]);
    // The displayed program remains the last one seen (existing behaviour).
    expect(modal.channels.find((c) => c.channel === 0).program).toBe(40);
  });

  it('round-trips a multi-program channel: load then save preserves both changes', () => {
    const loadModal = makeLoadModal([
      {
        events: [
          { deltaTime: 0, type: 'programChange', channel: 0, programNumber: 0 },
          { deltaTime: 0, type: 'noteOn', channel: 0, noteNumber: 60, velocity: 100 },
          { deltaTime: 960, type: 'noteOff', channel: 0, noteNumber: 60, velocity: 0 },
          { deltaTime: 0, type: 'programChange', channel: 0, programNumber: 48 },
          { deltaTime: 0, type: 'noteOn', channel: 0, noteNumber: 67, velocity: 100 },
          { deltaTime: 480, type: 'noteOff', channel: 0, noteNumber: 67, velocity: 0 }
        ]
      }
    ]);
    new MidiEditorSequence(loadModal).convertMidiToSequence();

    // Hand the loaded state to the writer.
    const saveModal = makeModal({
      fullSequence: loadModal.fullSequence,
      channels: loadModal.channels,
      programChangeEvents: loadModal.programChangeEvents,
      tempoEvents: loadModal.tempoEvents,
      midiData: { header: { ticksPerBeat: 480 } }
    });
    const pcs = withAbsoluteTicks(
      new MidiEditorFileOps(saveModal).convertSequenceToMidi().tracks[0]
    ).filter((e) => e.type === 'programChange');

    expect(pcs.map((p) => p.programNumber)).toEqual([0, 48]);
    expect(pcs[1].absTick).toBe(960);
  });
});

describe('MidiEditorChannelOps.splitChannelByProgram (audit combo Part 3)', () => {
  function makeSplitCtx(overrides = {}) {
    const notifications = [];
    const modal = {
      showNotification: (msg, level) => notifications.push({ msg, level }),
      t: (k) => k,
      log: vi.fn(),
      getInstrumentName: (p) => `Program${p}`,
      isDirty: false,
      activeChannels: new Set([0]),
      sequenceOps: {
        syncFullSequenceFromPianoRoll: vi.fn(),
        updateSequenceFromActiveChannels: vi.fn()
      },
      ccPicker: { updateChannelsFromSequence: vi.fn() },
      routingOps: { updateSaveButton: vi.fn() },
      renderer: { updateInstrumentSelector: vi.fn() },
      tablatureOps: { _closeChannelSettingsPopover: vi.fn() },
      container: undefined,
      fullSequence: [],
      channels: [],
      programChangeEvents: [],
      ...overrides
    };
    const parent = { modal, updateEditButtons: vi.fn() };
    return { ops: new MidiEditorChannelOps(parent), modal, notifications };
  }

  it('splits a multi-program channel: dominant keeps the channel, others move', () => {
    // 3 notes under program 0 (dominant), 2 under program 40.
    const { ops, modal, notifications } = makeSplitCtx({
      fullSequence: [
        { t: 0, g: 100, n: 60, c: 0, v: 100 },
        { t: 100, g: 100, n: 62, c: 0, v: 100 },
        { t: 200, g: 100, n: 64, c: 0, v: 100 },
        { t: 1000, g: 100, n: 67, c: 0, v: 100 },
        { t: 1100, g: 100, n: 69, c: 0, v: 100 }
      ],
      channels: [{ channel: 0, program: 40, instrument: 'Program40', noteCount: 5 }],
      programChangeEvents: [
        { ticks: 0, channel: 0, program: 0 },
        { ticks: 1000, channel: 0, program: 40 }
      ]
    });

    ops.splitChannelByProgram(0);

    // Program-0 notes (dominant, 3) stay on channel 0; program-40 notes move.
    const stay = modal.fullSequence.filter((n) => n.t < 1000);
    const moved = modal.fullSequence.filter((n) => n.t >= 1000);
    expect(stay.every((n) => n.c === 0)).toBe(true);
    const movedChannel = moved[0].c;
    expect(movedChannel).not.toBe(0);
    expect(moved.every((n) => n.c === movedChannel)).toBe(true);

    // A new channel entry was registered for the moved program.
    const newCh = modal.channels.find((c) => c.channel === movedChannel);
    expect(newCh).toMatchObject({ program: 40 });
    expect(modal.activeChannels.has(movedChannel)).toBe(true);

    // programChangeEvents now holds one tick-0 entry per resulting channel.
    const ch0PCs = modal.programChangeEvents.filter((p) => p.channel === 0);
    const newPCs = modal.programChangeEvents.filter((p) => p.channel === movedChannel);
    expect(ch0PCs).toEqual([{ ticks: 0, channel: 0, program: 0 }]);
    expect(newPCs).toEqual([{ ticks: 0, channel: movedChannel, program: 40 }]);

    expect(modal.isDirty).toBe(true);
    expect(notifications.some((n) => n.level === 'success')).toBe(true);
  });

  it('is a no-op with an info notice on a single-program channel', () => {
    const { ops, modal, notifications } = makeSplitCtx({
      fullSequence: [{ t: 0, g: 100, n: 60, c: 0, v: 100 }],
      channels: [{ channel: 0, program: 0, instrument: 'Program0', noteCount: 1 }],
      programChangeEvents: [{ ticks: 0, channel: 0, program: 0 }]
    });
    ops.splitChannelByProgram(0);
    expect(modal.isDirty).toBe(false);
    expect(notifications).toEqual([{ msg: 'midiEditor.splitByProgramNotMulti', level: 'info' }]);
  });

  it('refuses to split channel 9 (drums ignore program changes)', () => {
    const { ops, modal, notifications } = makeSplitCtx();
    ops.splitChannelByProgram(9);
    expect(modal.isDirty).toBe(false);
    expect(notifications).toEqual([{ msg: 'midiEditor.splitByProgramDrums', level: 'info' }]);
  });

  it('errors when there are not enough free channels', () => {
    // Occupy every non-drum channel so no free channel remains for the move.
    const channels = [];
    for (let i = 0; i < 16; i++) {
      if (i === 9) continue;
      channels.push({ channel: i, program: 0, instrument: 'Program0', noteCount: 1 });
    }
    const { ops, modal, notifications } = makeSplitCtx({
      fullSequence: [
        { t: 0, g: 100, n: 60, c: 0, v: 100 },
        { t: 1000, g: 100, n: 67, c: 0, v: 100 }
      ],
      channels,
      programChangeEvents: [
        { ticks: 0, channel: 0, program: 0 },
        { ticks: 1000, channel: 0, program: 40 }
      ]
    });
    ops.splitChannelByProgram(0);
    expect(modal.isDirty).toBe(false);
    expect(notifications.some((n) => n.level === 'error')).toBe(true);
  });
});

describe('MidiEditorRenderer multi-program badge (audit combo Part 1c)', () => {
  function makeRendererModal(overrides = {}) {
    return {
      t: (k) => k,
      tHtml: (k) => k,
      channelColors: ['#f00', '#0f0', '#00f'],
      activeChannels: new Set([0, 1]),
      channelDisabled: new Set(),
      channelPlayableHighlights: new Set(),
      channelRouting: new Map(),
      _routedGmPrograms: new Map(),
      _splitChannelNames: new Map(),
      _stringInstrumentCCEnabled: new Map(),
      tablatureOps: { getRoutedInstrumentName: () => null },
      channels: [],
      programChangeEvents: [],
      ...overrides
    };
  }

  it('renders the badge only for channels with more than one distinct program', () => {
    const modal = makeRendererModal({
      channels: [
        {
          channel: 0,
          program: 40,
          instrument: 'Program40',
          noteCount: 5,
          hasExplicitProgram: true
        },
        { channel: 1, program: 0, instrument: 'Program0', noteCount: 3, hasExplicitProgram: true }
      ],
      programChangeEvents: [
        { ticks: 0, channel: 0, program: 0 },
        { ticks: 1000, channel: 0, program: 40 },
        { ticks: 0, channel: 1, program: 0 }
      ]
    });
    const html = new MidiEditorRenderer(modal).renderChannelButtons();
    const badgeCount = (html.match(/chip-multiprogram-badge/g) || []).length;
    expect(badgeCount).toBe(1);
  });

  it('renders no badge when no channel is multi-program', () => {
    const modal = makeRendererModal({
      channels: [
        { channel: 0, program: 0, instrument: 'Program0', noteCount: 3, hasExplicitProgram: true }
      ],
      programChangeEvents: [{ ticks: 0, channel: 0, program: 0 }]
    });
    const html = new MidiEditorRenderer(modal).renderChannelButtons();
    expect(html).not.toContain('chip-multiprogram-badge');
  });

  it('ignores channel 9 program changes for the badge', () => {
    const modal = makeRendererModal({
      channels: [
        { channel: 9, program: 0, instrument: 'Drums', noteCount: 4, hasExplicitProgram: true }
      ],
      activeChannels: new Set([9]),
      programChangeEvents: [
        { ticks: 0, channel: 9, program: 0 },
        { ticks: 1000, channel: 9, program: 5 }
      ]
    });
    const html = new MidiEditorRenderer(modal).renderChannelButtons();
    expect(html).not.toContain('chip-multiprogram-badge');
  });
});
