// src/midi/InstrumentMatcher.js

const MidiUtils = require('../utils/MidiUtils');

/**
 * InstrumentMatcher - Calcule la compatibilité entre canaux MIDI et instruments
 *
 * Utilise un système de scoring multi-critères (0-100) basé sur :
 * - Match du programme MIDI (GM)
 * - Compatibilité de plage de notes
 * - Polyphonie suffisante
 * - Contrôleurs MIDI supportés
 * - Type d'instrument
 */
class InstrumentMatcher {
  constructor(logger) {
    this.logger = logger;

    // Catégories General MIDI
    this.GM_CATEGORIES = {
      piano: Array.from({ length: 8 }, (_, i) => i),                    // 0-7
      chromatic: Array.from({ length: 8 }, (_, i) => 8 + i),           // 8-15
      organ: Array.from({ length: 8 }, (_, i) => 16 + i),              // 16-23
      guitar: Array.from({ length: 8 }, (_, i) => 24 + i),             // 24-31
      bass: Array.from({ length: 8 }, (_, i) => 32 + i),               // 32-39
      strings: Array.from({ length: 8 }, (_, i) => 40 + i),            // 40-47
      ensemble: Array.from({ length: 8 }, (_, i) => 48 + i),           // 48-55
      brass: Array.from({ length: 8 }, (_, i) => 56 + i),              // 56-63
      reed: Array.from({ length: 8 }, (_, i) => 64 + i),               // 64-71
      pipe: Array.from({ length: 8 }, (_, i) => 72 + i),               // 72-79
      synth_lead: Array.from({ length: 8 }, (_, i) => 80 + i),         // 80-87
      synth_pad: Array.from({ length: 8 }, (_, i) => 88 + i),          // 88-95
      synth_effects: Array.from({ length: 8 }, (_, i) => 96 + i),      // 96-103
      ethnic: Array.from({ length: 8 }, (_, i) => 104 + i),            // 104-111
      percussive: Array.from({ length: 8 }, (_, i) => 112 + i),        // 112-119
      sound_effects: Array.from({ length: 8 }, (_, i) => 120 + i)      // 120-127
    };
  }

  /**
   * Calcule la compatibilité entre un canal et un instrument
   * @param {ChannelAnalysis} channelAnalysis
   * @param {Object} instrument - Instrument avec capabilities
   * @returns {CompatibilityScore}
   */
  calculateCompatibility(channelAnalysis, instrument) {
    let score = 0;
    const issues = [];
    const info = [];

    // 1. Match du programme MIDI (+30 points max)
    const programScore = this.scoreProgramMatch(
      channelAnalysis.primaryProgram,
      instrument.gm_program
    );
    score += programScore.score;
    if (programScore.info) info.push(programScore.info);

    // 2. Compatibilité de notes (+25 points max)
    const noteScore = this.scoreNoteCompatibility(
      channelAnalysis.noteRange,
      {
        min: instrument.note_range_min,
        max: instrument.note_range_max,
        mode: instrument.note_selection_mode || 'range',
        selected: instrument.selected_notes ? JSON.parse(instrument.selected_notes) : null
      }
    );
    score += noteScore.score;
    if (noteScore.issue) issues.push(noteScore.issue);
    if (noteScore.info) info.push(noteScore.info);

    // 3. Polyphonie (+15 points max)
    const polyScore = this.scorePolyphony(
      channelAnalysis.polyphony.max,
      instrument.polyphony || 16 // Défaut si non spécifié
    );
    score += polyScore.score;
    if (polyScore.issue) issues.push(polyScore.issue);
    if (polyScore.info) info.push(polyScore.info);

    // 4. Contrôleurs MIDI (+15 points max)
    const ccScore = this.scoreCCSupport(
      channelAnalysis.usedCCs,
      instrument.supported_ccs ? JSON.parse(instrument.supported_ccs) : null
    );
    score += ccScore.score;
    if (ccScore.issue) issues.push(ccScore.issue);
    if (ccScore.info) info.push(ccScore.info);

    // 5. Type d'instrument (+10 points max)
    const typeScore = this.scoreInstrumentType(
      channelAnalysis.estimatedType,
      this.getInstrumentType(instrument)
    );
    score += typeScore.score;
    if (typeScore.info) info.push(typeScore.info);

    // 6. Canal spécial drums (+5 points)
    if (channelAnalysis.channel === 9 && this.isDrumsInstrument(instrument)) {
      score += 5;
      info.push('MIDI channel 10 (drums) match');
    }

    return {
      score: Math.min(100, Math.max(0, Math.round(score))),
      compatible: noteScore.compatible,
      transposition: noteScore.transposition || null,
      noteRemapping: noteScore.noteRemapping || null,
      issues,
      info
    };
  }

  /**
   * Score du match de programme MIDI
   * @param {number|null} channelProgram
   * @param {number|null} instrumentProgram
   * @returns {Object} - { score, info }
   */
  scoreProgramMatch(channelProgram, instrumentProgram) {
    // Si pas de programme dans le canal
    if (channelProgram === null || channelProgram === undefined) {
      return { score: 0 };
    }

    // Si l'instrument n'a pas de programme défini
    if (instrumentProgram === null || instrumentProgram === undefined) {
      return { score: 0 };
    }

    // Match exact
    if (channelProgram === instrumentProgram) {
      const programName = MidiUtils.getGMInstrumentName(channelProgram);
      return {
        score: 30,
        info: `Perfect program match: ${programName} (${channelProgram})`
      };
    }

    // Même catégorie
    const channelCategory = this.getProgramCategory(channelProgram);
    const instrumentCategory = this.getProgramCategory(instrumentProgram);

    if (channelCategory === instrumentCategory) {
      return {
        score: 20,
        info: `Same GM category: ${channelCategory}`
      };
    }

    return { score: 0 };
  }

  /**
   * Détermine la catégorie GM d'un programme
   * @param {number} program
   * @returns {string|null}
   */
  getProgramCategory(program) {
    for (const [category, programs] of Object.entries(this.GM_CATEGORIES)) {
      if (programs.includes(program)) {
        return category;
      }
    }
    return null;
  }

  /**
   * Score de compatibilité de notes avec transposition par octaves
   * @param {Object} channelRange - { min, max }
   * @param {Object} instrumentCaps - { min, max, mode, selected }
   * @returns {Object}
   */
  scoreNoteCompatibility(channelRange, instrumentCaps) {
    const span = channelRange.max - channelRange.min;

    // Mode discrete (drums/pads)
    if (instrumentCaps.mode === 'discrete') {
      return this.scoreDiscreteNotes(channelRange, instrumentCaps.selected);
    }

    // Si l'instrument n'a pas de plage définie (accepte tout)
    if (instrumentCaps.min === null || instrumentCaps.max === null) {
      return {
        compatible: true,
        score: 25,
        info: 'Instrument accepts all note ranges'
      };
    }

    const instSpan = instrumentCaps.max - instrumentCaps.min;

    // Le span du canal est trop large pour l'instrument
    if (span > instSpan) {
      return {
        compatible: false,
        score: 0,
        issue: {
          type: 'error',
          message: `Note span too wide (${span} vs ${instSpan} semitones)`
        }
      };
    }

    // Calculer transposition optimale par octaves
    const transposition = this.calculateOctaveShift(channelRange, instrumentCaps);

    if (!transposition.compatible) {
      return {
        compatible: false,
        score: 0,
        issue: {
          type: 'error',
          message: transposition.reason
        }
      };
    }

    // Score basé sur la transposition
    let score = 25;
    let info = null;

    if (transposition.octaves === 0) {
      score = 25;
      info = 'Perfect note range fit (no transposition)';
    } else {
      score = Math.max(0, 20 - Math.abs(transposition.octaves) * 3);
      const direction = transposition.octaves > 0 ? 'up' : 'down';
      info = `Transposition: ${Math.abs(transposition.octaves)} octave(s) ${direction}`;
    }

    return {
      compatible: true,
      score,
      transposition: {
        semitones: transposition.semitones,
        octaves: transposition.octaves
      },
      info
    };
  }

  /**
   * Calcule le décalage d'octave optimal
   * @param {Object} channelRange - { min, max }
   * @param {Object} instrumentCaps - { min, max }
   * @returns {Object}
   */
  calculateOctaveShift(channelRange, instrumentCaps) {
    // Calculer les centres
    const channelCenter = (channelRange.min + channelRange.max) / 2;
    const instCenter = (instrumentCaps.min + instrumentCaps.max) / 2;

    // Différence en semitones
    const rawShift = instCenter - channelCenter;

    // Arrondir au multiple de 12 le plus proche
    const octaves = Math.round(rawShift / 12);
    const semitones = octaves * 12;

    // Vérifier si toutes les notes rentrent après transposition
    const newMin = channelRange.min + semitones;
    const newMax = channelRange.max + semitones;

    if (newMin >= instrumentCaps.min && newMax <= instrumentCaps.max) {
      return {
        compatible: true,
        semitones,
        octaves
      };
    }

    // Essayer ±1 octave
    for (const offset of [-1, 1]) {
      const altOctaves = octaves + offset;
      const altSemitones = altOctaves * 12;
      const altMin = channelRange.min + altSemitones;
      const altMax = channelRange.max + altSemitones;

      if (altMin >= instrumentCaps.min && altMax <= instrumentCaps.max) {
        return {
          compatible: true,
          semitones: altSemitones,
          octaves: altOctaves
        };
      }
    }

    return {
      compatible: false,
      reason: 'No octave shift fits all notes in instrument range'
    };
  }

  /**
   * Score pour instruments à notes discrètes (drums)
   * @param {Object} channelRange
   * @param {Array<number>|null} selectedNotes
   * @returns {Object}
   */
  scoreDiscreteNotes(channelRange, selectedNotes) {
    if (!selectedNotes || selectedNotes.length === 0) {
      return {
        compatible: false,
        score: 0,
        issue: {
          type: 'error',
          message: 'Discrete mode but no selected notes defined'
        }
      };
    }

    // Vérifier combien de notes du canal sont supportées
    const channelNotes = [];
    for (let note = channelRange.min; note <= channelRange.max; note++) {
      channelNotes.push(note);
    }

    const supportedCount = channelNotes.filter(n => selectedNotes.includes(n)).length;
    const supportRatio = supportedCount / channelNotes.length;

    if (supportRatio === 0) {
      return {
        compatible: false,
        score: 0,
        issue: {
          type: 'error',
          message: 'No channel notes are supported by instrument'
        }
      };
    }

    // Créer mapping pour notes non supportées (vers note la plus proche)
    const noteRemapping = {};
    for (const note of channelNotes) {
      if (!selectedNotes.includes(note)) {
        const closest = this.findClosestNote(note, selectedNotes);
        if (closest !== null) {
          noteRemapping[note] = closest;
        }
      }
    }

    const score = Math.round(25 * supportRatio);
    const info = `${Math.round(supportRatio * 100)}% of notes supported`;

    return {
      compatible: true,
      score,
      noteRemapping: Object.keys(noteRemapping).length > 0 ? noteRemapping : null,
      info
    };
  }

  /**
   * Trouve la note la plus proche dans une liste
   * @param {number} targetNote
   * @param {Array<number>} availableNotes
   * @returns {number|null}
   */
  findClosestNote(targetNote, availableNotes) {
    if (availableNotes.length === 0) return null;

    let closest = availableNotes[0];
    let minDistance = Math.abs(targetNote - closest);

    for (const note of availableNotes) {
      const distance = Math.abs(targetNote - note);
      if (distance < minDistance) {
        minDistance = distance;
        closest = note;
      }
    }

    return closest;
  }

  /**
   * Score de polyphonie
   * @param {number} channelMaxPoly
   * @param {number} instrumentPoly
   * @returns {Object}
   */
  scorePolyphony(channelMaxPoly, instrumentPoly) {
    const margin = instrumentPoly - channelMaxPoly;

    if (margin >= 8) {
      return {
        score: 15,
        info: `Excellent polyphony (${instrumentPoly} available, ${channelMaxPoly} needed)`
      };
    } else if (margin >= 4) {
      return {
        score: 10,
        info: `Good polyphony (${instrumentPoly} available, ${channelMaxPoly} needed)`
      };
    } else if (margin >= 0) {
      return {
        score: 5,
        info: `Sufficient polyphony (${instrumentPoly} available, ${channelMaxPoly} needed)`
      };
    } else {
      return {
        score: 0,
        issue: {
          type: 'warning',
          message: `Insufficient polyphony (${instrumentPoly} available, ${channelMaxPoly} needed)`
        }
      };
    }
  }

  /**
   * Score du support des contrôleurs MIDI
   * @param {Array<number>} channelCCs
   * @param {Array<number>|null} instrumentCCs
   * @returns {Object}
   */
  scoreCCSupport(channelCCs, instrumentCCs) {
    if (channelCCs.length === 0) {
      return { score: 15, info: 'No CCs used by channel' };
    }

    // Si l'instrument n'a pas de liste (accepte tout)
    if (!instrumentCCs || instrumentCCs.length === 0) {
      return { score: 15, info: 'Instrument supports all CCs' };
    }

    // Compter combien de CCs sont supportés
    const supportedCount = channelCCs.filter(cc => instrumentCCs.includes(cc)).length;
    const supportRatio = supportedCount / channelCCs.length;

    const score = Math.round(15 * supportRatio);

    if (supportRatio === 1) {
      return {
        score,
        info: `All ${channelCCs.length} CCs supported`
      };
    } else if (supportRatio >= 0.5) {
      const unsupported = channelCCs.filter(cc => !instrumentCCs.includes(cc));
      return {
        score,
        issue: {
          type: 'info',
          message: `Some CCs not supported: ${unsupported.join(', ')}`
        }
      };
    } else {
      const unsupported = channelCCs.filter(cc => !instrumentCCs.includes(cc));
      return {
        score,
        issue: {
          type: 'warning',
          message: `Many CCs not supported: ${unsupported.join(', ')}`
        }
      };
    }
  }

  /**
   * Score du type d'instrument
   * @param {string} channelType
   * @param {string} instrumentType
   * @returns {Object}
   */
  scoreInstrumentType(channelType, instrumentType) {
    if (channelType === instrumentType) {
      return {
        score: 10,
        info: `Instrument type match: ${channelType}`
      };
    }

    // Certaines combinaisons sont acceptables
    const acceptableCombos = {
      'melody': ['harmony', 'bass'],
      'harmony': ['melody'],
      'bass': ['melody']
    };

    if (acceptableCombos[channelType]?.includes(instrumentType)) {
      return { score: 5 };
    }

    return { score: 0 };
  }

  /**
   * Détermine le type d'un instrument
   * @param {Object} instrument
   * @returns {string}
   */
  getInstrumentType(instrument) {
    const program = instrument.gm_program;

    if (program === null || program === undefined) {
      return 'unknown';
    }

    if (program >= 112 && program <= 119) return 'percussive';
    if (program >= 32 && program <= 39) return 'bass';
    if ((program >= 0 && program <= 7) || (program >= 40 && program <= 55)) return 'harmony';

    // Analyser note_range si disponible
    if (instrument.note_range_min !== null && instrument.note_range_max !== null) {
      const avgNote = (instrument.note_range_min + instrument.note_range_max) / 2;
      if (avgNote < 48) return 'bass';
    }

    return 'melody';
  }

  /**
   * Vérifie si un instrument est de type drums
   * @param {Object} instrument
   * @returns {boolean}
   */
  isDrumsInstrument(instrument) {
    const program = instrument.gm_program;
    return (program >= 112 && program <= 119) ||
           instrument.note_selection_mode === 'discrete';
  }
}

module.exports = InstrumentMatcher;
