// tests/frontend/midi-editor-saveas-duplicate.test.js
//
// Audit B2c-M1: file_save_as is content-addressed — when the serialized bytes
// match an existing file the backend returns status:'duplicate' with the
// EXISTING file's id/name and creates nothing new. saveAsFile used to announce
// "saved as {newFilename}" regardless; it must now surface the real outcome.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(
  resolve(__dirname, '../../public/js/features/midi-editor/MidiEditorFileOps.js'),
  'utf8'
);
new Function(source)();
const MidiEditorFileOps = /** @type {any} */ (globalThis.window.MidiEditorFileOps);

function makeCtx(response) {
  const notifications = [];
  const events = [];
  const modal = {
    currentFile: 7,
    api: { sendCommand: vi.fn(async () => response) },
    log: vi.fn(),
    t: (k, p) => `${k}${p ? ':' + JSON.stringify(p) : ''}`,
    showNotification: (msg, level) => notifications.push({ msg, level }),
    showError: vi.fn(),
    eventBus: { emit: (name, payload) => events.push({ name, payload }) }
  };
  const ctx = {
    modal,
    _canSave: () => true,
    _buildMidiPayload: () => ({ header: {}, tracks: [[]] })
  };
  return { ctx, modal, notifications, events };
}

describe('MidiEditorFileOps.saveAsFile duplicate handling (audit B2c-M1)', () => {
  const saveAsFile = MidiEditorFileOps.prototype.saveAsFile;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('created → success toast + saved_as event (duplicate:false)', async () => {
    const { ctx, notifications, events } = makeCtx({
      success: true,
      status: 'created',
      newFileId: 12,
      filename: 'song.mid'
    });
    await saveAsFile.call(ctx, 'song.mid');

    expect(notifications).toHaveLength(1);
    expect(notifications[0].level).toBe('success');
    expect(notifications[0].msg).toContain('midiEditor.saveAsSuccess');
    expect(events).toHaveLength(1);
    expect(events[0].payload.duplicate).toBe(false);
    expect(events[0].payload.newFile).toBe(12);
  });

  it('duplicate → info toast naming the EXISTING file (duplicate:true)', async () => {
    const { ctx, notifications, events } = makeCtx({
      success: true,
      status: 'duplicate',
      newFileId: 3,
      filename: 'original.mid'
    });
    await saveAsFile.call(ctx, 'my-copy.mid');

    expect(notifications).toHaveLength(1);
    expect(notifications[0].level).toBe('info');
    expect(notifications[0].msg).toContain('midiEditor.saveAsDuplicate');
    // The message must name the EXISTING file, not the requested new name.
    expect(notifications[0].msg).toContain('original.mid');
    expect(notifications[0].msg).not.toContain('my-copy.mid');
    expect(events[0].payload.duplicate).toBe(true);
    expect(events[0].payload.newFilename).toBe('original.mid');
  });

  it('failure → error shown, no saved_as event', async () => {
    const { ctx, events, modal } = makeCtx({ success: false });
    await saveAsFile.call(ctx, 'x.mid');
    expect(events).toHaveLength(0);
    expect(modal.showError).toHaveBeenCalled();
  });
});
