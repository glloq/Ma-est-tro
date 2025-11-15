// ============================================================================
// Fichier: frontend/js/utils/MidiConstants.js
// Projet: MidiMind v3.0 - Système d'Orchestration MIDI pour Raspberry Pi
// Version: 3.0.0
// Date: 2025-10-14
// ============================================================================
// Description:
//   Constantes MIDI : notes, messages types, CC types, status bytes.
//   Documentation complète du protocole MIDI.
//
// Constantes:
//   - NOTE_NAMES : ['C', 'C#', 'D', ...] × octaves
//   - MESSAGE_TYPES : Note On/Off, CC, Program Change, etc.
//   - CC_TYPES : Volume, Pan, Modulation, etc. (0-127)
//   - STATUS_BYTES : Valeurs hexadécimales messages
//   - GENERAL_MIDI : Liste instruments GM
//   - NOTE_FREQUENCIES : Fréquences Hz pour chaque note
//
// Architecture:
//   Object freezé (immutable)
//   - Maps bidirectionnelles (number ↔ name)
//   - JSDoc complet
//
// Auteur: MidiMind Team
// ============================================================================
const MidiConstants = {
    // ========================================================================
    // TYPES DE MESSAGES MIDI
    // ========================================================================
    
    MESSAGE_TYPES: {
        // Channel Voice Messages (0x80 - 0xE0)
        NOTE_OFF: 0x80,
        NOTE_ON: 0x90,
        POLY_AFTERTOUCH: 0xA0,
        CONTROL_CHANGE: 0xB0,
        PROGRAM_CHANGE: 0xC0,
        CHANNEL_AFTERTOUCH: 0xD0,
        PITCH_BEND: 0xE0,
        
        // System Common Messages (0xF0 - 0xF7)
        SYSEX_START: 0xF0,
        MTC_QUARTER_FRAME: 0xF1,
        SONG_POSITION: 0xF2,
        SONG_SELECT: 0xF3,
        TUNE_REQUEST: 0xF6,
        SYSEX_END: 0xF7,
        
        // System Real-Time Messages (0xF8 - 0xFF)
        TIMING_CLOCK: 0xF8,
        START: 0xFA,
        CONTINUE: 0xFB,
        STOP: 0xFC,
        ACTIVE_SENSING: 0xFE,
        SYSTEM_RESET: 0xFF
    },
    
    // ========================================================================
    // NUMÉROS DE CONTRÔLEURS MIDI (CC)
    // ========================================================================
    
    CONTROL_NUMBERS: {
        // MSB Controllers (0-31)
        BANK_SELECT: 0,
        MODULATION_WHEEL: 1,
        BREATH_CONTROLLER: 2,
        FOOT_CONTROLLER: 4,
        PORTAMENTO_TIME: 5,
        DATA_ENTRY_MSB: 6,
        CHANNEL_VOLUME: 7,
        BALANCE: 8,
        PAN: 10,
        EXPRESSION: 11,
        EFFECT_1: 12,
        EFFECT_2: 13,
        GENERAL_PURPOSE_1: 16,
        GENERAL_PURPOSE_2: 17,
        GENERAL_PURPOSE_3: 18,
        GENERAL_PURPOSE_4: 19,
        
        // LSB Controllers (32-63) - pour les contrôleurs 0-31
        BANK_SELECT_LSB: 32,
        MODULATION_WHEEL_LSB: 33,
        BREATH_CONTROLLER_LSB: 34,
        FOOT_CONTROLLER_LSB: 36,
        PORTAMENTO_TIME_LSB: 37,
        DATA_ENTRY_LSB: 38,
        CHANNEL_VOLUME_LSB: 39,
        BALANCE_LSB: 40,
        PAN_LSB: 42,
        EXPRESSION_LSB: 43,
        
        // Switches (64-69)
        DAMPER_PEDAL: 64,
        PORTAMENTO_ON_OFF: 65,
        SOSTENUTO: 66,
        SOFT_PEDAL: 67,
        LEGATO_FOOTSWITCH: 68,
        HOLD_2: 69,
        
        // Sound Controllers (70-79)
        SOUND_CONTROLLER_1: 70,  // Sound Variation
        SOUND_CONTROLLER_2: 71,  // Timbre/Harmonic Content
        SOUND_CONTROLLER_3: 72,  // Release Time
        SOUND_CONTROLLER_4: 73,  // Attack Time
        SOUND_CONTROLLER_5: 74,  // Brightness
        SOUND_CONTROLLER_6: 75,  // Decay Time
        SOUND_CONTROLLER_7: 76,  // Vibrato Rate
        SOUND_CONTROLLER_8: 77,  // Vibrato Depth
        SOUND_CONTROLLER_9: 78,  // Vibrato Delay
        SOUND_CONTROLLER_10: 79,
        
        // General Purpose (80-83)
        GENERAL_PURPOSE_5: 80,
        GENERAL_PURPOSE_6: 81,
        GENERAL_PURPOSE_7: 82,
        GENERAL_PURPOSE_8: 83,
        
        // Other
        PORTAMENTO_CONTROL: 84,
        
        // Effects (91-95)
        EFFECTS_1_DEPTH: 91,  // Reverb
        EFFECTS_2_DEPTH: 92,  // Tremolo
        EFFECTS_3_DEPTH: 93,  // Chorus
        EFFECTS_4_DEPTH: 94,  // Celeste
        EFFECTS_5_DEPTH: 95,  // Phaser
        
        // Data Controls
        DATA_INCREMENT: 96,
        DATA_DECREMENT: 97,
        NRPN_LSB: 98,
        NRPN_MSB: 99,
        RPN_LSB: 100,
        RPN_MSB: 101,
        
        // Channel Mode Messages (120-127)
        ALL_SOUND_OFF: 120,
        RESET_ALL_CONTROLLERS: 121,
        LOCAL_CONTROL: 122,
        ALL_NOTES_OFF: 123,
        OMNI_MODE_OFF: 124,
        OMNI_MODE_ON: 125,
        MONO_MODE_ON: 126,
        POLY_MODE_ON: 127
    },
    
    // ========================================================================
    // NOMS DES NOTES MIDI
    // ========================================================================
    
    NOTE_NAMES: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    
    NOTE_NAMES_FLAT: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
    
    // ========================================================================
    // INSTRUMENTS GM (General MIDI)
    // ========================================================================
    
    GM_INSTRUMENTS: {
        // Piano (1-8)
        1: 'Acoustic Grand Piano',
        2: 'Bright Acoustic Piano',
        3: 'Electric Grand Piano',
        4: 'Honky-tonk Piano',
        5: 'Electric Piano 1',
        6: 'Electric Piano 2',
        7: 'Harpsichord',
        8: 'Clavinet',
        
        // Chromatic Percussion (9-16)
        9: 'Celesta',
        10: 'Glockenspiel',
        11: 'Music Box',
        12: 'Vibraphone',
        13: 'Marimba',
        14: 'Xylophone',
        15: 'Tubular Bells',
        16: 'Dulcimer',
        
        // Organ (17-24)
        17: 'Drawbar Organ',
        18: 'Percussive Organ',
        19: 'Rock Organ',
        20: 'Church Organ',
        21: 'Reed Organ',
        22: 'Accordion',
        23: 'Harmonica',
        24: 'Tango Accordion',
        
        // Guitar (25-32)
        25: 'Acoustic Guitar (nylon)',
        26: 'Acoustic Guitar (steel)',
        27: 'Electric Guitar (jazz)',
        28: 'Electric Guitar (clean)',
        29: 'Electric Guitar (muted)',
        30: 'Overdriven Guitar',
        31: 'Distortion Guitar',
        32: 'Guitar Harmonics',
        
        // Bass (33-40)
        33: 'Acoustic Bass',
        34: 'Electric Bass (finger)',
        35: 'Electric Bass (pick)',
        36: 'Fretless Bass',
        37: 'Slap Bass 1',
        38: 'Slap Bass 2',
        39: 'Synth Bass 1',
        40: 'Synth Bass 2',
        
        // Strings (41-48)
        41: 'Violin',
        42: 'Viola',
        43: 'Cello',
        44: 'Contrabass',
        45: 'Tremolo Strings',
        46: 'Pizzicato Strings',
        47: 'Orchestral Harp',
        48: 'Timpani',
        
        // Ensemble (49-56)
        49: 'String Ensemble 1',
        50: 'String Ensemble 2',
        51: 'Synth Strings 1',
        52: 'Synth Strings 2',
        53: 'Choir Aahs',
        54: 'Voice Oohs',
        55: 'Synth Voice',
        56: 'Orchestra Hit',
        
        // Brass (57-64)
        57: 'Trumpet',
        58: 'Trombone',
        59: 'Tuba',
        60: 'Muted Trumpet',
        61: 'French Horn',
        62: 'Brass Section',
        63: 'Synth Brass 1',
        64: 'Synth Brass 2',
        
        // Reed (65-72)
        65: 'Soprano Sax',
        66: 'Alto Sax',
        67: 'Tenor Sax',
        68: 'Baritone Sax',
        69: 'Oboe',
        70: 'English Horn',
        71: 'Bassoon',
        72: 'Clarinet',
        
        // Pipe (73-80)
        73: 'Piccolo',
        74: 'Flute',
        75: 'Recorder',
        76: 'Pan Flute',
        77: 'Blown Bottle',
        78: 'Shakuhachi',
        79: 'Whistle',
        80: 'Ocarina',
        
        // Synth Lead (81-88)
        81: 'Lead 1 (square)',
        82: 'Lead 2 (sawtooth)',
        83: 'Lead 3 (calliope)',
        84: 'Lead 4 (chiff)',
        85: 'Lead 5 (charang)',
        86: 'Lead 6 (voice)',
        87: 'Lead 7 (fifths)',
        88: 'Lead 8 (bass + lead)',
        
        // Synth Pad (89-96)
        89: 'Pad 1 (new age)',
        90: 'Pad 2 (warm)',
        91: 'Pad 3 (polysynth)',
        92: 'Pad 4 (choir)',
        93: 'Pad 5 (bowed)',
        94: 'Pad 6 (metallic)',
        95: 'Pad 7 (halo)',
        96: 'Pad 8 (sweep)',
        
        // Synth Effects (97-104)
        97: 'FX 1 (rain)',
        98: 'FX 2 (soundtrack)',
        99: 'FX 3 (crystal)',
        100: 'FX 4 (atmosphere)',
        101: 'FX 5 (brightness)',
        102: 'FX 6 (goblins)',
        103: 'FX 7 (echoes)',
        104: 'FX 8 (sci-fi)',
        
        // Ethnic (105-112)
        105: 'Sitar',
        106: 'Banjo',
        107: 'Shamisen',
        108: 'Koto',
        109: 'Kalimba',
        110: 'Bagpipe',
        111: 'Fiddle',
        112: 'Shanai',
        
        // Percussive (113-120)
        113: 'Tinkle Bell',
        114: 'Agogo',
        115: 'Steel Drums',
        116: 'Woodblock',
        117: 'Taiko Drum',
        118: 'Melodic Tom',
        119: 'Synth Drum',
        120: 'Reverse Cymbal',
        
        // Sound Effects (121-128)
        121: 'Guitar Fret Noise',
        122: 'Breath Noise',
        123: 'Seashore',
        124: 'Bird Tweet',
        125: 'Telephone Ring',
        126: 'Helicopter',
        127: 'Applause',
        128: 'Gunshot'
    },
    
    // ========================================================================
    // DRUMS GM (Canal 10)
    // ========================================================================
    
    GM_DRUMS: {
        35: 'Bass Drum 2',
        36: 'Bass Drum 1',
        37: 'Side Stick',
        38: 'Snare Drum 1',
        39: 'Hand Clap',
        40: 'Snare Drum 2',
        41: 'Low Tom 2',
        42: 'Closed Hi-hat',
        43: 'Low Tom 1',
        44: 'Pedal Hi-hat',
        45: 'Mid Tom 2',
        46: 'Open Hi-hat',
        47: 'Mid Tom 1',
        48: 'High Tom 2',
        49: 'Crash Cymbal 1',
        50: 'High Tom 1',
        51: 'Ride Cymbal 1',
        52: 'Chinese Cymbal',
        53: 'Ride Bell',
        54: 'Tambourine',
        55: 'Splash Cymbal',
        56: 'Cowbell',
        57: 'Crash Cymbal 2',
        58: 'Vibra Slap',
        59: 'Ride Cymbal 2',
        60: 'High Bongo',
        61: 'Low Bongo',
        62: 'Mute High Conga',
        63: 'Open High Conga',
        64: 'Low Conga',
        65: 'High Timbale',
        66: 'Low Timbale',
        67: 'High Agogo',
        68: 'Low Agogo',
        69: 'Cabasa',
        70: 'Maracas',
        71: 'Short Whistle',
        72: 'Long Whistle',
        73: 'Short Guiro',
        74: 'Long Guiro',
        75: 'Claves',
        76: 'High Wood Block',
        77: 'Low Wood Block',
        78: 'Mute Cuica',
        79: 'Open Cuica',
        80: 'Mute Triangle',
        81: 'Open Triangle'
    },
    
    // ========================================================================
    // MÉTHODES UTILITAIRES
    // ========================================================================
    
    /**
     * Obtenir le nom d'une note à partir de son numéro MIDI
     * @param {number} noteNumber - Numéro de note MIDI (0-127)
     * @param {boolean} useFlats - Utiliser les bémols au lieu des dièses
     * @returns {string} Nom de la note (ex: "C4", "A#3")
     */
    getNoteName(noteNumber, useFlats = false) {
        if (noteNumber < 0 || noteNumber > 127) {
            return 'Invalid';
        }
        
        const names = useFlats ? this.NOTE_NAMES_FLAT : this.NOTE_NAMES;
        const noteName = names[noteNumber % 12];
        const octave = Math.floor(noteNumber / 12) - 1;
        
        return `${noteName}${octave}`;
    },
    
    /**
     * Obtenir le numéro MIDI d'une note à partir de son nom
     * @param {string} noteName - Nom de la note (ex: "C4", "A#3")
     * @returns {number} Numéro de note MIDI (0-127) ou -1 si invalide
     */
    getNoteNumber(noteName) {
        const match = noteName.match(/^([A-G]#?b?)(-?\d+)$/i);
        if (!match) return -1;
        
        let [, note, octave] = match;
        note = note.toUpperCase();
        octave = parseInt(octave);
        
        // Normaliser les notations
        note = note.replace('♯', '#').replace('♭', 'b');
        
        // Trouver l'index de la note
        let noteIndex = this.NOTE_NAMES.indexOf(note);
        if (noteIndex === -1) {
            noteIndex = this.NOTE_NAMES_FLAT.indexOf(note);
        }
        
        if (noteIndex === -1) return -1;
        
        const noteNumber = (octave + 1) * 12 + noteIndex;
        
        return (noteNumber >= 0 && noteNumber <= 127) ? noteNumber : -1;
    },
    
    /**
     * Obtenir le nom d'un instrument GM
     * @param {number} programNumber - Numéro de programme (1-128)
     * @returns {string} Nom de l'instrument
     */
    getInstrumentName(programNumber) {
        return this.GM_INSTRUMENTS[programNumber] || `Program ${programNumber}`;
    },
    
    /**
     * Obtenir le nom d'un contrôleur MIDI
     * @param {number} ccNumber - Numéro de contrôleur (0-127)
     * @returns {string} Nom du contrôleur
     */
    getControllerName(ccNumber) {
        // Rechercher dans les contrôleurs définis
        for (const [name, number] of Object.entries(this.CONTROL_NUMBERS)) {
            if (number === ccNumber) {
                return name.replace(/_/g, ' ').toLowerCase()
                    .replace(/\b\w/g, l => l.toUpperCase());
            }
        }
        return `Controller ${ccNumber}`;
    },
    
    /**
     * Obtenir le nom d'un type de message MIDI
     * @param {number} statusByte - Octet de statut MIDI
     * @returns {string} Nom du type de message
     */
    getMessageTypeName(statusByte) {
        const type = statusByte & 0xF0;
        
        for (const [name, value] of Object.entries(this.MESSAGE_TYPES)) {
            if (value === type || value === statusByte) {
                return name.replace(/_/g, ' ').toLowerCase()
                    .replace(/\b\w/g, l => l.toUpperCase());
            }
        }
        return `Unknown (0x${statusByte.toString(16).toUpperCase()})`;
    },
    
    /**
     * Vérifier si un message est un message de canal
     * @param {number} statusByte - Octet de statut MIDI
     * @returns {boolean} True si c'est un message de canal
     */
    isChannelMessage(statusByte) {
        return (statusByte & 0xF0) >= 0x80 && (statusByte & 0xF0) < 0xF0;
    },
    
    /**
     * Extraire le canal d'un message MIDI
     * @param {number} statusByte - Octet de statut MIDI
     * @returns {number} Numéro de canal (1-16) ou 0 si pas un message de canal
     */
    getChannel(statusByte) {
        if (!this.isChannelMessage(statusByte)) {
            return 0;
        }
        return (statusByte & 0x0F) + 1;
    },
    
    /**
     * Convertir une vélocité MIDI (0-127) en volume (0-100%)
     * @param {number} velocity - Vélocité MIDI
     * @returns {number} Volume en pourcentage
     */
    velocityToVolume(velocity) {
        return Math.round((velocity / 127) * 100);
    },
    
    /**
     * Convertir un volume (0-100%) en vélocité MIDI (0-127)
     * @param {number} volume - Volume en pourcentage
     * @returns {number} Vélocité MIDI
     */
    volumeToVelocity(volume) {
        return Math.round((volume / 100) * 127);
    }
};

// Rendre disponible globalement si pas de module système
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MidiConstants;
} else if (typeof window !== 'undefined') {
    window.MidiConstants = MidiConstants;
}
window.MidiConstants = MidiConstants;