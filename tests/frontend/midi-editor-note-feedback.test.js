// tests/frontend/midi-editor-note-feedback.test.js
//
// Audit D N3: handleNoteFeedback diffed the previous vs current sequence with a
// key of `tick_channel_INDEX`. Inserting/deleting a note shifts every later
// array index, so the diff mislabelled unchanged notes as new and played
// wrong/extra audio feedback. The key is now the musical identity
// tick_channel_pitch, so only genuinely-new (tick,channel,pitch) triples fire.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(
  resolve(__dirname, '../../public/js/features/midi-editor/MidiEditorPlayback.js'),
  'utf8'
);
new Function(source)();
const MidiEditorPlayback = /** @type {any} */ (globalThis.window.MidiEditorPlayback);
const handleNoteFeedback = MidiEditorPlayback.prototype.handleNoteFeedback;

function makeCtx(currentSequence) {
  const played = [];
  const ctx = {
    modal: { pianoRollRenderer: { getSequence: () => currentSequence } },
    playNoteFeedback: (n, v, c) => played.push({ n, v, c })
  };
  return { ctx, played };
}

describe('handleNoteFeedback keys by identity, not array index (audit D N3)', () => {
  it('inserting a note at the start plays feedback ONLY for the new note', () => {
    const prev = [
      { t: 480, c: 0, n: 60, v: 100 },
      { t: 960, c: 0, n: 62, v: 100 }
    ];
    const current = [
      { t: 0, c: 0, n: 48, v: 90 }, // inserted at index 0 → shifts the others
      { t: 480, c: 0, n: 60, v: 100 },
      { t: 960, c: 0, n: 62, v: 100 }
    ];
    const { ctx, played } = makeCtx(current);
    handleNoteFeedback.call(ctx, prev);
    expect(played).toHaveLength(1);
    expect(played[0].n).toBe(48);
  });

  it('an unchanged sequence plays no feedback', () => {
    const prev = [{ t: 0, c: 0, n: 60, v: 100 }];
    const current = [{ t: 0, c: 0, n: 60, v: 100 }];
    const { ctx, played } = makeCtx(current);
    handleNoteFeedback.call(ctx, prev);
    expect(played).toHaveLength(0);
  });

  it('changing a note pitch plays the new pitch', () => {
    const prev = [{ t: 0, c: 0, n: 60, v: 100 }];
    const current = [{ t: 0, c: 0, n: 64, v: 100 }];
    const { ctx, played } = makeCtx(current);
    handleNoteFeedback.call(ctx, prev);
    expect(played).toHaveLength(1);
    expect(played[0].n).toBe(64);
  });

  it('deleting a note plays no feedback', () => {
    const prev = [
      { t: 0, c: 0, n: 60, v: 100 },
      { t: 480, c: 0, n: 62, v: 100 }
    ];
    const current = [{ t: 0, c: 0, n: 60, v: 100 }];
    const { ctx, played } = makeCtx(current);
    handleNoteFeedback.call(ctx, prev);
    expect(played).toHaveLength(0);
  });

  it('respects the 5-note cap (a bulk change plays nothing)', () => {
    const current = Array.from({ length: 6 }, (_, i) => ({ t: i * 100, c: 0, n: 60 + i, v: 100 }));
    const { ctx, played } = makeCtx(current);
    handleNoteFeedback.call(ctx, []);
    expect(played).toHaveLength(0);
  });
});
