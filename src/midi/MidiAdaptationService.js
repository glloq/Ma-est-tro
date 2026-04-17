// src/midi/MidiAdaptationService.js
// Facade grouping MIDI adaptation capabilities (P0-1.6).
// Delegates to existing modules: MidiTransposer, AutoAssigner.
// See ADR-001 §Phase 1.
import MidiTransposer from './MidiTransposer.js';

export default class MidiAdaptationService {
  constructor(logger, autoAssigner) {
    this.logger = logger;
    this.transposer = new MidiTransposer(logger);
    this.autoAssigner = autoAssigner;
  }

  transposeChannels(midiData, transpositions) {
    return this.transposer.transposeChannels(midiData, transpositions);
  }

  compressChannel(midiData, channel, min, max) {
    return this.transposer.compressChannel(midiData, channel, min, max);
  }

  splitChannelInFile(midiData, channel, segments) {
    return this.transposer.splitChannelInFile(midiData, channel, segments);
  }

  findFreeChannels(midiData) {
    return this.transposer.findFreeChannels(midiData);
  }

  analyzeChannel(midiData, channel, fileId) {
    return this.autoAssigner.analyzeChannel(midiData, channel, fileId);
  }

  async generateSuggestions(midiData, options) {
    return this.autoAssigner.generateSuggestions(midiData, options);
  }
}
