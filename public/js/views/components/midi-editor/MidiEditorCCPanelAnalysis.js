// public/js/views/components/midi-editor/MidiEditorCCPanelAnalysis.js
// Pure CC-data analysis helpers extracted from MidiEditorCCPanel.js (P2-F.6b).
// Operate on the raw `ccEvents` array and `fullSequence` from the modal —
// no DOM access, no side effects.
// Exposed on `window.MidiEditorCCPanelAnalysis` (IIFE+globals convention).

(function() {
  'use strict';

  /**
   * Set of CC types used on a specific channel. Includes 'velocity' when any
   * note of the `fullSequence` belongs to that channel.
   */
  function getUsedCCTypesForChannel({ channel, ccEvents, fullSequence }) {
    const usedTypes = new Set();
    (ccEvents || []).forEach(event => {
      if (event.channel === channel) usedTypes.add(event.type);
    });
    if (fullSequence && fullSequence.some(note => note.c === channel)) {
      usedTypes.add('velocity');
    }
    return usedTypes;
  }

  /**
   * Set of CC types used anywhere in the file. Includes 'velocity' when any
   * note exists in `fullSequence`.
   */
  function getAllUsedCCTypes({ ccEvents, fullSequence }) {
    const allTypes = new Set();
    (ccEvents || []).forEach(event => allTypes.add(event.type));
    if (fullSequence && fullSequence.length > 0) allTypes.add('velocity');
    return allTypes;
  }

  /**
   * Sorted array of channels having any CC/pitchbend event.
   */
  function getAllCCChannels(ccEvents) {
    const channels = new Set();
    (ccEvents || []).forEach(event => {
      if (event.channel !== undefined) channels.add(event.channel);
    });
    return Array.from(channels).sort((a, b) => a - b);
  }

  /**
   * Sorted array of channels having at least one event of `ccType`.
   */
  function getCCChannelsUsed({ ccEvents, ccType }) {
    const channels = new Set();
    (ccEvents || []).forEach(event => {
      if (event.type === ccType && event.channel !== undefined) {
        channels.add(event.channel);
      }
    });
    return Array.from(channels).sort((a, b) => a - b);
  }

  /**
   * Extract CC, pitchbend, aftertouch and polyAftertouch events from the
   * raw parsed MIDI structure. Returns a flat array sorted by tick. Pure
   * function — no side effects, no `this`.
   */
  function extractCCEvents(midiData) {
    const out = [];
    if (!midiData || !midiData.tracks) return out;

    midiData.tracks.forEach((track) => {
      if (!track.events) return;
      let currentTick = 0;
      track.events.forEach((event) => {
        currentTick += event.deltaTime || 0;
        const channel = event.channel !== undefined ? event.channel : 0;

        if (event.type === 'controller') {
          const controller = event.controllerType;
          if (controller !== undefined && controller >= 0 && controller <= 127) {
            out.push({
              type: `cc${controller}`,
              ticks: currentTick,
              channel,
              value: event.value,
              id: Date.now() + Math.random() + out.length
            });
          }
        } else if (event.type === 'pitchBend') {
          out.push({
            type: 'pitchbend',
            ticks: currentTick,
            channel,
            value: event.value,
            id: Date.now() + Math.random() + out.length
          });
        } else if (event.type === 'channelAftertouch') {
          out.push({
            type: 'aftertouch',
            ticks: currentTick,
            channel,
            value: event.amount !== undefined ? event.amount : (event.value || 0),
            id: Date.now() + Math.random() + out.length
          });
        } else if (event.type === 'polyAftertouch' || event.type === 'noteAftertouch') {
          out.push({
            type: 'polyAftertouch',
            ticks: currentTick,
            channel,
            note: event.noteNumber,
            value: event.pressure !== undefined
              ? event.pressure
              : (event.amount !== undefined ? event.amount : (event.value || 0)),
            id: Date.now() + Math.random() + out.length
          });
        }
      });
    });

    out.sort((a, b) => a.ticks - b.ticks);
    return out;
  }

  /**
   * Sorted array of notes having polyAftertouch events on the given channel.
   */
  function getPolyAftertouchNotes({ channel, ccEvents }) {
    const notes = new Set();
    (ccEvents || []).forEach(event => {
      if (event.type === 'polyAftertouch' && event.channel === channel && event.note !== undefined) {
        notes.add(event.note);
      }
    });
    return Array.from(notes).sort((a, b) => a - b);
  }

  /**
   * Summarize CC events by type (e.g. "cc1: 42, cc7: 18, pitchbend: 5").
   * Pure — used by the logger side-effect in the caller.
   */
  function summarizeCCTypes(ccEvents) {
    const typeCounts = {};
    (ccEvents || []).forEach(e => { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1; });
    return Object.entries(typeCounts)
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ');
  }

  window.MidiEditorCCPanelAnalysis = Object.freeze({
    getUsedCCTypesForChannel,
    getAllUsedCCTypes,
    getAllCCChannels,
    getCCChannelsUsed,
    extractCCEvents,
    getPolyAftertouchNotes,
    summarizeCCTypes
  });
})();
