// tests/frontend/hands-lookahead-strip.test.js
// E.6.5: HandsLookaheadStrip is the small horizontal piano-roll
// shown above the keyboard in the HandsPreviewPanel (claviers only).
// Tests focus on the visible-window math (only notes inside
// [now, now + windowSeconds] paint), the unplayable colour change
// and a few defensive guards.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(
  resolve(__dirname, '../../public/js/features/auto-assign/HandsLookaheadStrip.js'),
  'utf8'
);

function installCanvasStub() {
  const calls = [];
  const ctx = new Proxy({ calls }, {
    get(target, prop) {
      if (prop === 'calls') return target.calls;
      if (typeof prop === 'string' && /^(setTransform|fillRect|strokeRect|fillText|beginPath|moveTo|lineTo|closePath|fill|stroke|clearRect|save|restore|translate|scale|rotate|setLineDash|rect|clip|arc)$/.test(prop)) {
        return (...args) => target.calls.push({ method: prop, args });
      }
      return target[prop];
    },
    set(target, prop, value) {
      target[prop] = value;
      target.calls.push({ method: 'set', prop, value });
      return true;
    }
  });
  HTMLCanvasElement.prototype.getContext = () => ctx;
  return ctx;
}

beforeAll(() => {
  installCanvasStub();
  new Function(src)();
});

beforeEach(() => {
  document.body.innerHTML = '';
});

function makeCanvas(width = 600, height = 80) {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth',  { value: width, configurable: true });
  Object.defineProperty(canvas, 'clientHeight', { value: height, configurable: true });
  document.body.appendChild(canvas);
  return canvas;
}

function makeStrip(opts = {}) {
  return new window.HandsLookaheadStrip(makeCanvas(opts.width, opts.height), {
    ticksPerSecond: 480,        // simple: 1 tick = 1 ms equivalent at this rate
    rangeMin: 36, rangeMax: 96,
    windowSeconds: 4,
    ...opts
  });
}

describe('HandsLookaheadStrip — construction', () => {
  it('initialises currentSec at 0', () => {
    const s = makeStrip();
    expect(s.currentSec).toBe(0);
  });

  it('clamps windowSeconds to [1, 10]', () => {
    expect(makeStrip({ windowSeconds: 0 }).windowSeconds).toBe(1);
    expect(makeStrip({ windowSeconds: 50 }).windowSeconds).toBe(10);
  });

  it('sorts notes by tick when constructed out of order', () => {
    const s = makeStrip({
      notes: [
        { tick: 1920, note: 60 },
        { tick: 0,    note: 60 },
        { tick: 480,  note: 60 }
      ]
    });
    expect(s.notes.map(n => n.tick)).toEqual([0, 480, 1920]);
  });
});

describe('HandsLookaheadStrip — _firstVisibleIndex', () => {
  it('returns 0 when sec is before all notes', () => {
    const s = makeStrip({
      notes: [{ tick: 480, note: 60, duration: 240 }, { tick: 1920, note: 64, duration: 240 }]
    });
    expect(s._firstVisibleIndex(0)).toBe(0);
  });

  it('skips notes that already ended', () => {
    const s = makeStrip({
      notes: [{ tick: 0, note: 60, duration: 240 }, { tick: 1920, note: 64, duration: 240 }]
    });
    // Note at tick 0..240 ended at 0.5s. At sec=1 the first visible is index 1.
    expect(s._firstVisibleIndex(1)).toBe(1);
  });
});

describe('HandsLookaheadStrip — drawing', () => {
  it('paints background + now line + a fillRect per visible note', () => {
    const ctx = installCanvasStub();
    const s = new window.HandsLookaheadStrip(makeCanvas(), {
      ticksPerSecond: 480, rangeMin: 36, rangeMax: 96, windowSeconds: 4,
      notes: [
        { tick: 480,  note: 60, duration: 240 }, // visible (0.5s start)
        { tick: 1920, note: 64, duration: 240 }, // visible (4s start exactly)
        { tick: 9999, note: 67, duration: 240 }  // far away → not visible
      ]
    });
    s.draw();
    const fillRects = ctx.calls.filter(c => c.method === 'fillRect');
    // background + 2 visible notes
    expect(fillRects.length).toBe(3);
  });

  it('draws notes farther up the canvas for higher pitches', () => {
    const ctx = installCanvasStub();
    const s = new window.HandsLookaheadStrip(makeCanvas(), {
      ticksPerSecond: 480, rangeMin: 36, rangeMax: 96, windowSeconds: 4,
      notes: [
        { tick: 480, note: 40, duration: 240 }, // low
        { tick: 480, note: 90, duration: 240 }  // high
      ]
    });
    s.draw();
    // Each fillRect's args are [x, y, w, h]. Capture the y for the
    // two notes — the higher pitch should have a smaller y (top of canvas).
    const fillRects = ctx.calls.filter(c => c.method === 'fillRect').slice(1); // skip background
    expect(fillRects).toHaveLength(2);
    const [yLow, yHigh] = [fillRects[0].args[1], fillRects[1].args[1]];
    // Both notes were given in the same order as added: low first, high second.
    expect(yLow).toBeGreaterThan(yHigh);
  });

  it('uses a red tint for unplayable notes', () => {
    const ctx = installCanvasStub();
    const s = new window.HandsLookaheadStrip(makeCanvas(), {
      ticksPerSecond: 480, rangeMin: 36, rangeMax: 96, windowSeconds: 4,
      notes: [{ tick: 480, note: 60, duration: 240 }]
    });
    s.setUnplayableNotes([60]);
    s.draw();
    const fillStyles = ctx.calls.filter(c => c.method === 'set' && c.prop === 'fillStyle').map(c => c.value);
    expect(fillStyles.some(v => v.startsWith('rgba(220, 38, 38'))).toBe(true);
  });

  it('honours setCurrentTime — notes that scrolled past disappear', () => {
    const ctx = installCanvasStub();
    const s = new window.HandsLookaheadStrip(makeCanvas(), {
      ticksPerSecond: 480, rangeMin: 36, rangeMax: 96, windowSeconds: 4,
      notes: [{ tick: 0, note: 60, duration: 240 }, { tick: 4800, note: 64, duration: 240 }]
    });
    // At t=10s the first note is long gone; the second (10s away from
    // t=10s? note at tick 4800 → 10s, so it just became "now") is at
    // the left edge. Either way, we have 1 visible.
    s.setCurrentTime(10);
    const fillRects = ctx.calls.filter(c => c.method === 'fillRect').slice(1);
    expect(fillRects.length).toBeLessThanOrEqual(1);
  });

  it('does not throw on empty canvas (width=0)', () => {
    const canvas = makeCanvas(0, 80);
    const s = new window.HandsLookaheadStrip(canvas, {
      ticksPerSecond: 480, notes: [{ tick: 0, note: 60 }]
    });
    expect(() => s.draw()).not.toThrow();
  });
});

describe('HandsLookaheadStrip — destroy', () => {
  it('clears note caches', () => {
    const s = makeStrip({ notes: [{ tick: 0, note: 60 }] });
    s.setUnplayableNotes([60]);
    s.destroy();
    expect(s.notes.length).toBe(0);
    expect(s._noteTimes.length).toBe(0);
    expect(s.unplayableNotes.size).toBe(0);
  });
});
