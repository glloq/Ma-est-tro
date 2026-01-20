// src/midi/ChannelAnalyzer.js

/**
 * ChannelAnalyzer - Analyse les caractéristiques d'un canal MIDI
 *
 * Extrait les informations importantes d'un canal :
 * - Plage de notes (min/max)
 * - Distribution des notes
 * - Polyphonie (max/moyenne)
 * - Contrôleurs MIDI utilisés
 * - Programme MIDI principal
 * - Type d'instrument estimé
 */
class ChannelAnalyzer {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Analyse tous les canaux actifs dans un fichier MIDI
   * @param {Object} midiData - Fichier MIDI parsé
   * @returns {Array<ChannelAnalysis>}
   */
  analyzeAllChannels(midiData) {
    const activeChannels = this.extractActiveChannels(midiData);
    return activeChannels.map(channel => this.analyzeChannel(midiData, channel));
  }

  /**
   * Extrait les numéros de canaux actifs (qui contiennent des notes)
   * @param {Object} midiData - Fichier MIDI parsé
   * @returns {Array<number>} - Canaux actifs (0-15)
   */
  extractActiveChannels(midiData) {
    const channels = new Set();

    if (!midiData || !midiData.tracks) {
      return [];
    }

    for (const track of midiData.tracks) {
      if (!track.events) continue;

      for (const event of track.events) {
        if (event.channel !== undefined &&
            (event.type === 'noteOn' || event.type === 'noteOff')) {
          channels.add(event.channel);
        }
      }
    }

    return Array.from(channels).sort((a, b) => a - b);
  }

  /**
   * Analyse un canal MIDI spécifique
   * @param {Object} midiData - Fichier MIDI parsé
   * @param {number} channel - Canal à analyser (0-15)
   * @returns {ChannelAnalysis}
   */
  analyzeChannel(midiData, channel) {
    const events = this.getChannelEvents(midiData, channel);
    const noteEvents = events.filter(e => e.type === 'noteOn' || e.type === 'noteOff');

    const noteRange = this.extractNoteRange(noteEvents);
    const noteDistribution = this.buildNoteHistogram(noteEvents);
    const totalNotes = this.countNotes(noteEvents);
    const polyphony = this.calculatePolyphony(noteEvents);
    const usedCCs = this.extractUsedCCs(events);
    const usesPitchBend = this.hasPitchBend(events);
    const programs = this.extractPrograms(events);
    const primaryProgram = this.getPrimaryProgram(programs);
    const trackNames = this.getTrackNames(midiData, channel);
    const density = this.calculateNoteDensity(noteEvents, midiData.duration || 0);

    const estimatedType = this.estimateInstrumentType({
      channel,
      noteRange,
      noteDistribution,
      totalNotes,
      polyphony,
      primaryProgram,
      density
    });

    return {
      channel,
      noteRange,
      noteDistribution,
      totalNotes,
      polyphony,
      usedCCs,
      usesPitchBend,
      programs,
      primaryProgram,
      trackNames,
      density,
      estimatedType
    };
  }

  /**
   * Récupère tous les événements d'un canal spécifique
   * @param {Object} midiData
   * @param {number} channel
   * @returns {Array<Object>}
   */
  getChannelEvents(midiData, channel) {
    const events = [];

    if (!midiData || !midiData.tracks) {
      return events;
    }

    for (const track of midiData.tracks) {
      if (!track.events) continue;

      for (const event of track.events) {
        if (event.channel === channel) {
          events.push(event);
        }
      }
    }

    // Trier par temps
    events.sort((a, b) => (a.time || 0) - (b.time || 0));

    return events;
  }

  /**
   * Extrait la plage de notes utilisées
   * @param {Array<Object>} noteEvents
   * @returns {Object} - { min, max }
   */
  extractNoteRange(noteEvents) {
    let min = 127;
    let max = 0;

    for (const event of noteEvents) {
      if (event.type === 'noteOn' && event.velocity > 0) {
        const note = event.note || event.noteNumber || 0;
        min = Math.min(min, note);
        max = Math.max(max, note);
      }
    }

    // Si aucune note trouvée
    if (min > max) {
      return { min: 60, max: 60 };
    }

    return { min, max };
  }

  /**
   * Construit un histogram des notes utilisées
   * @param {Array<Object>} noteEvents
   * @returns {Object} - { note: count }
   */
  buildNoteHistogram(noteEvents) {
    const histogram = {};

    for (const event of noteEvents) {
      if (event.type === 'noteOn' && event.velocity > 0) {
        const note = event.note || event.noteNumber || 0;
        histogram[note] = (histogram[note] || 0) + 1;
      }
    }

    return histogram;
  }

  /**
   * Compte le nombre total de notes
   * @param {Array<Object>} noteEvents
   * @returns {number}
   */
  countNotes(noteEvents) {
    return noteEvents.filter(e => e.type === 'noteOn' && e.velocity > 0).length;
  }

  /**
   * Calcule la polyphonie maximale et moyenne
   * @param {Array<Object>} noteEvents
   * @returns {Object} - { max, avg }
   */
  calculatePolyphony(noteEvents) {
    const activeNotes = new Map(); // note -> time
    let maxPoly = 0;
    let totalPoly = 0;
    let measurements = 0;

    for (const event of noteEvents) {
      const note = event.note || event.noteNumber || 0;
      const time = event.time || 0;

      if (event.type === 'noteOn' && event.velocity > 0) {
        activeNotes.set(note, time);
      } else if (event.type === 'noteOff' || (event.type === 'noteOn' && event.velocity === 0)) {
        activeNotes.delete(note);
      }

      const currentPoly = activeNotes.size;
      if (currentPoly > 0) {
        maxPoly = Math.max(maxPoly, currentPoly);
        totalPoly += currentPoly;
        measurements++;
      }
    }

    return {
      max: maxPoly,
      avg: measurements > 0 ? totalPoly / measurements : 0
    };
  }

  /**
   * Extrait la liste des contrôleurs MIDI utilisés
   * @param {Array<Object>} events
   * @returns {Array<number>} - Numéros de CC utilisés
   */
  extractUsedCCs(events) {
    const ccs = new Set();

    for (const event of events) {
      if (event.type === 'controller' || event.type === 'cc') {
        const ccNum = event.controller || event.controllerType || 0;
        ccs.add(ccNum);
      }
    }

    return Array.from(ccs).sort((a, b) => a - b);
  }

  /**
   * Vérifie si le pitch bend est utilisé
   * @param {Array<Object>} events
   * @returns {boolean}
   */
  hasPitchBend(events) {
    return events.some(e => e.type === 'pitchBend' || e.type === 'pitchbend');
  }

  /**
   * Extrait tous les changements de programme
   * @param {Array<Object>} events
   * @returns {Array<number>}
   */
  extractPrograms(events) {
    const programs = [];

    for (const event of events) {
      if (event.type === 'programChange' || event.type === 'program') {
        const program = event.program || event.programNumber || 0;
        programs.push(program);
      }
    }

    return programs;
  }

  /**
   * Détermine le programme MIDI principal (le plus utilisé ou le premier)
   * @param {Array<number>} programs
   * @returns {number|null}
   */
  getPrimaryProgram(programs) {
    if (programs.length === 0) {
      return null;
    }

    // Compter les occurrences
    const counts = {};
    for (const prog of programs) {
      counts[prog] = (counts[prog] || 0) + 1;
    }

    // Trouver le plus fréquent
    let maxCount = 0;
    let primaryProgram = programs[0];

    for (const [prog, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        primaryProgram = parseInt(prog);
      }
    }

    return primaryProgram;
  }

  /**
   * Récupère les noms des tracks associés à ce canal
   * @param {Object} midiData
   * @param {number} channel
   * @returns {Array<string>}
   */
  getTrackNames(midiData, channel) {
    const names = [];

    if (!midiData || !midiData.tracks) {
      return names;
    }

    for (const track of midiData.tracks) {
      if (!track.events) continue;

      // Vérifier si ce track contient des événements de ce canal
      const hasChannel = track.events.some(e => e.channel === channel);

      if (hasChannel && track.name) {
        names.push(track.name);
      }
    }

    return names;
  }

  /**
   * Calcule la densité de notes (notes/seconde)
   * @param {Array<Object>} noteEvents
   * @param {number} duration - Durée en secondes
   * @returns {number}
   */
  calculateNoteDensity(noteEvents, duration) {
    if (duration <= 0) {
      return 0;
    }

    const noteCount = this.countNotes(noteEvents);
    return noteCount / duration;
  }

  /**
   * Estime le type d'instrument basé sur les caractéristiques
   * @param {Object} analysis
   * @returns {string} - 'drums', 'bass', 'melody', 'harmony', 'percussive', 'unknown'
   */
  estimateInstrumentType(analysis) {
    const { channel, noteRange, noteDistribution, polyphony, primaryProgram, density } = analysis;

    // Canal 9 (MIDI 10) = toujours drums
    if (channel === 9) {
      return 'drums';
    }

    // Programme MIDI indique le type
    if (primaryProgram !== null) {
      if (primaryProgram >= 112 && primaryProgram <= 119) {
        return 'percussive';
      }
      if (primaryProgram >= 32 && primaryProgram <= 39) {
        return 'bass';
      }
      if (primaryProgram >= 0 && primaryProgram <= 7) {
        return 'harmony'; // Piano
      }
      if (primaryProgram >= 40 && primaryProgram <= 55) {
        return 'harmony'; // Strings, ensemble
      }
    }

    // Analyse des notes
    const avgNote = this.getAverageNote(noteDistribution);
    const span = noteRange.max - noteRange.min;

    // Heuristiques basées sur plage et polyphonie
    if (avgNote < 48 && polyphony.max <= 2) {
      return 'bass'; // Notes basses, peu de polyphonie
    }

    if (span >= 36 && polyphony.avg > 4) {
      return 'harmony'; // Large plage, haute polyphonie (piano, strings)
    }

    if (density > 5 && span < 24) {
      return 'drums'; // Haute densité, plage restreinte
    }

    if (polyphony.max <= 1) {
      return 'melody'; // Monophonique
    }

    return 'melody'; // Défaut
  }

  /**
   * Calcule la note moyenne pondérée
   * @param {Object} noteDistribution - { note: count }
   * @returns {number}
   */
  getAverageNote(noteDistribution) {
    let totalWeighted = 0;
    let totalCount = 0;

    for (const [note, count] of Object.entries(noteDistribution)) {
      totalWeighted += parseInt(note) * count;
      totalCount += count;
    }

    return totalCount > 0 ? totalWeighted / totalCount : 60;
  }
}

module.exports = ChannelAnalyzer;
