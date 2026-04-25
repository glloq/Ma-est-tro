// tests/instrument-matcher-hand-feasibility.test.js
// A.1: InstrumentMatcher.calculateCompatibility now exposes a structured
// `handPositionFeasibility` field derived from the channel's aggregated
// analysis (polyphony max + pitch span) and the instrument's hands_config.
// Verifies: unknown when no hands_config, ok / warning / infeasible
// classifications for both modes, info/issue plumbing, no impact on the
// existing 0-100 score in this commit (A.2 will wire the score later).

import { describe, test, expect } from '@jest/globals';
import InstrumentMatcher from '../src/midi/adaptation/InstrumentMatcher.js';

const silentLogger = { info: () => {}, warn: () => {}, debug: () => {}, error: () => {} };

function baseAnalysis({ polyphonyMax = 4, rangeMin = 60, rangeMax = 72, channel = 0, program = 0 } = {}) {
  return {
    channel,
    primaryProgram: program,
    bankMSB: null,
    bankLSB: null,
    noteRange: { min: rangeMin, max: rangeMax },
    polyphony: { max: polyphonyMax, avg: polyphonyMax },
    usedCCs: [],
    estimatedType: 'keyboard',
    typeConfidence: 1,
    typeScores: {},
    estimatedCategory: null,
    estimatedSubtype: null,
    timingAnalysis: null,
    totalNotes: 100
  };
}

function pianoInstrument(extra = {}) {
  return {
    device_id: 'piano-1',
    channel: 0,
    gm_program: 0,
    polyphony: 64,
    note_range_min: 21,
    note_range_max: 108,
    note_selection_mode: 'range',
    selected_notes: null,
    supported_ccs: null,
    type: 'keyboard',
    ...extra
  };
}

function guitarInstrument(extra = {}) {
  return {
    device_id: 'guitar-1',
    channel: 0,
    gm_program: 24,
    polyphony: 6,
    note_range_min: 40,
    note_range_max: 86,
    note_selection_mode: 'range',
    selected_notes: null,
    supported_ccs: null,
    type: 'guitar',
    ...extra
  };
}

describe('InstrumentMatcher.handPositionFeasibility — unknown', () => {
  test('returns unknown when instrument has no hands_config', () => {
    const m = new InstrumentMatcher(silentLogger);
    const r = m.calculateCompatibility(baseAnalysis(), pianoInstrument());
    expect(r.handPositionFeasibility).toBeDefined();
    expect(r.handPositionFeasibility.level).toBe('unknown');
    expect(r.handPositionFeasibility.qualityScore).toBe(0);
  });

  test('returns unknown when hands_config is explicitly disabled', () => {
    const m = new InstrumentMatcher(silentLogger);
    const r = m.calculateCompatibility(
      baseAnalysis(),
      pianoInstrument({ hands_config: { enabled: false, hands: [] } })
    );
    expect(r.handPositionFeasibility.level).toBe('unknown');
  });

  test('parses hands_config from a JSON string', () => {
    const m = new InstrumentMatcher(silentLogger);
    const handsJson = JSON.stringify({
      enabled: true,
      mode: 'semitones',
      hand_move_semitones_per_sec: 60,
      hands: [
        { id: 'left',  cc_position_number: 23, hand_span_semitones: 14 },
        { id: 'right', cc_position_number: 24, hand_span_semitones: 14 }
      ]
    });
    const r = m.calculateCompatibility(baseAnalysis(), pianoInstrument({ hands_config: handsJson }));
    expect(r.handPositionFeasibility.level).not.toBe('unknown');
  });

  test('malformed hands_config JSON keeps level unknown (defensive)', () => {
    const m = new InstrumentMatcher(silentLogger);
    const r = m.calculateCompatibility(
      baseAnalysis(),
      pianoInstrument({ hands_config: '{ not json' })
    );
    expect(r.handPositionFeasibility.level).toBe('unknown');
  });
});

describe('InstrumentMatcher.handPositionFeasibility — semitones mode', () => {
  const semitonesHands = {
    enabled: true,
    mode: 'semitones',
    hand_move_semitones_per_sec: 60,
    hands: [
      { id: 'left',  cc_position_number: 23, hand_span_semitones: 14 },
      { id: 'right', cc_position_number: 24, hand_span_semitones: 14 }
    ]
  };

  test('comfortable channel yields level "ok"', () => {
    const m = new InstrumentMatcher(silentLogger);
    const analysis = baseAnalysis({ polyphonyMax: 4, rangeMin: 60, rangeMax: 72 });
    const r = m.calculateCompatibility(analysis, pianoInstrument({ hands_config: semitonesHands }));
    expect(r.handPositionFeasibility.level).toBe('ok');
    expect(r.handPositionFeasibility.qualityScore).toBe(100);
  });

  test('wide pitch span (> 2 × total span) flags "warning"', () => {
    const m = new InstrumentMatcher(silentLogger);
    // total span = 28 semitones; 60-ish span = 60 > 56 → warning.
    const analysis = baseAnalysis({ polyphonyMax: 4, rangeMin: 30, rangeMax: 95 });
    const r = m.calculateCompatibility(analysis, pianoInstrument({ hands_config: semitonesHands }));
    expect(r.handPositionFeasibility.level).toBe('warning');
    expect(r.handPositionFeasibility.qualityScore).toBeLessThan(100);
  });

  test('polyphony exceeding total fingers flags "infeasible"', () => {
    const m = new InstrumentMatcher(silentLogger);
    // total fingers = 2 × 5 = 10; polyphony 12 > 10.
    const analysis = baseAnalysis({ polyphonyMax: 12, rangeMin: 60, rangeMax: 72 });
    const r = m.calculateCompatibility(analysis, pianoInstrument({ hands_config: semitonesHands }));
    expect(r.handPositionFeasibility.level).toBe('infeasible');
    expect(r.handPositionFeasibility.issue).not.toBeNull();
    expect(r.handPositionFeasibility.issue.type).toBe('warning');
  });
});

describe('InstrumentMatcher.handPositionFeasibility — frets mode', () => {
  const fretsHands = {
    enabled: true,
    mode: 'frets',
    hand_move_mm_per_sec: 250,
    hands: [{ id: 'fretting', cc_position_number: 22, hand_span_mm: 80, hand_span_frets: 4, max_fingers: 4 }]
  };

  test('comfortable channel yields level "ok"', () => {
    const m = new InstrumentMatcher(silentLogger);
    const analysis = baseAnalysis({ polyphonyMax: 3, rangeMin: 50, rangeMax: 60, channel: 0, program: 24 });
    const r = m.calculateCompatibility(analysis, guitarInstrument({ hands_config: fretsHands }));
    expect(r.handPositionFeasibility.level).toBe('ok');
    expect(r.handPositionFeasibility.summary.mode).toBe('frets');
  });

  test('polyphony > max_fingers flags "infeasible"', () => {
    const m = new InstrumentMatcher(silentLogger);
    const analysis = baseAnalysis({ polyphonyMax: 6, rangeMin: 50, rangeMax: 60, program: 24 });
    const r = m.calculateCompatibility(analysis, guitarInstrument({ hands_config: fretsHands }));
    expect(r.handPositionFeasibility.level).toBe('infeasible');
    expect(r.handPositionFeasibility.issue.message).toMatch(/finger/);
  });

  test('pitch span >> hand_span_frets flags "warning"', () => {
    const m = new InstrumentMatcher(silentLogger);
    // hand_span_frets = 4; threshold = 12; rangeSpan = 30 → warning.
    const analysis = baseAnalysis({ polyphonyMax: 3, rangeMin: 40, rangeMax: 75, program: 24 });
    const r = m.calculateCompatibility(analysis, guitarInstrument({ hands_config: fretsHands }));
    expect(r.handPositionFeasibility.level).toBe('warning');
  });

  test('no max_fingers → no infeasible from polyphony alone', () => {
    const m = new InstrumentMatcher(silentLogger);
    const noMaxFingers = {
      ...fretsHands,
      hands: [{ id: 'fretting', cc_position_number: 22, hand_span_frets: 4 }]
    };
    const analysis = baseAnalysis({ polyphonyMax: 6, rangeMin: 50, rangeMax: 60, program: 24 });
    const r = m.calculateCompatibility(analysis, guitarInstrument({ hands_config: noMaxFingers }));
    expect(r.handPositionFeasibility.level).not.toBe('infeasible');
  });
});

describe('InstrumentMatcher.handPositionFeasibility — score isolation', () => {
  test('A.1 alone does not change the existing 0-100 score', () => {
    const m = new InstrumentMatcher(silentLogger);
    const analysis = baseAnalysis();
    const baseline = m.calculateCompatibility(analysis, pianoInstrument()).score;

    // Adding a hands_config that flags warning/infeasible MUST not move
    // the score in A.1 — A.2 is the one that ties feasibility into the
    // ranking. This guards against accidentally bleeding the heuristic
    // into the score before the weights are wired.
    const withHands = m.calculateCompatibility(analysis, pianoInstrument({
      hands_config: {
        enabled: true,
        mode: 'semitones',
        hand_move_semitones_per_sec: 60,
        hands: [
          { id: 'left',  cc_position_number: 23, hand_span_semitones: 14 },
          { id: 'right', cc_position_number: 24, hand_span_semitones: 14 }
        ]
      }
    })).score;

    expect(withHands).toBe(baseline);
  });
});
