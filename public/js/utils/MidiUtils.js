/**
 * Fichier: frontend/js/utils/MidiUtils.js
 * Fonctions utilitaires pour la manipulation MIDI
 */

const MidiUtils = {
    noteNumberToName(noteNumber) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(noteNumber / 12) - 1;
        const noteName = noteNames[noteNumber % 12];
        return `${noteName}${octave}`;
    },

    noteNameToNumber(noteName) {
        const match = noteName.match(/^([A-G]#?)(-?\d+)$/);
        if (!match) return null;
        
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const [, note, octave] = match;
        const noteIndex = noteNames.indexOf(note);
        
        if (noteIndex === -1) return null;
        
        return (parseInt(octave) + 1) * 12 + noteIndex;
    },

    velocityToDb(velocity) {
        if (velocity === 0) return -Infinity;
        return 20 * Math.log10(velocity / 127);
    },

    dbToVelocity(db) {
        if (db === -Infinity) return 0;
        return Math.round(127 * Math.pow(10, db / 20));
    },

    noteToFrequency(noteNumber) {
        return 440 * Math.pow(2, (noteNumber - 69) / 12);
    },

    frequencyToNote(frequency) {
        return Math.round(69 + 12 * Math.log2(frequency / 440));
    },

    ticksToMs(ticks, bpm = 120, ticksPerQuarter = 480) {
        const msPerQuarter = (60000 / bpm);
        return (ticks / ticksPerQuarter) * msPerQuarter;
    },

    msToTicks(ms, bpm = 120, ticksPerQuarter = 480) {
        const msPerQuarter = (60000 / bpm);
        return Math.round((ms / msPerQuarter) * ticksPerQuarter);
    },

    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    getProgramName(program) {
        const gmInstruments = [
            'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano',
            'Honky-tonk Piano', 'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavi',
            'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone', 'Marimba', 'Xylophone',
            'Tubular Bells', 'Dulcimer',
            'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ', 'Reed Organ',
            'Accordion', 'Harmonica', 'Tango Accordion',
            'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)', 'Electric Guitar (jazz)',
            'Electric Guitar (clean)', 'Electric Guitar (muted)', 'Overdriven Guitar',
            'Distortion Guitar', 'Guitar harmonics',
            'Acoustic Bass', 'Electric Bass (finger)', 'Electric Bass (pick)', 'Fretless Bass',
            'Slap Bass 1', 'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2',
            'Violin', 'Viola', 'Cello', 'Contrabass', 'Tremolo Strings', 'Pizzicato Strings',
            'Orchestral Harp', 'Timpani',
            'String Ensemble 1', 'String Ensemble 2', 'SynthStrings 1', 'SynthStrings 2',
            'Choir Aahs', 'Voice Oohs', 'Synth Voice', 'Orchestra Hit',
            'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet', 'French Horn', 'Brass Section',
            'SynthBrass 1', 'SynthBrass 2',
            'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax', 'Oboe', 'English Horn',
            'Bassoon', 'Clarinet',
            'Piccolo', 'Flute', 'Recorder', 'Pan Flute', 'Blown Bottle', 'Shakuhachi',
            'Whistle', 'Ocarina',
            'Lead 1 (square)', 'Lead 2 (sawtooth)', 'Lead 3 (calliope)', 'Lead 4 (chiff)',
            'Lead 5 (charang)', 'Lead 6 (voice)', 'Lead 7 (fifths)', 'Lead 8 (bass + lead)',
            'Pad 1 (new age)', 'Pad 2 (warm)', 'Pad 3 (polysynth)', 'Pad 4 (choir)',
            'Pad 5 (bowed)', 'Pad 6 (metallic)', 'Pad 7 (halo)', 'Pad 8 (sweep)',
            'FX 1 (rain)', 'FX 2 (soundtrack)', 'FX 3 (crystal)', 'FX 4 (atmosphere)',
            'FX 5 (brightness)', 'FX 6 (goblins)', 'FX 7 (echoes)', 'FX 8 (sci-fi)',
            'Sitar', 'Banjo', 'Shamisen', 'Koto', 'Kalimba', 'Bag pipe', 'Fiddle', 'Shanai',
            'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock', 'Taiko Drum', 'Melodic Tom',
            'Synth Drum', 'Reverse Cymbal',
            'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet', 'Telephone Ring',
            'Helicopter', 'Applause', 'Gunshot'
        ];
        return gmInstruments[program] || 'Unknown';
    },

    isBlackKey(noteNumber) {
        const noteInOctave = noteNumber % 12;
        return [1, 3, 6, 8, 10].includes(noteInOctave);
    },

    createMessage(status, data1, data2 = 0) {
        return new Uint8Array([status, data1, data2]);
    },

    parseMessage(message) {
        const status = message[0];
        const type = status & 0xF0;
        const channel = status & 0x0F;
        
        return {
            type: this.getMessageTypeName(type),
            channel,
            data1: message[1],
            data2: message[2]
        };
    },

    getMessageTypeName(type) {
        const types = {
            0x80: 'noteOff',
            0x90: 'noteOn',
            0xA0: 'polyAftertouch',
            0xB0: 'controlChange',
            0xC0: 'programChange',
            0xD0: 'channelAftertouch',
            0xE0: 'pitchBend'
        };
        return types[type] || 'unknown';
    },

    transpose(noteNumber, semitones) {
        return Math.max(0, Math.min(127, noteNumber + semitones));
    },

    interval(note1, note2) {
        return Math.abs(note2 - note1);
    },

    quantize(ticks, gridSize) {
        return Math.round(ticks / gridSize) * gridSize;
    },
    
    NOTE_NAMES: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    
    getNoteName(midiNote) {
        return this.NOTE_NAMES[midiNote % 12];
    },
    
    getOctave(midiNote) {
        return Math.floor(midiNote / 12) - 1;
    },
    
    getFullNoteName(midiNote) {
        return this.getNoteName(midiNote) + this.getOctave(midiNote);
    },
    
    noteNameToMidi(noteName) {
        const match = noteName.match(/^([A-G]#?)(-?\d+)$/);
        if (!match) return null;
        
        const [, note, octave] = match;
        const noteIndex = this.NOTE_NAMES.indexOf(note);
        if (noteIndex === -1) return null;
        
        return (parseInt(octave) + 1) * 12 + noteIndex;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MidiUtils;
}
if (typeof window !== 'undefined') {
    window.MidiUtils = MidiUtils;
}