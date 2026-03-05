# MIDI Interface Audit Report

**Date:** 2026-03-05
**Scope:** `src/midi/` — 8 files: ChannelAnalyzer, InstrumentMatcher, DrumNoteMapper, AutoAssigner, MidiTransposer, InstrumentCapabilitiesValidator, ScoringConfig, AnalysisCache

---

## Critical Bugs

### 1. `||` vs `??` for MIDI note 0 (ChannelAnalyzer, DrumNoteMapper)

**Files:** `ChannelAnalyzer.js` lines 146, 170, 199; `DrumNoteMapper.js` line 187

```js
// Current (broken for note 0):
const note = event.note || event.noteNumber || 0;

// Fix:
const note = event.note ?? event.noteNumber ?? 0;
```

MIDI note 0 (C-1) is falsy. The `||` operator skips valid `0` values and falls through to the next option. This affects `extractNoteRange`, `buildNoteHistogram`, and `calculatePolyphony`. `DrumNoteMapper` only checks `event.note`, ignoring `event.noteNumber` entirely.

### 2. DrumNoteMapper counts noteOff events (DrumNoteMapper.js line 186)

`classifyDrumNotes` has no filter for `event.type === 'noteOn'`, so every `noteOff` event also increments the count, approximately **doubling** usage counts.

### 3. ScoringConfig `typeDetection` weights sum to 130, not 100 (ScoringConfig.js lines 25-31)

```
programWeight: 40 + rangeWeight: 25 + polyphonyWeight: 20 + densityWeight: 15 + trackNameWeight: 30 = 130
```

If these weights are intended to normalize to 100, this is incorrect. `validateWeights()` does not validate `typeDetection`.

### 4. MidiTransposer `validateTransposition` missing null check (MidiTransposer.js line 251)

```js
const channelExists = midiData.tracks.some(track =>
  track.events.some(e => e.channel === channel)  // throws if track.events is null/undefined
);
```

Other methods guard with `if (!track.events) continue;` but this one does not.

### 5. DrumNoteMapper sets `mapping[39] = undefined` (DrumNoteMapper.js lines 503-505)

```js
mapping[39] = mapping[37] || mapping[38] || mapping[40];
```

If none of 37, 38, 40 are mapped, this inserts `39: undefined` into the mapping object, inflating `Object.keys(mapping).length` and producing `"Hand Clap (39) -> Note undefined"` in reports.

### 6. InstrumentMatcher `scoreDiscreteNotes` maps entire range, not just used notes (InstrumentMatcher.js lines 423-429)

Generates remapping entries for every note between `min` and `max`, even notes never played. This inflates the mapping dictionary and deflates `supportRatio`, producing incorrectly low compatibility scores.

### 7. Polyphony under-reported for duplicate noteOn without noteOff (ChannelAnalyzer.js lines 198-214)

When a `noteOn` for the same note arrives twice without a `noteOff`, the Map silently overwrites. `activeNotes.size` does not increase, so polyphony is under-counted. A `Map<note, count>` would fix this.

---

## Resource / Safety Issues

### 8. AutoAssigner `setInterval` never cleared without `destroy()` (AutoAssigner.js lines 22-26)

If `AutoAssigner` is instantiated but `destroy()` is never called, the 5-minute interval keeps running, preventing garbage collection of the cache and logger.

### 9. AutoAssigner `generateSuggestions` bypasses cache (AutoAssigner.js line 54)

`analyzeAllChannels` creates fresh analyses every time, never using the cache. Only individual `analyzeChannel` calls use the cache.

### 10. MidiTransposer clamping silently corrupts data (MidiTransposer.js line 174)

Notes pushed outside 0-127 are silently clamped. Multiple notes can collapse to 127, creating unintended unison rather than flagging an error.

---

## Dead Code / Config Disconnect

### 11. ScoringConfig values never consumed

- `typeDetection` weights and `typeThresholds` are defined but never read by `ChannelAnalyzer.estimateInstrumentType`, which uses hardcoded magic numbers.
- `bonuses.perfectNoteRange` is defined but `InstrumentMatcher` uses hardcoded `25`.
- Polyphony thresholds (margins of 8, 4, 0) are hardcoded in `InstrumentMatcher`, not read from config.

### 12. InstrumentMatcher `calculateOctaveWrapping` is effectively dead code

In the range-mode path, wrapping is only called when `calculateOctaveShift` succeeded (all notes fit), so wrapping always finds zero out-of-range notes.

### 13. `estimateInstrumentType` type mapping mismatch

`ChannelAnalyzer` returns types like `'drums'`, `'bass'`, `'melody'`, `'harmony'`. `InstrumentMatcher.typeMapping` has entries for `'piano'`, `'strings'`, `'organ'`, `'lead'`, `'pad'`, `'brass'` — these entries are dead code that never match.

---

## Architectural Concerns

### 14. Greedy assignment in AutoAssigner is suboptimal (AutoAssigner.js lines 134-206)

The greedy algorithm assigns the highest-scoring channel first, which can leave later channels with no compatible instrument even when a better global assignment exists. The Hungarian algorithm would guarantee optimal assignments.

### 15. ChannelAnalyzer O(channels × events) performance (ChannelAnalyzer.js lines 112-133)

`analyzeAllChannels` calls `getChannelEvents` for each channel, iterating all events each time. A single-pass approach collecting events per channel would be O(total_events).

### 16. ScoringConfig is a mutable singleton (ScoringConfig.js)

`load()` mutates the shared object via `Object.assign`. Multiple callers loading different configs interfere with each other. No reset-to-defaults capability.

### 17. AnalysisCache LRU is O(n) per access (AnalysisCache.js lines 137-142)

`_removeFromAccessOrder` uses `Array.indexOf` + `splice`, both O(n). Fine for `maxSize=100`, but scales poorly.

---

## Validation Gaps

### 18. InstrumentCapabilitiesValidator does not parse string `selected_notes`

`selected_notes` may arrive as a JSON string like `"[36,38,42]"`. The validator checks `Array.isArray(value)` which is false for strings, but a non-empty string is truthy, so validation passes incorrectly.

### 19. No range validation for numeric fields in InstrumentCapabilitiesValidator

`note_range_min/max` are not checked for valid MIDI range (0-127). `polyphony` and `gm_program` are not bounds-checked. A value of `-5` or `200` passes validation.

### 20. No input validation at module boundaries

None of the modules validate their inputs rigorously. Corrupt or unexpected data propagates silently through `calculateCompatibility`, `transposeChannels`, etc.

### 21. `note_selection_mode` value mismatch

Validator uses `'continuous'` for keyboard defaults, `InstrumentMatcher` checks for `'discrete'`, but the default fallback is `'range'`. No validation that the mode is one of the accepted strings.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical bugs | 7 |
| Resource/safety | 3 |
| Dead code/config disconnect | 3 |
| Architectural | 4 |
| Validation gaps | 4 |
| **Total** | **21** |

Priority fixes: items 1-7 (critical bugs) should be addressed first, followed by resource issues 8-10, then validation gaps.
