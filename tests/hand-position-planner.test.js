// tests/hand-position-planner.test.js
// HandPositionPlanner: CC emission + feasibility warnings.

import { describe, test, expect } from '@jest/globals';
import HandPositionPlanner from '../src/midi/adaptation/HandPositionPlanner.js';

// Simplified per-hand shape: only CC + span. Travel speed is shared in
// the root config; reachable range and min-interval come via the
// instrument context passed as second constructor arg.
const pianoCfg = {
  enabled: true,
  hand_move_semitones_per_sec: 60,
  hands: [
    { id: 'left',  cc_position_number: 23, hand_span_semitones: 14 },
    { id: 'right', cc_position_number: 24, hand_span_semitones: 14 }
  ]
};
// Full 88-key piano range so anchor-logic tests don't hit the clamp.
const pianoCtx = { noteRangeMin: 21, noteRangeMax: 108, minNoteIntervalMs: 40 };

const note = (time, pitch, hand, extra = {}) => ({
  time, note: pitch, channel: 0, velocity: 80, hand, ...extra
});

describe('HandPositionPlanner — basic emission', () => {
  test('emits initial CC just before first note per hand', () => {
    const p = new HandPositionPlanner(pianoCfg, pianoCtx);
    const { ccEvents } = p.plan([note(1.0, 40, 'left'), note(1.0, 72, 'right')]);
    // One CC per hand.
    expect(ccEvents).toHaveLength(2);
    const left = ccEvents.find(e => e.hand === 'left');
    const right = ccEvents.find(e => e.hand === 'right');
    expect(left.controller).toBe(23);
    expect(left.value).toBe(40);
    expect(left.time).toBeLessThan(1.0);
    expect(right.controller).toBe(24);
    expect(right.value).toBe(72);
    expect(right.time).toBeLessThan(1.0);
  });

  test('no CC shift when consecutive notes stay inside the window', () => {
    const p = new HandPositionPlanner(pianoCfg, pianoCtx);
    const notes = [
      note(0.0, 48, 'left'),
      note(0.5, 52, 'left'),
      note(1.0, 55, 'left'),
      note(1.5, 60, 'left')
    ];
    const { ccEvents, stats } = p.plan(notes);
    expect(ccEvents).toHaveLength(1);
    expect(stats.shifts.left).toBe(1);
  });

  test('shifts window when next note goes above span', () => {
    const p = new HandPositionPlanner(pianoCfg, pianoCtx);
    const notes = [
      note(0.0, 48, 'left'),
      note(2.0, 70, 'left')  // +22 semitones > span 14 → shift
    ];
    const { ccEvents, stats } = p.plan(notes);
    expect(ccEvents).toHaveLength(2);
    expect(stats.shifts.left).toBe(2);
    expect(ccEvents[1].value).toBe(70);
  });

  test('shift for a chord anchors so the chord fits at the top of the window', () => {
    const p = new HandPositionPlanner(pianoCfg, pianoCtx);
    const notes = [
      note(0.0, 40, 'left'),
      note(5.0, 62, 'left'),
      note(5.0, 68, 'left')
    ];
    const { ccEvents } = p.plan(notes);
    expect(ccEvents).toHaveLength(2);
    expect(ccEvents[1].value).toBe(62);
  });

  test('shifts window when next note goes below window', () => {
    const p = new HandPositionPlanner(pianoCfg, pianoCtx);
    const notes = [
      note(0.0, 60, 'left'),
      note(2.0, 40, 'left')
    ];
    const { ccEvents } = p.plan(notes);
    expect(ccEvents).toHaveLength(2);
    expect(ccEvents[1].value).toBe(40);
  });

  test('CC value is always the anchor lowest note, raw (0-127)', () => {
    const p = new HandPositionPlanner(pianoCfg, pianoCtx);
    const { ccEvents } = p.plan([note(0, 21, 'left')]);
    expect(ccEvents[0].value).toBe(21);
  });
});

describe('HandPositionPlanner — chord handling', () => {
  test('simultaneous notes on same hand merge into one chord group', () => {
    const p = new HandPositionPlanner(pianoCfg, pianoCtx);
    const chord = [48, 52, 55].map(pitch => note(0, pitch, 'left'));
    const { ccEvents, stats } = p.plan(chord);
    expect(ccEvents).toHaveLength(1);
    expect(stats.shifts.left).toBe(1);
    expect(ccEvents[0].value).toBe(48);
  });

  test('interleaved L/R at same time produces two CCs (one per hand)', () => {
    const p = new HandPositionPlanner(pianoCfg, pianoCtx);
    const events = [
      note(0, 40, 'left'),
      note(0, 72, 'right'),
      note(0, 45, 'left'),
      note(0, 76, 'right')
    ];
    const { ccEvents } = p.plan(events);
    expect(ccEvents).toHaveLength(2);
    expect(ccEvents.find(e => e.hand === 'left').value).toBe(40);
    expect(ccEvents.find(e => e.hand === 'right').value).toBe(72);
  });

  test('chord wider than span flags chord_span_exceeded', () => {
    const p = new HandPositionPlanner(pianoCfg, pianoCtx);
    const events = [
      note(0, 40, 'left'),
      note(0, 60, 'left')  // span 20 > 14
    ];
    const { warnings } = p.plan(events);
    expect(warnings.some(w => w.code === 'chord_span_exceeded')).toBe(true);
  });
});

describe('HandPositionPlanner — feasibility warnings', () => {
  test('move_too_fast fires when shift does not fit in available time', () => {
    const p = new HandPositionPlanner(pianoCfg, pianoCtx);
    // 20-semitone shift at 60 semitones/sec needs 333ms. We give 50ms.
    const events = [
      note(0.0, 40, 'left'),
      note(0.05, 60, 'left')
    ];
    const { warnings } = p.plan(events);
    expect(warnings.some(w => w.code === 'move_too_fast')).toBe(true);
  });

  test('move_too_fast does not fire when there is enough time', () => {
    const p = new HandPositionPlanner(pianoCfg, pianoCtx);
    const events = [
      note(0.0, 40, 'left'),
      note(5.0, 60, 'left')
    ];
    const { warnings } = p.plan(events);
    expect(warnings.some(w => w.code === 'move_too_fast')).toBe(false);
  });

  test('finger_interval_violated fires when two notes are closer than min_note_interval', () => {
    const p = new HandPositionPlanner(pianoCfg, pianoCtx);
    const events = [
      note(0.000, 48, 'left'),
      note(0.010, 50, 'left')  // 10ms < 40ms min
    ];
    const { warnings } = p.plan(events);
    expect(warnings.some(w => w.code === 'finger_interval_violated')).toBe(true);
  });

  test('finger_interval check is disabled when instrument has no min_note_interval', () => {
    const p = new HandPositionPlanner(pianoCfg, { noteRangeMin: 21, noteRangeMax: 108 });
    const events = [
      note(0.000, 48, 'left'),
      note(0.001, 50, 'left')
    ];
    const { warnings } = p.plan(events);
    expect(warnings.some(w => w.code === 'finger_interval_violated')).toBe(false);
  });

  test('out_of_range fires for notes outside instrument reach', () => {
    const ctx = { noteRangeMin: 21, noteRangeMax: 72 };
    const cfg = {
      enabled: true,
      hand_move_semitones_per_sec: 60,
      hands: [{ id: 'left', cc_position_number: 23, hand_span_semitones: 14 }]
    };
    const p = new HandPositionPlanner(cfg, ctx);
    const events = [
      note(0, 20, 'left'),  // below min 21
      note(1, 80, 'left')   // above max 72
    ];
    const { warnings } = p.plan(events);
    const codes = warnings.map(w => w.code);
    expect(codes.filter(c => c === 'out_of_range').length).toBe(2);
  });
});

describe('HandPositionPlanner — clamp to instrument range', () => {
  const cfg = {
    enabled: true,
    hand_move_semitones_per_sec: 60,
    hands: [{ id: 'left', cc_position_number: 23, hand_span_semitones: 14 }]
  };

  test('CC anchor is clamped below noteRangeMin', () => {
    const p = new HandPositionPlanner(cfg, { noteRangeMin: 40, noteRangeMax: 60 });
    const { ccEvents, warnings } = p.plan([
      { time: 0, note: 30, channel: 0, velocity: 80, hand: 'left' }
    ]);
    expect(ccEvents[0].value).toBe(40);
    expect(warnings.some(w => w.code === 'out_of_range')).toBe(true);
  });

  test('CC anchor is clamped so window top stays <= noteRangeMax', () => {
    const p = new HandPositionPlanner(cfg, { noteRangeMin: 40, noteRangeMax: 60 });
    const { ccEvents, warnings } = p.plan([
      { time: 0, note: 70, channel: 0, velocity: 80, hand: 'left' }
    ]);
    // 70 alone would anchor at 70, but 70+14=84 > max 60 → clamp to 60-14=46.
    expect(ccEvents[0].value).toBe(46);
    expect(warnings.some(w => w.code === 'out_of_range')).toBe(true);
  });

  test('clamping never drops below noteRangeMin', () => {
    const p = new HandPositionPlanner(cfg, { noteRangeMin: 60, noteRangeMax: 65 });
    const { ccEvents } = p.plan([
      { time: 0, note: 80, channel: 0, velocity: 80, hand: 'left' }
    ]);
    expect(ccEvents[0].value).toBeGreaterThanOrEqual(60);
  });
});

describe('HandPositionPlanner — CC emission timing', () => {
  test('subsequent shift CC is scheduled right after previous note-on', () => {
    const p = new HandPositionPlanner(pianoCfg, pianoCtx);
    const events = [
      note(1.0, 40, 'left'),
      note(5.0, 70, 'left')
    ];
    const { ccEvents } = p.plan(events);
    expect(ccEvents).toHaveLength(2);
    expect(ccEvents[1].time).toBeGreaterThan(1.0);
    expect(ccEvents[1].time).toBeLessThan(1.01);
  });

  test('first CC per hand is emitted just before the first note', () => {
    const p = new HandPositionPlanner(pianoCfg, pianoCtx);
    const events = [note(2.0, 60, 'left')];
    const { ccEvents } = p.plan(events);
    expect(ccEvents[0].time).toBeLessThan(2.0);
    expect(ccEvents[0].time).toBeGreaterThan(1.99);
  });
});

// -----------------------------------------------------------------------------
// frets mode: a single fretting hand, axis = absolute fret number, travel in
// frets/sec. Input events carry `fretPosition` instead of using `note`.
// -----------------------------------------------------------------------------

const guitarCfg = {
  enabled: true,
  mode: 'frets',
  hand_move_frets_per_sec: 12,
  hands: [
    { id: 'fretting', cc_position_number: 22, hand_span_frets: 4 }
  ]
};
// Standard 22-fret guitar: axis is [0, 22].
const guitarCtx = { unit: 'frets', noteRangeMin: 0, noteRangeMax: 22 };

const fretNote = (time, fret, extra = {}) => ({
  time,
  note: 60, // unused in frets mode but required by other code paths
  fretPosition: fret,
  channel: 0,
  velocity: 80,
  hand: 'fretting',
  ...extra
});

describe('HandPositionPlanner — frets mode', () => {
  test('emits initial CC just before first fretted note', () => {
    const p = new HandPositionPlanner(guitarCfg, guitarCtx);
    const { ccEvents } = p.plan([fretNote(1.0, 5)]);
    expect(ccEvents).toHaveLength(1);
    expect(ccEvents[0].controller).toBe(22);
    expect(ccEvents[0].value).toBe(5);
    expect(ccEvents[0].time).toBeLessThan(1.0);
    expect(ccEvents[0].hand).toBe('fretting');
  });

  test('no shift while consecutive frets stay inside the span', () => {
    const p = new HandPositionPlanner(guitarCfg, guitarCtx);
    const { ccEvents, stats } = p.plan([
      fretNote(0.0, 5),
      fretNote(0.5, 6),
      fretNote(1.0, 8),
      fretNote(1.5, 9) // window [5..9], span 4
    ]);
    expect(ccEvents).toHaveLength(1);
    expect(stats.shifts.fretting).toBe(1);
  });

  test('shifts window upward when next fret exceeds span', () => {
    const p = new HandPositionPlanner(guitarCfg, guitarCtx);
    const { ccEvents } = p.plan([
      fretNote(0.0, 5),
      fretNote(2.0, 15)
    ]);
    expect(ccEvents).toHaveLength(2);
    expect(ccEvents[1].value).toBe(15);
  });

  test('shifts window downward when next fret is below current window', () => {
    const p = new HandPositionPlanner(guitarCfg, guitarCtx);
    const { ccEvents } = p.plan([
      fretNote(0.0, 10),
      fretNote(2.0, 2)
    ]);
    expect(ccEvents).toHaveLength(2);
    expect(ccEvents[1].value).toBe(2);
  });

  test('CC value for an isolated open string is 0 when not filtered upstream', () => {
    const p = new HandPositionPlanner(guitarCfg, guitarCtx);
    const { ccEvents } = p.plan([fretNote(0, 0)]);
    expect(ccEvents[0].value).toBe(0);
  });

  test('events without fretPosition are skipped (grouping safety)', () => {
    const p = new HandPositionPlanner(guitarCfg, guitarCtx);
    const { ccEvents } = p.plan([
      { time: 0, note: 60, channel: 0, velocity: 80, hand: 'fretting' }, // no fretPosition
      fretNote(1, 7)
    ]);
    expect(ccEvents).toHaveLength(1);
    expect(ccEvents[0].value).toBe(7);
  });

  test('chord wider than hand_span_frets flags chord_span_exceeded', () => {
    const p = new HandPositionPlanner(guitarCfg, guitarCtx);
    const { warnings } = p.plan([
      fretNote(0, 3),
      fretNote(0, 10) // chord span 7 > 4
    ]);
    expect(warnings.some(w => w.code === 'chord_span_exceeded')).toBe(true);
    expect(warnings.find(w => w.code === 'chord_span_exceeded').message).toMatch(/frets/);
  });

  test('move_too_fast reports frets unit and fires when shift is too fast', () => {
    const p = new HandPositionPlanner(guitarCfg, guitarCtx);
    // 15 frets shift at 12 frets/sec needs 1250ms; we give 50ms.
    const { warnings } = p.plan([
      fretNote(0.0, 2),
      fretNote(0.05, 20)
    ]);
    const mtf = warnings.find(w => w.code === 'move_too_fast');
    expect(mtf).toBeDefined();
    expect(mtf.message).toMatch(/frets/);
  });

  test('out_of_range fires for fret above instrument max', () => {
    const p = new HandPositionPlanner(guitarCfg, { unit: 'frets', noteRangeMin: 0, noteRangeMax: 12 });
    const { warnings } = p.plan([fretNote(0, 18)]);
    const oor = warnings.find(w => w.code === 'out_of_range');
    expect(oor).toBeDefined();
    expect(oor.message).toMatch(/Fret 18/);
  });

  test('fretless (float positions) produces rounded CC values', () => {
    const p = new HandPositionPlanner(guitarCfg, { unit: 'frets', noteRangeMin: 0, noteRangeMax: 24 });
    const { ccEvents } = p.plan([fretNote(0, 3.4), fretNote(2, 8.6)]);
    expect(ccEvents.map(e => e.value)).toEqual([3, 9]);
  });

  test('semitones fields on a frets config are ignored (unit is explicit)', () => {
    const cfg = {
      ...guitarCfg,
      // stray semitones fields should have no effect
      hand_move_semitones_per_sec: 60,
      hands: [
        { id: 'fretting', cc_position_number: 22, hand_span_frets: 4, hand_span_semitones: 14 }
      ]
    };
    const p = new HandPositionPlanner(cfg, guitarCtx);
    const { ccEvents } = p.plan([
      fretNote(0, 3),
      fretNote(2, 9) // within 4 frets? 9-3=6 > 4 → shift
    ]);
    expect(ccEvents).toHaveLength(2);
    expect(ccEvents[1].value).toBe(9);
  });
});

describe('HandPositionPlanner — edge cases', () => {
  test('empty notes list returns empty plan', () => {
    const p = new HandPositionPlanner(pianoCfg, pianoCtx);
    const { ccEvents, warnings } = p.plan([]);
    expect(ccEvents).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  test('note with unknown hand id is skipped (defensive)', () => {
    const p = new HandPositionPlanner(pianoCfg, pianoCtx);
    const { ccEvents } = p.plan([note(0, 60, 'middle')]);
    expect(ccEvents).toHaveLength(0);
  });

  test('velocity-0 note-ons (logical note-offs) are ignored', () => {
    const p = new HandPositionPlanner(pianoCfg, pianoCtx);
    const events = [
      { time: 0, note: 60, hand: 'right', channel: 0, velocity: 0 }
    ];
    const { ccEvents } = p.plan(events);
    expect(ccEvents).toHaveLength(0);
  });
});
