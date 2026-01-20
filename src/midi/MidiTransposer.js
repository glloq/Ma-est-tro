// src/midi/MidiTransposer.js

/**
 * MidiTransposer - Applique des transpositions à des fichiers MIDI
 *
 * Permet de :
 * - Transposer des canaux par octaves (multiples de 12 semitones)
 * - Remapper des notes (pour drums/pads discrets)
 * - Créer des fichiers dérivés avec métadonnées de transformation
 */
class MidiTransposer {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Applique des transpositions à plusieurs canaux
   * @param {Object} midiData - Fichier MIDI parsé
   * @param {Object} transpositions - { channel: { semitones, noteRemapping } }
   * @returns {Object} - { midiData, stats }
   */
  transposeChannels(midiData, transpositions) {
    // Shallow clone + deep clone des tracks seulement (plus performant)
    const modified = {
      ...midiData,
      tracks: midiData.tracks.map(track => ({
        ...track,
        events: track.events ? [...track.events] : []
      }))
    };

    let notesChanged = 0;
    let notesRemapped = 0;
    const totalNotes = this.countAllNotes(midiData);

    for (const track of modified.tracks) {
      if (!track.events) continue;

      for (let i = 0; i < track.events.length; i++) {
        const event = track.events[i];
        const channel = event.channel;
        const transposition = transpositions[channel];

        if (!transposition) continue;

        let modified = false;
        let newEvent = event; // Par défaut, garder la référence

        // Appliquer transposition par semitones
        if (transposition.semitones && transposition.semitones !== 0) {
          if (event.type === 'noteOn' || event.type === 'noteOff') {
            const originalNote = event.note || event.noteNumber;
            const newNote = this.clampNote(originalNote + transposition.semitones);

            if (newNote !== originalNote) {
              if (!modified) {
                newEvent = { ...event }; // Clone seulement si modification
                modified = true;
              }
              newEvent.note = newNote;
              if (newEvent.noteNumber !== undefined) {
                newEvent.noteNumber = newNote;
              }
              notesChanged++;
            }
          } else if (event.type === 'keyPressure' || event.type === 'polyAftertouch') {
            // Aftertouch polyphonique
            const originalNote = event.note || event.noteNumber;
            const newNote = this.clampNote(originalNote + transposition.semitones);
            if (!modified) {
              newEvent = { ...event };
              modified = true;
            }
            newEvent.note = newNote;
            if (newEvent.noteNumber !== undefined) {
              newEvent.noteNumber = newNote;
            }
          }
        }

        // Appliquer remapping de notes (drums)
        if (transposition.noteRemapping && Object.keys(transposition.noteRemapping).length > 0) {
          if (event.type === 'noteOn' || event.type === 'noteOff') {
            const originalNote = event.note || event.noteNumber;
            const remappedNote = transposition.noteRemapping[originalNote];

            if (remappedNote !== undefined) {
              if (!modified) {
                newEvent = { ...event };
                modified = true;
              }
              newEvent.note = remappedNote;
              if (newEvent.noteNumber !== undefined) {
                newEvent.noteNumber = remappedNote;
              }
              notesRemapped++;
            }
          }
        }

        // Remplacer l'événement si modifié
        if (modified) {
          track.events[i] = newEvent;
        }
      }
    }

    return {
      midiData: modified,
      stats: {
        notesChanged,
        notesRemapped,
        totalNotes,
        transpositions
      }
    };
  }

  /**
   * Applique une transposition à un seul canal
   * @param {Object} midiData
   * @param {number} channel
   * @param {number} semitones
   * @returns {Object}
   */
  transposeChannel(midiData, channel, semitones) {
    return this.transposeChannels(midiData, {
      [channel]: { semitones }
    });
  }

  /**
   * Applique un remapping de notes (pour drums)
   * @param {Object} midiData
   * @param {number} channel
   * @param {Object} mapping - { oldNote: newNote }
   * @returns {Object}
   */
  remapNotes(midiData, channel, mapping) {
    return this.transposeChannels(midiData, {
      [channel]: { noteRemapping: mapping }
    });
  }

  /**
   * Clamp une note à la plage MIDI valide (0-127)
   * @param {number} note
   * @returns {number}
   */
  clampNote(note) {
    return Math.max(0, Math.min(127, Math.round(note)));
  }

  /**
   * Compte le nombre total de notes dans un fichier MIDI
   * @param {Object} midiData
   * @returns {number}
   */
  countAllNotes(midiData) {
    let count = 0;

    if (!midiData || !midiData.tracks) {
      return count;
    }

    for (const track of midiData.tracks) {
      if (!track.events) continue;

      for (const event of track.events) {
        if (event.type === 'noteOn' && event.velocity > 0) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Génère les métadonnées d'adaptation pour un fichier dérivé
   * @param {Object} assignments - Assignations appliquées
   * @param {Object} stats - Statistiques de transposition
   * @returns {Object}
   */
  generateAdaptationMetadata(assignments, stats) {
    const transpositions = {};

    for (const [channel, assignment] of Object.entries(assignments)) {
      const channelNum = parseInt(channel);
      const transposition = assignment.transposition || { semitones: 0, octaves: 0 };
      const noteRemapping = assignment.noteRemapping || null;

      transpositions[channelNum] = {
        semitones: transposition.semitones || 0,
        octaves: transposition.octaves || 0,
        noteRemapping,
        reason: assignment.info ? assignment.info.join('; ') : 'Auto-assigned'
      };
    }

    return {
      created_at: new Date().toISOString(),
      strategy: 'octave_preserving',
      transpositions,
      notes_changed: stats.notesChanged || 0,
      notes_remapped: stats.notesRemapped || 0,
      total_notes: stats.totalNotes || 0
    };
  }

  /**
   * Valide qu'une transposition est possible
   * @param {Object} midiData
   * @param {number} channel
   * @param {number} semitones
   * @returns {Object} - { valid, reason }
   */
  validateTransposition(midiData, channel, semitones) {
    if (Math.abs(semitones) > 48) {
      return {
        valid: false,
        reason: 'Transposition too large (max ±48 semitones / 4 octaves)'
      };
    }

    // Vérifier que le canal existe
    const channelExists = midiData.tracks.some(track =>
      track.events.some(e => e.channel === channel)
    );

    if (!channelExists) {
      return {
        valid: false,
        reason: `Channel ${channel} not found in MIDI file`
      };
    }

    return { valid: true };
  }
}

module.exports = MidiTransposer;
