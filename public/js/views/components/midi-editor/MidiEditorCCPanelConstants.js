// public/js/views/components/midi-editor/MidiEditorCCPanelConstants.js
// CC panel constants extracted from MidiEditorCCPanel.js (P2-F.6, plan §11 step 1).
// Exposed on `window.MidiEditorCCPanelConstants`.

(function() {
  'use strict';

  // CC types that are always displayed in the CC type bar regardless of
  // whether the current file uses them (velocity + tempo are UI primitives,
  // not MIDI CCs per se).
  const ALWAYS_VISIBLE_CC_TYPES = Object.freeze(['velocity', 'tempo']);

  // CCs rendered in the fixed/static panel section. Anything else is
  // considered "dynamic" and appears only when detected in the file.
  const STATIC_CC_TYPES = Object.freeze([
    'cc1', 'cc2', 'cc5', 'cc7', 'cc10', 'cc11',
    'cc74', 'cc76', 'cc77', 'cc78', 'cc91',
    'pitchbend', 'aftertouch', 'polyAftertouch'
  ]);

  // Canonical note names (duplicated from MidiConstants so the CC panel
  // has a stable reference even if MidiConstants is missing).
  const NOTE_NAMES = Object.freeze(
    (typeof MidiConstants !== 'undefined' && MidiConstants.NOTE_NAMES)
      || ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  );

  window.MidiEditorCCPanelConstants = Object.freeze({
    ALWAYS_VISIBLE_CC_TYPES,
    ALWAYS_VISIBLE_CC_TYPES_SET: new Set(ALWAYS_VISIBLE_CC_TYPES),
    STATIC_CC_TYPES,
    STATIC_CC_TYPES_SET: new Set(STATIC_CC_TYPES),
    NOTE_NAMES
  });
})();
